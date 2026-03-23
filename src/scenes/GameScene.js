import Phaser from 'phaser';

const TILE = 16;
const GW = 30;
const GH = 30;
const PLAYER_BASE_ATK = 5;
const PLAYER_BASE_DEF = 0;
const PLAYER_BASE_MAX_HP = 30;
const ENEMY_BASE_ATK = 3;
const ENEMY_BASE_HP = 10;
const LOS_RADIUS = 5;
const ENEMY_DETECT_RADIUS = 6;
const SEARCH_MAX_TURNS = 8;
const ICON_BOUNCE_MS = 400;
const PATH_MAX_STEPS = 50;
const PATH_MAX_EXPANSIONS = 2500;
const PATH_CACHE_TURNS = 3;
const MOVE_TWEEN_MS = 80;
const MOVE_EASE = 'Power1';
const SHAKE_HIT_MS = 150;
const SHAKE_HIT_INTENSITY = 0.008;
const SHAKE_DEATH_MS = 400;
const SHAKE_DEATH_INTENSITY = 0.02;

function roomOverlaps(rooms, rx, ry, rw, rh) {
  for (const r of rooms) {
    if (rx < r.x + r.w + 1 && rx + rw + 1 > r.x && ry < r.y + r.h + 1 && ry + rh + 1 > r.y) {
      return true;
    }
  }
  return false;
}

function carveRoom(grid, rx, ry, rw, rh) {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      grid[y][x] = 0;
    }
  }
}

function carveCorridor(grid, x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  while (x !== x1) {
    grid[y][x] = 0;
    x += x < x1 ? 1 : -1;
  }
  while (y !== y1) {
    grid[y][x] = 0;
    y += y < y1 ? 1 : -1;
  }
  grid[y1][x1] = 0;
}

function generateDungeon(rng) {
  for (let run = 0; run < 200; run++) {
    const grid = [];
    for (let y = 0; y < GH; y++) {
      grid[y] = [];
      for (let x = 0; x < GW; x++) {
        grid[y][x] = 1;
      }
    }

    const target = rng.between(5, 8);
    const rooms = [];
    let attempts = 0;
    while (rooms.length < target && attempts < 800) {
      attempts++;
      const rw = rng.between(5, 10);
      const rh = rng.between(5, 10);
      const rx = rng.between(1, GW - rw - 2);
      const ry = rng.between(1, GH - rh - 2);
      if (!roomOverlaps(rooms, rx, ry, rw, rh)) {
        carveRoom(grid, rx, ry, rw, rh);
        rooms.push({
          x: rx,
          y: ry,
          w: rw,
          h: rh,
          cx: rx + Math.floor(rw / 2),
          cy: ry + Math.floor(rh / 2),
        });
      }
    }

    if (rooms.length < 5) continue;

    for (let i = 0; i < rooms.length - 1; i++) {
      const a = rooms[i];
      const b = rooms[i + 1];
      carveCorridor(grid, a.cx, a.cy, b.cx, b.cy);
    }

    return { grid, rooms };
  }

  throw new Error('Dungeon generation failed');
}

function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

function bresenhamLine(x0, y0, x1, y1) {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  const cells = [];
  while (true) {
    cells.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
  return cells;
}

function hasLOS(grid, x1, y1, x2, y2) {
  if (x1 < 0 || x1 >= GW || y1 < 0 || y1 >= GH) return false;
  if (x2 < 0 || x2 >= GW || y2 < 0 || y2 >= GH) return false;
  const cells = bresenhamLine(x1, y1, x2, y2);
  for (let i = 0; i < cells.length; i++) {
    const [cx, cy] = cells[i];
    if (grid[cy][cx] === 1) {
      if (i === cells.length - 1) return true;
      return false;
    }
  }
  return true;
}

function findPath(sx, sy, tx, ty, isWalkable) {
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  const key = (x, y) => y * GW + x;

  if (sx === tx && sy === ty) return [];
  if (!isWalkable(sx, sy) || !isWalkable(tx, ty)) return [];

  const open = [];
  const gScore = new Map();

  const h = (x, y) => manhattan(x, y, tx, ty);

  const startK = key(sx, sy);
  gScore.set(startK, 0);
  open.push({ x: sx, y: sy, g: 0, f: h(sx, sy) });

  let expansions = 0;

  const cameFrom = new Map();
  cameFrom.set(startK, null);

  while (open.length > 0 && expansions < PATH_MAX_EXPANSIONS) {
    expansions++;
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    const ck = key(cur.x, cur.y);

    if (cur.g !== gScore.get(ck)) continue;

    if (cur.x === tx && cur.y === ty) {
      const path = [];
      let cx = tx;
      let cy = ty;
      while (cx !== sx || cy !== sy) {
        path.push({ x: cx, y: cy });
        const prev = cameFrom.get(key(cx, cy));
        if (!prev) return [];
        cx = prev.x;
        cy = prev.y;
      }
      path.reverse();
      if (path.length > PATH_MAX_STEPS) return [];
      return path;
    }

    if (cur.g >= PATH_MAX_STEPS) continue;

    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) continue;
      if (!isWalkable(nx, ny)) continue;

      const nk = key(nx, ny);
      const tentativeG = cur.g + 1;
      const prevG = gScore.get(nk);
      if (prevG !== undefined && tentativeG >= prevG) continue;

      gScore.set(nk, tentativeG);
      cameFrom.set(nk, { x: cur.x, y: cur.y });
      open.push({ x: nx, y: ny, g: tentativeG, f: tentativeG + h(nx, ny) });
    }
  }

  return [];
}

export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#0a0a0f');
    this.floor = 1;
    this.turn = 1;
    this.enemiesSlain = 0;
    this.playerLevel = 1;
    this.playerXp = 0;
    this.playerAtk = PLAYER_BASE_ATK;
    this.playerDef = PLAYER_BASE_DEF;
    this.playerMaxHp = PLAYER_BASE_MAX_HP;
    this.playerHp = this.playerMaxHp;
    this.processingTurn = false;
    this.isTransitioningFloor = false;
    this.isGameOver = false;
    this.playerStatPoints = 0;

    this.tileSprites = [];
    this.enemies = [];
    this.fogLayer = this.add.graphics();
    this.stairs = null;
    this.stairsFloatHint = null;

    this.overlayFade = this.add.rectangle(240, 240, 480, 480, 0x000000, 0).setScrollFactor(0).setDepth(300);

    this.uiHpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.uiHpBarBg.fillStyle(0x222222, 1);
    this.uiHpBarBg.fillRect(10, 10, 102, 10);
    this.uiXpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.uiXpBarBg.fillStyle(0x222222, 1);
    this.uiXpBarBg.fillRect(10, 24, 102, 6);
    this.uiHpBar = this.add.graphics().setScrollFactor(0).setDepth(101);
    this.uiXpBar = this.add.graphics().setScrollFactor(0).setDepth(101);

    this.uiHpText = this.add
      .text(10, 34, '', { fontFamily: 'monospace', fontSize: '11px', color: '#ffffff' })
      .setScrollFactor(0)
      .setDepth(102);
    this.uiAtkText = this.add
      .text(10, 48, '', { fontFamily: 'monospace', fontSize: '11px', color: '#cccccc' })
      .setScrollFactor(0)
      .setDepth(102);
    this.uiDefText = this.add
      .text(10, 62, '', { fontFamily: 'monospace', fontSize: '11px', color: '#cccccc' })
      .setScrollFactor(0)
      .setDepth(102);
    this.uiTurnText = this.add
      .text(10, 76, 'TURN 1', { fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa' })
      .setScrollFactor(0)
      .setDepth(100);
    this.uiFloorLabel = this.add
      .text(470, 10, 'FLOOR 1  LV 1', { fontFamily: 'monospace', fontSize: '12px', color: '#ffffff' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.uiProfileBtn = this.add
      .text(470, 470, '[P] PROFILE', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9988cc',
        backgroundColor: '#12121f',
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });
    this.uiProfileBtn.on('pointerdown', (pointer, localX, localY, event) => {
      if (event) event.stopPropagation();
      this.toggleProfileOverlay();
    });
    this.uiProfileBtn.on('pointerover', () => this.uiProfileBtn.setStyle({ color: '#f0c040' }));
    this.uiProfileBtn.on('pointerout', () => this.uiProfileBtn.setStyle({ color: '#9988cc' }));
    this.uiProfileHint = this.add
      .text(470, 454, 'Press P', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#b8a8e8',
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(102)
      .setAlpha(0.95);
    this.tweens.add({
      targets: this.uiProfileHint,
      alpha: 0,
      duration: 600,
      delay: 3000,
      onComplete: () => this.uiProfileHint.destroy(),
    });
    this.uiProfileBadge = this.add
      .text(470, 452, '!', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ff4444',
        fontStyle: 'bold',
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(103)
      .setVisible(false);
    this.profileOverlayOpen = false;
    this.profileOverlayBg = this.add
      .rectangle(240, 240, 280, 300, 0x0a0a1e, 0.95)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false)
      .setStrokeStyle(1, 0x4a3a7a);
    this.profileOverlayTitle = this.add
      .text(240, 110, 'CHARACTER', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f0c040',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false);
    this.profileStatTexts = {};
    const statRows = [
      { key: 'hp', label: 'MAX HP', y: 150 },
      { key: 'atk', label: 'ATK', y: 175 },
      { key: 'def', label: 'DEF', y: 200 },
      { key: 'level', label: 'LEVEL', y: 225 },
      { key: 'pts', label: 'POINTS', y: 255 },
    ];
    statRows.forEach((row) => {
      const lbl = this.add
        .text(140, row.y, `${row.label}:`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#9988cc',
        })
        .setScrollFactor(0)
        .setDepth(201)
        .setVisible(false);
      const val = this.add
        .text(240, row.y, '—', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffffff',
        })
        .setScrollFactor(0)
        .setDepth(201)
        .setVisible(false);
      this.profileStatTexts[row.key] = { lbl, val };
    });
    this.profileBtnAtk = this.add
      .text(240, 290, '[+] SPEND ON ATK  (+2)', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f0c040',
        backgroundColor: '#1a1a2e',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.profileBtnDef = this.add
      .text(240, 320, '[+] SPEND ON DEF  (+1)', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f0c040',
        backgroundColor: '#1a1a2e',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.profileBtnHp = this.add
      .text(240, 350, '[+] SPEND ON HP   (+8)', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#f0c040',
        backgroundColor: '#1a1a2e',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.profileCloseBtn = this.add
      .text(240, 385, '[ CLOSE ]', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#888888',
        backgroundColor: '#111118',
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.profileBtnAtk.on('pointerdown', () => {
      this.spendStatPoint('atk');
      this.refreshProfileOverlay();
    });
    this.profileBtnDef.on('pointerdown', () => {
      this.spendStatPoint('def');
      this.refreshProfileOverlay();
    });
    this.profileBtnHp.on('pointerdown', () => {
      this.spendStatPoint('hp');
      this.refreshProfileOverlay();
    });
    this.profileCloseBtn.on('pointerdown', () => this.toggleProfileOverlay());
    [this.profileBtnAtk, this.profileBtnDef, this.profileBtnHp].forEach((btn) => {
      btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#2a2a44' }));
      btn.on('pointerout', () => btn.setStyle({ backgroundColor: '#1a1a2e' }));
    });

    this.gameOverTitle = this.add
      .text(240, 210, '', { fontFamily: 'monospace', fontSize: '36px', color: '#ff4444' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(320)
      .setVisible(false);
    this.gameOverStats = this.add
      .text(240, 255, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', align: 'center' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(320)
      .setVisible(false);
    this.gameOverRestart = this.add
      .text(240, 310, '', { fontFamily: 'monospace', fontSize: '14px', color: '#aaaaaa' })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(320)
      .setVisible(false);

    this.buildFloor(true);
    this.refreshHUD();

    this.input.keyboard.on('keydown', (e) => {
      if (e.repeat) return;
      if ((e.key === 'r' || e.key === 'R') && this.isGameOver) {
        this.scene.restart();
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        this.toggleProfileOverlay();
        return;
      } else if (e.key === 'Escape') {
        if (this.profileOverlayOpen) {
          this.toggleProfileOverlay();
          return;
        }
      }
      if (this.playerHp <= 0 || this.isGameOver || this.isTransitioningFloor) return;
      if (this.processingTurn) return;

      let dx = 0;
      let dy = 0;
      if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') dy = -1;
      else if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') dy = 1;
      else if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') dx = -1;
      else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') dx = 1;
      else return;

      this.tryPlayerMove(dx, dy);
    });

    // Click to move
    this.input.on('pointerdown', (pointer) => {
      if (this.processingTurn) return;
      if (this.isTransitioningFloor) return;
      if (this.isGameOver) return;
      if (this.profileOverlayOpen) return;

      // Convert screen coords ke world coords
      const worldX = pointer.worldX;
      const worldY = pointer.worldY;
      const tx = Math.floor(worldX / TILE);
      const ty = Math.floor(worldY / TILE);

      if (tx < 0 || tx >= GW || ty < 0 || ty >= GH) return;
      if (this.grid[ty][tx] === 1) return; // wall

      // Kalau click tepat 1 tile di sebelah → langsung move
      const dx = tx - this.px;
      const dy = ty - this.py;
      if (Math.abs(dx) + Math.abs(dy) === 1) {
        this.tryPlayerMove(dx, dy);
        return;
      }

      // Kalau lebih jauh → cari path, ambil 1 step pertama
      const path = findPath(this.px, this.py, tx, ty, (x, y) => {
        if (x < 0 || x >= GW || y < 0 || y >= GH) return false;
        if (this.grid[y][x] !== 0) return false;
        return true;
      });

      if (path.length === 0) return;

      // Move 1 step saja
      const step = path[0];
      const sdx = step.x - this.px;
      const sdy = step.y - this.py;
      this.tryPlayerMove(sdx, sdy);

      // Visual: tampilkan path highlight singkat
      this.showClickPath(path);
    });
  }

  buildFloor(firstBuild = false) {
    this.fogLayer.clear();
    for (const row of this.tileSprites) {
      for (const s of row) {
        s.destroy();
      }
    }
    this.tileSprites = [];

    for (const e of this.enemies) {
      if (e.stateIcon) {
        this.tweens.killTweensOf(e.stateIcon);
        e.stateIcon.destroy();
      }
      e.sprite.destroy();
    }
    this.enemies = [];

    if (this.stairs) {
      this.tweens.killTweensOf(this.stairs);
      this.stairs.destroy();
      this.stairs = null;
    }
    if (this.stairsFloatHint) {
      this.stairsFloatHint.destroy();
      this.stairsFloatHint = null;
    }

    const rng = Phaser.Math.RND;
    const { grid, rooms } = generateDungeon(rng);
    this.grid = grid;
    this.rooms = rooms;

    for (let y = 0; y < GH; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < GW; x++) {
        const key = grid[y][x] === 1 ? 'wall' : 'floor';
        const s = this.add.image(x * TILE, y * TILE, key).setOrigin(0, 0);
        this.tileSprites[y][x] = s;
      }
    }

    this.explored = [];
    for (let y = 0; y < GH; y++) {
      this.explored[y] = [];
      for (let x = 0; x < GW; x++) this.explored[y][x] = false;
    }

    const r0 = rooms[0];
    this.px = r0.cx;
    this.py = r0.cy;

    if (firstBuild) {
      this.player = this.physics.add.sprite(this.px * TILE + TILE / 2, this.py * TILE + TILE / 2, 'player');
      this.player.setDepth(55);
      this.player.body.setSize(16, 16);
      this.player.setCollideWorldBounds(false);
    } else {
      this.player.setPosition(this.px * TILE + TILE / 2, this.py * TILE + TILE / 2);
    }

    this.player.setPosition(this.px * TILE + TILE / 2, this.py * TILE + TILE / 2);
    this.player.setVisible(true);
    this.player.setDepth(55);
    this.player.setAlpha(1);
    this.player.setScale(1);
    this.player.clearTint();
    this.cameras.main.setBounds(0, 0, GW * TILE, GH * TILE);
    this.cameras.main.startFollow(this.player, true, 1, 1);

    const enemyHp = ENEMY_BASE_HP + (this.floor - 1) * 3;
    const enemyAtk = ENEMY_BASE_ATK + (this.floor - 1);
    const enemyCountTarget = Math.min(3 + this.floor, 12);
    const floorTiles = [];
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (grid[y][x] === 0 && !(x === this.px && y === this.py)) floorTiles.push({ x, y });
      }
    }
    Phaser.Math.RND.shuffle(floorTiles);
    const spawnCount = Math.min(enemyCountTarget, floorTiles.length);

    for (let i = 0; i < spawnCount; i++) {
      const pos = floorTiles[i];
      const spr = this.physics.add.sprite(pos.x * TILE + TILE / 2, pos.y * TILE + TILE / 2, 'enemy');
      spr.setDepth(52);
      spr.body.setSize(16, 16);
      this.enemies.push({
        sprite: spr,
        gx: pos.x,
        gy: pos.y,
        hp: enemyHp,
        atk: enemyAtk,
        cachedPath: [],
        pathCacheTurn: -1000,
        aiState: 'idle',
        lastKnownPx: 0,
        lastKnownPy: 0,
        patrolTick: 0,
        searchTurns: 0,
        roamStepsLeft: -1,
        stateIcon: null,
      });
    }

    const stairRoom = rooms[rooms.length - 1];
    const stairPos = { x: stairRoom.cx, y: stairRoom.cy };
    this.stairs = this.add
      .text(stairPos.x * TILE + TILE / 2, stairPos.y * TILE + TILE / 2, '▼', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f0c040',
      })
      .setOrigin(0.5)
      .setDepth(56);
    this.tweens.add({
      targets: this.stairs,
      alpha: { from: 0.6, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });
    this.stairs.gx = stairPos.x;
    this.stairs.gy = stairPos.y;
    if (this.stairsFloatHint) this.stairsFloatHint.destroy();
    this.stairsFloatHint = null;
    if (this.floor <= 1) {
      this.stairsFloatHint = this.add
        .text(stairPos.x * TILE + TILE / 2, stairPos.y * TILE - 10, '▼ descend', {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#f0c040',
        })
        .setOrigin(0.5, 1)
        .setDepth(120)
        .setAlpha(0);
      this.time.delayedCall(500, () => {
        if (!this.stairsFloatHint) return;
        this.tweens.add({
          targets: this.stairsFloatHint,
          alpha: 1,
          duration: 400,
        });
      });
    }

    this.markExplored();
    this.updateFog();
    this.refreshTileVisibility();
    this.refreshEnemyVisibility();
  }

  update() {
    this.syncStateIconPositions();
  }

  syncStateIconPositions() {
    for (const e of this.enemies) {
      if (e.hp <= 0 || !e.stateIcon) continue;
      e.stateIcon.setPosition(e.sprite.x, e.sprite.y - 12);
    }
  }

  playerCanSeeTile(tx, ty) {
    if (chebyshev(this.px, this.py, tx, ty) > LOS_RADIUS) return false;
    return hasLOS(this.grid, this.px, this.py, tx, ty);
  }

  enemyCanSeePlayer(e) {
    if (chebyshev(e.gx, e.gy, this.px, this.py) > ENEMY_DETECT_RADIUS) return false;
    return hasLOS(this.grid, e.gx, e.gy, this.px, this.py);
  }

  syncEnemyStateIcon(e) {
    if (e.stateIcon) {
      this.tweens.killTweensOf(e.stateIcon);
      e.stateIcon.destroy();
      e.stateIcon = null;
    }
    if (e.aiState === 'hunt') {
      e.stateIcon = this.add
        .text(e.sprite.x, e.sprite.y - 12, '!', {
          fontFamily: 'monospace',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ff4444',
        })
        .setOrigin(0.5, 1)
        .setDepth(63)
        .setScale(0.9);
      this.tweens.add({
        targets: e.stateIcon,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: ICON_BOUNCE_MS / 2,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    } else if (e.aiState === 'search') {
      e.stateIcon = this.add
        .text(e.sprite.x, e.sprite.y - 12, '?', {
          fontFamily: 'monospace',
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#ffff00',
        })
        .setOrigin(0.5, 1)
        .setDepth(63)
        .setScale(0.9);
      this.tweens.add({
        targets: e.stateIcon,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: ICON_BOUNCE_MS / 2,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }
  }

  refreshHUD() {
    this.uiHpBar.clear();
    this.uiXpBar.clear();
    const ratio = Phaser.Math.Clamp(this.playerHp / this.playerMaxHp, 0, 1);
    this.uiHpBar.fillStyle(0x33aa33, 1);
    this.uiHpBar.fillRect(11, 11, 100 * ratio, 8);
    const need = this.playerLevel * 30;
    const xpRatio = Phaser.Math.Clamp(this.playerXp / need, 0, 1);
    this.uiXpBar.fillStyle(0x3388ff, 1);
    this.uiXpBar.fillRect(11, 25, 100 * xpRatio, 4);
    this.uiHpText.setText(`${this.playerHp} / ${this.playerMaxHp}`);
    this.uiAtkText.setText(`ATK ${this.playerAtk}`);
    this.uiDefText.setText(`DEF ${this.playerDef}`);
    this.uiFloorLabel.setText(`FLOOR ${this.floor}  LV ${this.playerLevel}`);
    this.uiTurnText.setText(`TURN ${this.turn}`);
    const hasPts = this.playerStatPoints > 0;
    if (this.uiProfileBadge) this.uiProfileBadge.setVisible(hasPts);
    if (this.uiProfileBtn) {
      this.uiProfileBtn.setStyle({
        color: hasPts ? '#ff8844' : '#9988cc',
      });
    }
    if (this.profileOverlayOpen) this.refreshProfileOverlay();
  }

  toggleProfileOverlay() {
    this.profileOverlayOpen = !this.profileOverlayOpen;
    const vis = this.profileOverlayOpen;
    const hasPts = this.playerStatPoints > 0;

    this.profileOverlayBg.setVisible(vis);
    this.profileOverlayTitle.setVisible(vis);
    this.profileCloseBtn.setVisible(vis);

    Object.values(this.profileStatTexts).forEach(({ lbl, val }) => {
      lbl.setVisible(vis);
      val.setVisible(vis);
    });

    this.profileBtnAtk.setVisible(vis && hasPts);
    this.profileBtnDef.setVisible(vis && hasPts);
    this.profileBtnHp.setVisible(vis && hasPts);

    if (vis) this.refreshProfileOverlay();
  }

  refreshProfileOverlay() {
    if (!this.profileOverlayOpen) return;
    const hasPts = this.playerStatPoints > 0;

    const vals = {
      hp: `${this.playerMaxHp}`,
      atk: `${this.playerAtk}`,
      def: `${this.playerDef}`,
      level: `${this.playerLevel}`,
      pts: `${this.playerStatPoints}${hasPts ? '  ← UNSPENT!' : ''}`,
    };

    Object.entries(vals).forEach(([key, v]) => {
      if (this.profileStatTexts[key]) {
        this.profileStatTexts[key].val.setText(v);
        if (key === 'pts') {
          this.profileStatTexts[key].val.setStyle({
            color: hasPts ? '#ff8844' : '#888888',
          });
        }
      }
    });

    this.profileBtnAtk.setVisible(hasPts);
    this.profileBtnDef.setVisible(hasPts);
    this.profileBtnHp.setVisible(hasPts);
  }

  markExplored() {
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (chebyshev(this.px, this.py, x, y) <= LOS_RADIUS && hasLOS(this.grid, this.px, this.py, x, y)) {
          this.explored[y][x] = true;
        }
      }
    }
  }

  updateFog() {
    const g = this.fogLayer;
    g.clear();
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (!this.explored[y][x]) {
          g.fillStyle(0x000000, 1);
          g.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    this.fogLayer.setDepth(50);
  }

  refreshTileVisibility() {
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const vis = this.explored[y][x] && this.playerCanSeeTile(x, y);
        const s = this.tileSprites[y][x];
        if (!this.explored[y][x]) {
          s.setVisible(false);
        } else {
          s.setVisible(true);
          s.setAlpha(vis ? 1 : 0.5);
        }
      }
    }
    if (this.stairsFloatHint && this.stairs) {
      this.stairsFloatHint.setVisible(this.playerCanSeeTile(this.stairs.gx, this.stairs.gy));
    }
  }

  refreshEnemyVisibility() {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      const vis = this.explored[e.gy][e.gx] && this.playerCanSeeTile(e.gx, e.gy);
      e.sprite.setVisible(vis);
    }
  }

  pickRandomPatrolStep(e) {
    const dirs = [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ];
    Phaser.Math.RND.shuffle(dirs);
    for (const [dx, dy] of dirs) {
      const nx = e.gx + dx;
      const ny = e.gy + dy;
      if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) continue;
      if (this.grid[ny][nx] !== 0) continue;
      if (nx === this.px && ny === this.py) continue;
      if (this.enemyAt(nx, ny)) continue;
      return { x: nx, y: ny };
    }
    return null;
  }

  tweenEnemyStep(e, nextX, nextY, onDone) {
    const ox = e.gx;
    const oy = e.gy;
    e.gx = nextX;
    e.gy = nextY;
    e.sprite.setPosition(ox * TILE + TILE / 2, oy * TILE + TILE / 2);
    this.tweens.add({
      targets: e.sprite,
      x: e.gx * TILE + TILE / 2,
      y: e.gy * TILE + TILE / 2,
      duration: MOVE_TWEEN_MS,
      ease: MOVE_EASE,
      onComplete: onDone,
    });
  }

  enemyAt(tx, ty) {
    return this.enemies.find((e) => e.hp > 0 && e.gx === tx && e.gy === ty) || null;
  }

  isWalkableForPath(x, y, goalX, goalY, walkerEnemy) {
    const g = this.grid;
    if (x < 0 || x >= GW || y < 0 || y >= GH) return false;
    if (g[y][x] !== 0) return false;
    if (x === goalX && y === goalY) return true;
    if (x === this.px && y === this.py) return false;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      if (e === walkerEnemy) continue;
      if (e.gx === x && e.gy === y) return false;
    }
    return true;
  }

  spawnDamageNumber(tx, ty, text, color) {
    const t = this.add
      .text(tx * TILE + TILE / 2, ty * TILE + TILE / 2, text, {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: 'bold',
        color,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: t,
      y: t.y - 28,
      alpha: { from: 1, to: 0 },
      duration: 600,
      ease: 'Sine.Out',
      onComplete: () => t.destroy(),
    });
  }

  showClickPath(path) {
    // Hapus highlight lama kalau ada
    if (this.pathHighlights) {
      this.pathHighlights.forEach((h) => h.destroy());
    }
    this.pathHighlights = [];

    // Tampilkan dot kecil di sepanjang path
    path.forEach((p, i) => {
      if (i === 0) return; // skip step pertama
      const dot = this.add
        .rectangle(p.x * TILE + TILE / 2, p.y * TILE + TILE / 2, 4, 4, 0x9988cc, 0.6)
        .setDepth(55);

      this.pathHighlights.push(dot);

      // Fade out cepat
      this.tweens.add({
        targets: dot,
        alpha: 0,
        duration: 300,
        delay: i * 30,
        onComplete: () => dot.destroy(),
      });
    });

    // Clear array setelah semua fade
    this.time.delayedCall(path.length * 30 + 300, () => {
      this.pathHighlights = [];
    });
  }

  beginFloorTransition() {
    if (this.isTransitioningFloor) return;
    this.isTransitioningFloor = true;
    this.processingTurn = true;
    if (this.stairsFloatHint) {
      this.stairsFloatHint.destroy();
      this.stairsFloatHint = null;
    }
    this.floor += 1;

    // Step 1: screen shake + fade ke hitam
    this.cameras.main.shake(200, 0.01);
    this.tweens.add({
      targets: this.overlayFade,
      alpha: 1,
      duration: 400,
      onComplete: () => {
        // Step 2: "DESCENDING..." text
        const descText = this.add
          .text(240, 210, 'DESCENDING...', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#888888',
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(305)
          .setAlpha(0);

        this.tweens.add({
          targets: descText,
          alpha: 1,
          duration: 200,
          onComplete: () => {
            // Step 3: "FLOOR X" teks besar
            const biome =
              this.floor <= 5
                ? '— THE CRYPT —'
                : this.floor <= 10
                  ? '— THE OVERGROWTH —'
                  : this.floor <= 15
                    ? '— THE FORGE —'
                    : '— THE ABYSS —';

            const floorText = this.add
              .text(240, 240, `FLOOR ${this.floor}`, {
                fontFamily: 'monospace',
                fontSize: '36px',
                color: '#f0c040',
              })
              .setOrigin(0.5)
              .setScrollFactor(0)
              .setDepth(305)
              .setScale(0.5);

            const biomeText = this.add
              .text(240, 278, biome, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#c8b8e8',
              })
              .setOrigin(0.5)
              .setScrollFactor(0)
              .setDepth(305)
              .setAlpha(0);

            this.tweens.add({
              targets: floorText,
              scale: 1.0,
              duration: 300,
              ease: 'Back.Out',
            });
            this.tweens.add({
              targets: biomeText,
              alpha: 1,
              duration: 300,
              delay: 150,
            });

            // Step 4: Build floor lalu fade in
            this.time.delayedCall(1000, () => {
              this.buildFloor(false);
              this.player.setVisible(true);
              this.player.setAlpha(1);
              this.markExplored();
              this.updateFog();
              this.refreshTileVisibility();
              this.refreshHUD();

              descText.destroy();
              floorText.destroy();
              biomeText.destroy();

              this.tweens.add({
                targets: this.overlayFade,
                alpha: 0,
                duration: 400,
                onComplete: () => {
                  this.isTransitioningFloor = false;
                  this.processingTurn = false;
                },
              });
            });
          },
        });
      },
    });
  }

  grantXp(amount, onDone) {
    this.playerXp += amount;
    const next = () => {
      const threshold = this.playerLevel * 30;
      if (this.playerXp < threshold) {
        this.refreshHUD();
        onDone();
        return;
      }
      this.playerXp -= threshold;
      this.playerLevel += 1;
      this.showLevelUpChoice(next);
    };
    next();
  }

  showLevelUpChoice(onDone) {
    this.playerStatPoints += 2;

    const burst = this.add
      .text(240, 200, `LEVEL ${this.playerLevel}!  +2 PTS`, {
        fontFamily: 'monospace',
        fontSize: '22px',
        color: '#f0c040',
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(340)
      .setScale(0.6);

    this.tweens.add({
      targets: burst,
      y: 160,
      scale: 1.0,
      duration: 400,
      ease: 'Back.Out',
      onComplete: () => {
        this.tweens.add({
          targets: burst,
          alpha: 0,
          y: 130,
          duration: 600,
          delay: 600,
          onComplete: () => burst.destroy(),
        });
      },
    });

    this.refreshHUD();
    onDone();
  }

  spendStatPoint(stat) {
    if (this.playerStatPoints <= 0) return;
    this.playerStatPoints--;
    if (stat === 'atk') this.playerAtk += 2;
    else if (stat === 'def') this.playerDef += 1;
    else if (stat === 'hp') {
      this.playerMaxHp += 8;
      this.playerHp += 8;
    }
    this.refreshHUD();
  }

  triggerGameOver() {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.processingTurn = true;
    for (const e of this.enemies) {
      this.tweens.killTweensOf(e.sprite);
      if (e.stateIcon) this.tweens.killTweensOf(e.stateIcon);
    }
    this.tweens.killTweensOf(this.player);
    this.tweens.add({
      targets: this.overlayFade,
      alpha: 1,
      duration: 500,
      onComplete: () => {
        this.gameOverTitle.setText('YOU DIED').setVisible(true);
        this.gameOverStats
          .setText(`Floor reached: ${this.floor}\nEnemies slain: ${this.enemiesSlain}`)
          .setVisible(true);
        this.gameOverRestart.setText('Press R to restart').setVisible(true);
        this.tweens.add({
          targets: this.gameOverRestart,
          alpha: { from: 1, to: 0.35 },
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }

  tweenPlayerToGrid(nx, ny, ox, oy, onComplete) {
    this.player.setPosition(ox * TILE + TILE / 2, oy * TILE + TILE / 2);
    this.tweens.add({
      targets: this.player,
      x: nx * TILE + TILE / 2,
      y: ny * TILE + TILE / 2,
      duration: MOVE_TWEEN_MS,
      ease: MOVE_EASE,
      onComplete: onComplete,
    });
  }

  playerHitFlash(onComplete) {
    let n = 0;
    const step = () => {
      if (n >= 3) {
        onComplete();
        return;
      }
      this.player.setTint(0xff0000);
      this.time.delayedCall(60, () => {
        this.player.clearTint();
        n++;
        step();
      });
    };
    step();
  }

  enemyHitFlash(sprite, onComplete) {
    let n = 0;
    const step = () => {
      if (n >= 2) {
        onComplete();
        return;
      }
      sprite.setTint(0xffffff);
      this.time.delayedCall(50, () => {
        sprite.clearTint();
        n++;
        step();
      });
    };
    step();
  }

  playPlayerAttackLunge(nx, ny, enemySprite, onComplete) {
    const ex = nx * TILE + TILE / 2;
    const ey = ny * TILE + TILE / 2;
    const px = this.player.x;
    const py = this.player.y;
    const ang = Math.atan2(ey - py, ex - px);
    const lx = px + Math.cos(ang) * 4;
    const ly = py + Math.sin(ang) * 4;

    let done = 0;
    const check = () => {
      done++;
      if (done === 2) onComplete();
    };

    this.tweens.add({
      targets: this.player,
      x: lx,
      y: ly,
      duration: 40,
      ease: MOVE_EASE,
      yoyo: true,
      onComplete: check,
    });

    this.enemyHitFlash(enemySprite, check);
  }

  playEnemyDeath(enemyData, onComplete) {
    if (enemyData.stateIcon) {
      this.tweens.killTweensOf(enemyData.stateIcon);
      enemyData.stateIcon.destroy();
      enemyData.stateIcon = null;
    }
    const s = enemyData.sprite;
    s.setTint(0xffffff);
    this.time.delayedCall(50, () => {
      s.clearTint();
      for (let i = 0; i < 4; i++) {
        const p = this.add.rectangle(s.x, s.y, 2, 2, 0xff0000).setDepth(55);
        this.tweens.add({
          targets: p,
          x: s.x + Phaser.Math.Between(-10, 10),
          y: s.y + Phaser.Math.Between(-10, 10),
          alpha: 0,
          duration: 350,
          onComplete: () => p.destroy(),
        });
      }
      this.tweens.add({
        targets: s,
        scaleX: 0,
        scaleY: 0,
        duration: 200,
        ease: MOVE_EASE,
        onComplete: () => {
          s.destroy();
          onComplete();
        },
      });
    });
  }

  applyPlayerDamage(amount, onAfterFx) {
    this.playerHp -= amount;
    this.refreshHUD();
    this.cameras.main.shake(SHAKE_HIT_MS, SHAKE_HIT_INTENSITY);
    this.playerHitFlash(() => {
      if (this.playerHp <= 0) {
        this.cameras.main.shake(SHAKE_DEATH_MS, SHAKE_DEATH_INTENSITY);
      }
      onAfterFx();
    });
  }

  tryPlayerMove(dx, dy) {
    const nx = this.px + dx;
    const ny = this.py + dy;
    if (nx < 0 || nx >= GW || ny < 0 || ny >= GH) return;
    if (this.grid[ny][nx] === 1) return;

    this.processingTurn = true;

    const targetEnemy = this.enemyAt(nx, ny);
    if (targetEnemy) {
      const dmg = Math.max(1, this.playerAtk);
      const ox = this.px;
      const oy = this.py;
      targetEnemy.hp -= dmg;
      this.spawnDamageNumber(nx, ny, `-${dmg}`, '#ffffff');
      if (targetEnemy.hp <= 0) {
        this.px = nx;
        this.py = ny;
        this.playEnemyDeath(targetEnemy, () => {
          this.enemiesSlain += 1;
          this.grantXp(10, () => {
            this.tweenPlayerToGrid(nx, ny, ox, oy, () => this.finishPlayerTurn());
          });
        });
      } else {
        this.playPlayerAttackLunge(nx, ny, targetEnemy.sprite, () => this.finishPlayerTurn());
      }
      return;
    }

    const ox = this.px;
    const oy = this.py;
    this.px = nx;
    this.py = ny;
    this.tweenPlayerToGrid(nx, ny, ox, oy, () => {
      if (this.stairs && this.px === this.stairs.gx && this.py === this.stairs.gy) {
        this.beginFloorTransition();
        return;
      }
      this.finishPlayerTurn();
    });
  }

  finishPlayerTurn() {
    this.markExplored();
    this.updateFog();
    this.refreshTileVisibility();
    this.refreshEnemyVisibility();

    this.runEnemyTurn(() => {
      this.turn++;
      this.refreshHUD();
      this.processingTurn = false;
      if (this.playerHp <= 0) {
        this.triggerGameOver();
      }
    });
  }

  runEnemyTurn(onAllEnemiesDone) {
    const runAt = (i) => {
      if (i >= this.enemies.length) {
        this.refreshEnemyVisibility();
        onAllEnemiesDone();
        return;
      }

      const e = this.enemies[i];
      if (e.hp <= 0) {
        runAt(i + 1);
        return;
      }

      const dist = manhattan(e.gx, e.gy, this.px, this.py);
      if (dist === 1) {
        this.spawnDamageNumber(this.px, this.py, `-${e.atk}`, '#ff4444');
        this.applyPlayerDamage(Math.max(1, e.atk - this.playerDef), () => {
          if (this.playerHp <= 0) {
            onAllEnemiesDone();
            return;
          }
          runAt(i + 1);
        });
        return;
      }

      const canSee = this.enemyCanSeePlayer(e);

      if (e.aiState === 'hunt') {
        if (canSee) {
          e.lastKnownPx = this.px;
          e.lastKnownPy = this.py;
          e.pathCacheTurn = -1000;
        } else {
          e.aiState = 'search';
          e.searchTurns = 0;
          e.roamStepsLeft = -1;
          e.cachedPath = [];
          e.pathCacheTurn = -1000;
          this.syncEnemyStateIcon(e);
        }
      }

      if (e.aiState === 'search') {
        if (canSee) {
          e.aiState = 'hunt';
          e.lastKnownPx = this.px;
          e.lastKnownPy = this.py;
          e.cachedPath = [];
          e.pathCacheTurn = -1000;
          this.syncEnemyStateIcon(e);
        } else {
          e.searchTurns++;
          if (e.searchTurns >= SEARCH_MAX_TURNS) {
            e.aiState = 'idle';
            e.patrolTick = 0;
            e.roamStepsLeft = -1;
            e.cachedPath = [];
            e.pathCacheTurn = -1000;
            this.syncEnemyStateIcon(e);
          }
        }
      }

      if (e.aiState === 'idle' && canSee) {
        e.aiState = 'hunt';
        e.lastKnownPx = this.px;
        e.lastKnownPy = this.py;
        e.cachedPath = [];
        e.pathCacheTurn = -1000;
        this.syncEnemyStateIcon(e);
      }

      if (e.aiState === 'idle') {
        e.patrolTick++;
        if (e.patrolTick < 2) {
          runAt(i + 1);
          return;
        }
        e.patrolTick = 0;
        const step = this.pickRandomPatrolStep(e);
        if (!step) {
          runAt(i + 1);
          return;
        }
        this.tweenEnemyStep(e, step.x, step.y, () => runAt(i + 1));
        return;
      }

      if (e.aiState === 'search') {
        if (e.gx === e.lastKnownPx && e.gy === e.lastKnownPy) {
          if (e.roamStepsLeft < 0) {
            e.roamStepsLeft = Phaser.Math.Between(3, 5);
          }
          if (e.roamStepsLeft > 0) {
            const step = this.pickRandomPatrolStep(e);
            if (!step) {
              runAt(i + 1);
              return;
            }
            e.roamStepsLeft--;
            this.tweenEnemyStep(e, step.x, step.y, () => runAt(i + 1));
            return;
          }
          runAt(i + 1);
          return;
        }

        const needRecalcS = this.turn - e.pathCacheTurn >= PATH_CACHE_TURNS;
        if (needRecalcS) {
          e.cachedPath = findPath(e.gx, e.gy, e.lastKnownPx, e.lastKnownPy, (x, y) =>
            this.isWalkableForPath(x, y, e.lastKnownPx, e.lastKnownPy, e),
          );
          e.pathCacheTurn = this.turn;
        }

        if (e.cachedPath.length === 0) {
          runAt(i + 1);
          return;
        }

        const nextS = e.cachedPath[0];
        if (manhattan(e.gx, e.gy, nextS.x, nextS.y) !== 1) {
          e.cachedPath = [];
          e.pathCacheTurn = -1000;
          runAt(i + 1);
          return;
        }

        if (!this.isWalkableForPath(nextS.x, nextS.y, e.lastKnownPx, e.lastKnownPy, e)) {
          e.cachedPath = [];
          e.pathCacheTurn = -1000;
          runAt(i + 1);
          return;
        }

        if (nextS.x === this.px && nextS.y === this.py) {
          this.spawnDamageNumber(this.px, this.py, `-${e.atk}`, '#ff4444');
          e.cachedPath = [];
          this.applyPlayerDamage(Math.max(1, e.atk - this.playerDef), () => {
            if (this.playerHp <= 0) {
              onAllEnemiesDone();
              return;
            }
            runAt(i + 1);
          });
          return;
        }

        const occS = this.enemyAt(nextS.x, nextS.y);
        if (occS && occS !== e) {
          e.cachedPath = [];
          e.pathCacheTurn = -1000;
          runAt(i + 1);
          return;
        }

        e.cachedPath = e.cachedPath.slice(1);
        if (e.cachedPath.length === 0) {
          e.pathCacheTurn = -1000;
        }

        this.tweenEnemyStep(e, nextS.x, nextS.y, () => runAt(i + 1));
        return;
      }

      const needRecalc = this.turn - e.pathCacheTurn >= PATH_CACHE_TURNS;
      if (needRecalc) {
        e.cachedPath = findPath(e.gx, e.gy, this.px, this.py, (x, y) =>
          this.isWalkableForPath(x, y, this.px, this.py, e),
        );
        e.pathCacheTurn = this.turn;
      }

      if (e.cachedPath.length === 0) {
        runAt(i + 1);
        return;
      }

      const next = e.cachedPath[0];
      const stepDist = manhattan(e.gx, e.gy, next.x, next.y);
      if (stepDist !== 1) {
        e.cachedPath = [];
        e.pathCacheTurn = -1000;
        runAt(i + 1);
        return;
      }

      if (!this.isWalkableForPath(next.x, next.y, this.px, this.py, e)) {
        e.cachedPath = [];
        e.pathCacheTurn = -1000;
        runAt(i + 1);
        return;
      }

      if (next.x === this.px && next.y === this.py) {
        this.spawnDamageNumber(this.px, this.py, `-${e.atk}`, '#ff4444');
        e.cachedPath = [];
        this.applyPlayerDamage(Math.max(1, e.atk - this.playerDef), () => {
          if (this.playerHp <= 0) {
            onAllEnemiesDone();
            return;
          }
          runAt(i + 1);
        });
        return;
      }

      const occ = this.enemyAt(next.x, next.y);
      if (occ && occ !== e) {
        e.cachedPath = [];
        e.pathCacheTurn = -1000;
        runAt(i + 1);
        return;
      }

      e.cachedPath = e.cachedPath.slice(1);
      if (e.cachedPath.length === 0) {
        e.pathCacheTurn = -1000;
      }

      this.tweenEnemyStep(e, next.x, next.y, () => runAt(i + 1));
    };

    runAt(0);
  }
}
