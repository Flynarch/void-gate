import Phaser from "phaser";

import {
  TILE,
  GW,
  GH,
  PLAYER_BASE_ATK,
  PLAYER_BASE_DEF,
  PLAYER_BASE_MAX_HP,
  ENEMY_BASE_ATK,
  ENEMY_BASE_HP,
  LOS_RADIUS,
  ICON_BOUNCE_MS,
  MOVE_TWEEN_MS,
  MOVE_EASE,
  SHAKE_HIT_MS,
  SHAKE_HIT_INTENSITY,
  SHAKE_DEATH_MS,
  SHAKE_DEATH_INTENSITY,
} from "../data/constants.js";
import { ITEMS, rollLoot } from "../data/items.js";
import { generateDungeon } from "../utils/dungeonGenerator.js";
import { chebyshev, hasLOS } from "../utils/pathfinding.js";
import { runEnemyTurn } from "../systems/EnemyAI.js";

export class GameScene extends Phaser.Scene {
  constructor() {
    super("GameScene");
  }

  create() {
    this.cameras.main.setBackgroundColor("#000000");
    const W = this.scale.width;
    const H = this.scale.height;
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
    this.playerGold = 0;
    this.groundItems = [];
    this.floorStates = new Map();

    this.tileSprites = [];
    this.enemies = [];
    this.fogLayer = this.add.graphics();
    this.stairs = null;
    this.stairsUp = null;
    this.stairsFloatHint = null;

    this.overlayFade = this.add
      .rectangle(W/2, H/2, W, H, 0x000000, 0)
      .setScrollFactor(0)
      .setDepth(300);

    this.uiHpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.uiHpBarBg.fillStyle(0x222222, 1);
    this.uiHpBarBg.fillRect(10, 10, 102, 10);
    this.uiXpBarBg = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.uiXpBarBg.fillStyle(0x222222, 1);
    this.uiXpBarBg.fillRect(10, 24, 102, 6);
    this.uiHpBar = this.add.graphics().setScrollFactor(0).setDepth(101);
    this.uiXpBar = this.add.graphics().setScrollFactor(0).setDepth(101);

    this.uiHpText = this.add
      .text(10, 34, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#ffffff",
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.uiAtkText = this.add
      .text(10, 48, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#cccccc",
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.uiDefText = this.add
      .text(10, 62, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#cccccc",
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.uiTurnText = this.add
      .text(10, 76, "TURN 1", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#aaaaaa",
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.uiGoldText = this.add
      .text(10, 90, "Gold: 0", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#f0c040",
      })
      .setScrollFactor(0)
      .setDepth(102);
    this.uiFloorLabel = this.add
      .text(W - 10, 10, "FLOOR 1  LV 1", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#ffffff",
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.uiProfileBtn = this.add
      .text(W - 10, H - 10, "[P] PROFILE", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#9988cc",
        backgroundColor: "#12121f",
        padding: { x: 6, y: 3 },
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(102)
      .setInteractive({ useHandCursor: true });
    this.uiProfileBtn.on("pointerdown", (pointer, localX, localY, event) => {
      if (event) event.stopPropagation();
      this.toggleProfileOverlay();
    });
    this.uiProfileBtn.on("pointerover", () =>
      this.uiProfileBtn.setStyle({ color: "#f0c040" }),
    );
    this.uiProfileBtn.on("pointerout", () =>
      this.uiProfileBtn.setStyle({ color: "#9988cc" }),
    );
    this.uiProfileHint = this.add
      .text(W - 10, H - 26, "Press P", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: "#b8a8e8",
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
      .text(W - 10, H - 28, "!", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#ff4444",
        fontStyle: "bold",
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setDepth(103)
      .setVisible(false);
    this.profileOverlayOpen = false;
    this.profileOverlayBg = this.add
      .rectangle(W/2, H/2, 280, 300, 0x0a0a1e, 0.95)
      .setScrollFactor(0)
      .setDepth(200)
      .setVisible(false)
      .setStrokeStyle(1, 0x4a3a7a);
    this.profileOverlayTitle = this.add
      .text(W/2, H/2 - 130, "CHARACTER", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f0c040",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false);
    this.profileStatTexts = {};
    const statRows = [
      { key: "hp", label: "MAX HP", y: H/2 - 90 },
      { key: "atk", label: "ATK", y: H/2 - 65 },
      { key: "def", label: "DEF", y: H/2 - 40 },
      { key: "level", label: "LEVEL", y: H/2 - 15 },
      { key: "pts", label: "POINTS", y: H/2 + 15 },
    ];
    statRows.forEach((row) => {
      const lbl = this.add
        .text(W/2 - 100, row.y, `${row.label}:`, {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#9988cc",
        })
        .setScrollFactor(0)
        .setDepth(201)
        .setVisible(false);
      const val = this.add
        .text(W/2, row.y, "—", {
          fontFamily: "monospace",
          fontSize: "13px",
          color: "#ffffff",
        })
        .setScrollFactor(0)
        .setDepth(201)
        .setVisible(false);
      this.profileStatTexts[row.key] = { lbl, val };
    });
    this.profileBtnAtk = this.add
      .text(W/2, H/2 + 50, "[+] SPEND ON ATK  (+2)", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f0c040",
        backgroundColor: "#1a1a2e",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.profileBtnDef = this.add
      .text(W/2, H/2 + 80, "[+] SPEND ON DEF  (+1)", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f0c040",
        backgroundColor: "#1a1a2e",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.profileBtnHp = this.add
      .text(W/2, H/2 + 110, "[+] SPEND ON HP   (+8)", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#f0c040",
        backgroundColor: "#1a1a2e",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.profileCloseBtn = this.add
      .text(W/2, H/2 + 145, "[ CLOSE ]", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#888888",
        backgroundColor: "#111118",
        padding: { x: 8, y: 5 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(201)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });
    this.profileBtnAtk.on("pointerdown", (pointer, localX, localY, event) => {
      if (event) event.stopPropagation();
      this.spendStatPoint("atk");
      this.refreshProfileOverlay();
    });
    this.profileBtnDef.on("pointerdown", (pointer, localX, localY, event) => {
      if (event) event.stopPropagation();
      this.spendStatPoint("def");
      this.refreshProfileOverlay();
    });
    this.profileBtnHp.on("pointerdown", (pointer, localX, localY, event) => {
      if (event) event.stopPropagation();
      this.spendStatPoint("hp");
      this.refreshProfileOverlay();
    });
    this.profileCloseBtn.on("pointerdown", (pointer, localX, localY, event) => {
      if (event) event.stopPropagation();
      this.toggleProfileOverlay();
    });
    [this.profileBtnAtk, this.profileBtnDef, this.profileBtnHp].forEach(
      (btn) => {
        btn.on("pointerover", () =>
          btn.setStyle({ backgroundColor: "#2a2a44" }),
        );
        btn.on("pointerout", () =>
          btn.setStyle({ backgroundColor: "#1a1a2e" }),
        );
      },
    );

    this.gameOverTitle = this.add
      .text(W/2, H/2 - 30, "", {
        fontFamily: "monospace",
        fontSize: "36px",
        color: "#ff4444",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(320)
      .setVisible(false);
    this.gameOverStats = this.add
      .text(W/2, H/2 + 15, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        align: "center",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(320)
      .setVisible(false);
    this.gameOverRestart = this.add
      .text(W/2, H/2 + 70, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#aaaaaa",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(320)
      .setVisible(false)
      .setInteractive({ useHandCursor: true });

    this.gameOverRestart.on("pointerdown", () => {
      if (this.isGameOver) this.scene.restart();
    });
    this.gameOverRestart.on("pointerover", () =>
      this.gameOverRestart.setStyle({ color: "#ffffff" }),
    );
    this.gameOverRestart.on("pointerout", () =>
      this.gameOverRestart.setStyle({ color: "#aaaaaa" }),
    );

    // Force initial layout
    this.time.delayedCall(50, () => {
      const w = this.scale.width;
      const h = this.scale.height;
      this.repositionUI(w, h);
    });

    this.scale.on('resize', (gameSize) => {
      this.repositionUI(gameSize.width, gameSize.height);
    });

    this.buildFloor(true);
    this.refreshHUD();

    this.input.keyboard.on("keydown", (e) => {
      if (e.repeat) return;
      if ((e.key === "r" || e.key === "R") && this.isGameOver) {
        this.scene.restart();
        return;
      }
      if (e.key === "p" || e.key === "P") {
        this.toggleProfileOverlay();
        return;
      } else if (e.key === "Escape") {
        if (this.profileOverlayOpen) {
          this.toggleProfileOverlay();
          return;
        }
      }
      if (this.playerHp <= 0 || this.isGameOver || this.isTransitioningFloor)
        return;
      if (this.processingTurn) return;

      let dx = 0;
      let dy = 0;
      if (e.key === "w" || e.key === "W" || e.key === "ArrowUp") dy = -1;
      else if (e.key === "s" || e.key === "S" || e.key === "ArrowDown") dy = 1;
      else if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") dx = -1;
      else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") dx = 1;
      else return;

      this.tryPlayerMove(dx, dy);
    });

    // Click to move
    this.input.on("pointerdown", (pointer) => {
      if (this.processingTurn) return;
      if (this.isTransitioningFloor) return;
      if (this.isGameOver) return;
      if (this.profileOverlayOpen) return;

      // Convert screen coords ke world coords
      const cam = this.cameras.main;
      const worldX = pointer.x / cam.zoom + cam.scrollX;
      const worldY = pointer.y / cam.zoom + cam.scrollY;
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
    for (const item of this.groundItems || []) {
      if (item.sprite) item.sprite.destroy();
    }
    this.groundItems = [];
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
        e.stateIcon = null;
      }
      e.sprite.destroy();
    }
    this.enemies = [];

    if (this.stairs) {
      this.tweens.killTweensOf(this.stairs);
      this.stairs.destroy();
      this.stairs = null;
    }
    if (this.stairsUp) {
      this.tweens.killTweensOf(this.stairsUp);
      this.stairsUp.destroy();
      this.stairsUp = null;
    }
    if (this.stairsFloatHint) {
      this.stairsFloatHint.destroy();
      this.stairsFloatHint = null;
    }

    const saved = this.floorStates && this.floorStates.get(this.floor);
    if (saved) {
      this.grid = saved.grid;
      this.rooms = saved.rooms;
      this.explored = saved.explored.map((row) => [...row]);

      // Render tiles from saved grid
      for (let y = 0; y < GH; y++) {
        this.tileSprites[y] = [];
        for (let x = 0; x < GW; x++) {
          const key = this.grid[y][x] === 1 ? "wall" : "floor";
          const s = this.add.image(x * TILE, y * TILE, key).setOrigin(0, 0);
          this.tileSprites[y][x] = s;
        }
      }

      const r0 = this.rooms[0];
      this.px = r0.cx;
      this.py = r0.cy;

      if (firstBuild) {
        this.player = this.physics.add.sprite(
          this.px * TILE + TILE / 2,
          this.py * TILE + TILE / 2,
          "player",
        );
        this.player.setDepth(58);
        this.player.body.setSize(16, 16);
        this.player.setCollideWorldBounds(false);
      } else {
        this.player.setPosition(
          this.px * TILE + TILE / 2,
          this.py * TILE + TILE / 2,
        );
      }

      this.player.setVisible(true);
      this.player.setAlpha(1);
      this.player.setScale(1);
      this.player.clearTint();

      this.player.setDepth(58);

      this.cameras.main.startFollow(this.player, true, 1, 1);
      this.cameras.main.centerOn(this.player.x, this.player.y);

      // Restore stairs down
      if (saved.stairsGx !== null && saved.stairsGy !== null) {
        this.stairs = this.add
          .text(
            saved.stairsGx * TILE + TILE / 2,
            saved.stairsGy * TILE + TILE / 2,
            "▼",
            {
              fontFamily: "monospace",
              fontSize: "16px",
              color: "#f0c040",
            },
          )
          .setOrigin(0.5)
          .setDepth(54);
        this.tweens.add({
          targets: this.stairs,
          alpha: { from: 0.6, to: 1 },
          duration: 800,
          yoyo: true,
          repeat: -1,
        });
        this.stairs.gx = saved.stairsGx;
        this.stairs.gy = saved.stairsGy;
      }

      // Restore stairs up
      if (saved.stairsUpGx !== null) {
        if (this.stairsUp) {
          this.tweens.killTweensOf(this.stairsUp);
          this.stairsUp.destroy();
          this.stairsUp = null;
        }
        const upColor = saved.stairsUpLocked ? '#333355' : '#88ddff';
        this.stairsUp = this.add.text(
          saved.stairsUpGx * TILE + TILE / 2,
          saved.stairsUpGy * TILE + TILE / 2,
          '▲',
          { fontFamily: 'monospace', fontSize: '16px', color: upColor }
        ).setOrigin(0.5).setDepth(54).setVisible(false);
        this.stairsUp.gx = saved.stairsUpGx;
        this.stairsUp.gy = saved.stairsUpGy;
        this.stairsUp.locked = saved.stairsUpLocked;
        if (!this.stairsUp.locked) {
          this.tweens.add({
            targets: this.stairsUp,
            alpha: { from: 0.6, to: 1 },
            duration: 800, yoyo: true, repeat: -1,
          });
        }
      }

      // Restore stairs float hint (only floor 1)
      this.stairsFloatHint = null;
      if (this.stairs && this.floor <= 1) {
        this.stairsFloatHint = this.add
          .text(
            this.stairs.gx * TILE + TILE / 2,
            this.stairs.gy * TILE - 10,
            "▼ descend",
            {
              fontFamily: "monospace",
              fontSize: "9px",
              color: "#f0c040",
            },
          )
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

      // Restore enemies
      this.enemies = [];
      for (const es of saved.enemyStates || []) {
        if (es.dead) continue;
        const spr = this.physics.add.sprite(
          es.gx * TILE + TILE / 2,
          es.gy * TILE + TILE / 2,
          "enemy",
        );
        spr.setDepth(56);
        spr.body.setSize(16, 16);
        this.enemies.push({
          sprite: spr,
          gx: es.gx,
          gy: es.gy,
          hp: es.hp,
          atk: es.atk,
          cachedPath: [],
          pathCacheTurn: -1000,
          aiState: es.aiState,
          lastKnownPx: es.lastKnownPx,
          lastKnownPy: es.lastKnownPy,
          patrolTick: 0,
          searchTurns: 0,
          roamStepsLeft: -1,
          stateIcon: null,
        });
      }

      // Restore ground items
      for (const gi of saved.groundItemStates || []) {
        if (ITEMS[gi.id]) this.spawnGroundItem(gi.gx, gi.gy, { ...ITEMS[gi.id] });
      }

      // Render visibility based on restored explored
      this.updateFog();
      this.refreshTileVisibility();
      this.refreshEnemyVisibility();

      return;
    }

    const rng = Phaser.Math.RND;
    const { grid, rooms } = generateDungeon(rng);
    this.grid = grid;
    this.rooms = rooms;

    for (let y = 0; y < GH; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < GW; x++) {
        const key = grid[y][x] === 1 ? "wall" : "floor";
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
      this.player = this.physics.add.sprite(
        this.px * TILE + TILE / 2,
        this.py * TILE + TILE / 2,
        "player",
      );
      this.player.setDepth(58);
      this.player.body.setSize(16, 16);
      this.player.setCollideWorldBounds(false);
    } else {
      this.player.setPosition(
        this.px * TILE + TILE / 2,
        this.py * TILE + TILE / 2,
      );
    }

    this.player.setPosition(
      this.px * TILE + TILE / 2,
      this.py * TILE + TILE / 2,
    );
    this.player.setVisible(true);
    this.player.setDepth(58);
    this.player.setAlpha(1);
    this.player.setScale(1);
    this.player.clearTint();
    this.cameras.main.startFollow(this.player, true, 1, 1);
    this.cameras.main.centerOn(this.player.x, this.player.y);

    const enemyHp = ENEMY_BASE_HP + (this.floor - 1) * 3;
    const enemyAtk = ENEMY_BASE_ATK + (this.floor - 1);
    const enemyCountTarget = Math.min(3 + this.floor, 12);
    const safeRoom = this.rooms[0];
    const floorTiles = [];
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        if (grid[y][x] !== 0) continue;
        if (x === this.px && y === this.py) continue;
        // Exclude safe room (rooms[0]) sepenuhnya
        if (x >= safeRoom.x && x < safeRoom.x + safeRoom.w &&
            y >= safeRoom.y && y < safeRoom.y + safeRoom.h) continue;
        floorTiles.push({ x, y });
      }
    }
    Phaser.Math.RND.shuffle(floorTiles);
    const spawnCount = Math.min(enemyCountTarget, floorTiles.length);

    for (let i = 0; i < spawnCount; i++) {
      const pos = floorTiles[i];
      const spr = this.physics.add.sprite(
        pos.x * TILE + TILE / 2,
        pos.y * TILE + TILE / 2,
        "enemy",
      );
      spr.setDepth(56);
      spr.body.setSize(16, 16);
      this.enemies.push({
        sprite: spr,
        gx: pos.x,
        gy: pos.y,
        hp: enemyHp,
        atk: enemyAtk,
        cachedPath: [],
        pathCacheTurn: -1000,
        aiState: "idle",
        aiStatePrev: "idle",
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
      .text(stairPos.x * TILE + TILE / 2, stairPos.y * TILE + TILE / 2, "▼", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#f0c040",
      })
      .setOrigin(0.5)
      .setDepth(54);
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
        .text(
          stairPos.x * TILE + TILE / 2,
          stairPos.y * TILE - 10,
          "▼ descend",
          {
            fontFamily: "monospace",
            fontSize: "9px",
            color: "#f0c040",
          },
        )
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

    // Spawn stairs up di room pertama
    const upRoom = this.rooms[0];
    const upColor = this.floor > 1 ? '#88ddff' : '#333355';
    this.stairsUp = this.add.text(
      upRoom.cx * TILE + TILE / 2,
      upRoom.cy * TILE + TILE / 2,
      '▲',
      { fontFamily: 'monospace', fontSize: '16px', color: upColor }
    ).setOrigin(0.5).setDepth(54).setVisible(false);

    this.stairsUp.gx = upRoom.cx;
    this.stairsUp.gy = upRoom.cy;
    this.stairsUp.locked = this.floor <= 1;

    if (!this.stairsUp.locked) {
      this.tweens.add({
        targets: this.stairsUp,
        alpha: { from: 0.6, to: 1 },
        duration: 800, yoyo: true, repeat: -1,
      });
    }

    // Bug 3: Chest di room tengah, posisi aman
    if (this.rooms.length >= 3) {
      const midIdx = Math.floor(this.rooms.length / 2);
      const chestRoom = this.rooms[midIdx];
      const cx = chestRoom.cx;
      const cy = chestRoom.cy;
      if (this.grid[cy] && this.grid[cy][cx] === 0) {
        const chestItem = rollLoot();
        this.spawnGroundItem(cx, cy, chestItem);
      }
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

  syncEnemyStateIcon(e) {
    if (e.stateIcon) {
      this.tweens.killTweensOf(e.stateIcon);
      e.stateIcon.destroy();
      e.stateIcon = null;
    }
    if (e.aiState === "hunt") {
      e.stateIcon = this.add
        .text(e.sprite.x, e.sprite.y - 12, "!", {
          fontFamily: "monospace",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#ff4444",
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
        ease: "Sine.InOut",
      });
    } else if (e.aiState === "search") {
      e.stateIcon = this.add
        .text(e.sprite.x, e.sprite.y - 12, "?", {
          fontFamily: "monospace",
          fontSize: "14px",
          fontStyle: "bold",
          color: "#ffff00",
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
        ease: "Sine.InOut",
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
    if (this.uiGoldText) this.uiGoldText.setText(`Gold: ${this.playerGold}`);
    const hasPts = this.playerStatPoints > 0;
    if (this.uiProfileBadge) this.uiProfileBadge.setVisible(hasPts);
    if (this.uiProfileBtn) {
      this.uiProfileBtn.setStyle({
        color: hasPts ? "#ff8844" : "#9988cc",
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
      pts: `${this.playerStatPoints}${hasPts ? "  ← UNSPENT!" : ""}`,
    };

    Object.entries(vals).forEach(([key, v]) => {
      if (this.profileStatTexts[key]) {
        this.profileStatTexts[key].val.setText(v);
        if (key === "pts") {
          this.profileStatTexts[key].val.setStyle({
            color: hasPts ? "#ff8844" : "#888888",
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
        if (
          chebyshev(this.px, this.py, x, y) <= LOS_RADIUS &&
          hasLOS(this.grid, this.px, this.py, x, y)
        ) {
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
          // Belum dieksplorasi = Hitam pekat
          g.fillStyle(0x000000, 1);
          g.fillRect(x * TILE, y * TILE, TILE, TILE);
        } else if (!this.playerCanSeeTile(x, y)) {
          // Sudah dieksplorasi tapi di luar pandangan (Memory) = Hitam semi-transparan
          g.fillStyle(0x000000, 0.6);
          g.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    this.fogLayer.setDepth(50);
  }

  refreshTileVisibility() {
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const s = this.tileSprites[y][x];
        if (!this.explored[y][x]) {
          s.setVisible(false);
        } else {
          // Kembalikan lantai ke normal, efek gelap diurus oleh fogLayer
          s.setVisible(true);
          s.setAlpha(1);
          s.clearTint();
        }
      }
    }

    if (this.stairsFloatHint && this.stairs) {
      this.stairsFloatHint.setVisible(
        this.playerCanSeeTile(this.stairs.gx, this.stairs.gy),
      );
    }
    if (this.stairs) {
      this.stairs.setVisible(
        this.playerCanSeeTile(this.stairs.gx, this.stairs.gy),
      );
    }
    if (this.stairsUp) {
      this.stairsUp.setVisible(
        this.playerCanSeeTile(this.stairsUp.gx, this.stairsUp.gy),
      );
    }

    for (const item of this.groundItems || []) {
      // Item hanya terlihat jika ada di jarak pandang
      const vis =
        this.explored[item.gy] &&
        this.explored[item.gy][item.gx] &&
        this.playerCanSeeTile(item.gx, item.gy);
      item.sprite.setVisible(!!vis);
    }
  }

  refreshEnemyVisibility() {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      // Musuh hanya terlihat jika ada di jarak pandang
      const vis =
        this.explored[e.gy] &&
        this.explored[e.gy][e.gx] &&
        this.playerCanSeeTile(e.gx, e.gy);
      e.sprite.setVisible(!!vis);
      if (e.stateIcon) e.stateIcon.setVisible(!!vis);
    }
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
    return (
      this.enemies.find((e) => e.hp > 0 && e.gx === tx && e.gy === ty) || null
    );
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
        fontFamily: "monospace",
        fontSize: "12px",
        fontStyle: "bold",
        color,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: t,
      y: t.y - 28,
      alpha: { from: 1, to: 0 },
      duration: 600,
      ease: "Sine.Out",
      onComplete: () => t.destroy(),
    });
  }

  spawnFloatingText(tx, ty, text, color) {
    const t = this.add
      .text(tx * TILE + TILE / 2, ty * TILE + TILE / 2, text, {
        fontFamily: "monospace",
        fontSize: "12px",
        color,
      })
      .setOrigin(0.5)
      .setDepth(60);
    this.tweens.add({
      targets: t,
      y: t.y - 28,
      alpha: { from: 1, to: 0 },
      duration: 600,
      ease: "Sine.Out",
      onComplete: () => t.destroy(),
    });
  }

  spawnGroundItem(x, y, item) {
    const sprite = this.add
      .text(x * TILE + TILE / 2, y * TILE + TILE / 2, item.char, {
        fontFamily: "monospace",
        fontSize: "14px",
        color: item.color,
      })
      .setOrigin(0.5)
      .setDepth(45);

    this.tweens.add({
      targets: sprite,
      y: sprite.y - 2,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.InOut",
    });

    this.groundItems.push({ ...item, gx: x, gy: y, sprite });
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
        .rectangle(
          p.x * TILE + TILE / 2,
          p.y * TILE + TILE / 2,
          4,
          4,
          0x9988cc,
          0.6,
        )
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

  saveCurrentFloorState() {
    const enemyStates = (this.enemies || []).map((e) => ({
      gx: e.gx,
      gy: e.gy,
      hp: e.hp,
      atk: e.atk,
      aiState: e.aiState,
      lastKnownPx: e.lastKnownPx,
      lastKnownPy: e.lastKnownPy,
      dead: e.hp <= 0,
    }));

    const groundItemStates = (this.groundItems || []).map((i) => ({
      gx: i.gx,
      gy: i.gy,
      id: i.id,
    }));

    this.floorStates.set(this.floor, {
      enemyStates,
      explored: (this.explored || []).map((row) => [...row]),
      grid: this.grid,
      rooms: this.rooms,
      stairsGx: this.stairs ? this.stairs.gx : null,
      stairsGy: this.stairs ? this.stairs.gy : null,
      stairsUpGx: this.stairsUp ? this.stairsUp.gx : null,
      stairsUpGy: this.stairsUp ? this.stairsUp.gy : null,
      stairsUpLocked: this.stairsUp ? this.stairsUp.locked : true,
      groundItemStates,
    });
  }

  beginAscendTransition() {
    if (this.isTransitioningFloor) return;
    this.isTransitioningFloor = true;
    this.processingTurn = true;
    this.saveCurrentFloorState();
    
    const targetFloor = this.floor - 1;
    const targetState = this.floorStates.get(targetFloor);
    
    // Spawn di stairs DOWN floor tujuan (yang tersimpan)
    const spawnX = targetState ? targetState.stairsGx : null;
    const spawnY = targetState ? targetState.stairsGy : null;

    this.cameras.main.shake(200, 0.01);
    this.tweens.add({
      targets: this.overlayFade, alpha: 1, duration: 400,
      onComplete: () => {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        const ascText = this.add.text(cx, cy - 30, 'ASCENDING...', {
          fontFamily: 'monospace', fontSize: '16px', color: '#88ddff'
        }).setOrigin(0.5).setScrollFactor(0).setDepth(305).setAlpha(0);

        this.tweens.add({
          targets: ascText, alpha: 1, duration: 200,
          onComplete: () => {
            const floorText = this.add.text(cx, cy,
              `FLOOR ${targetFloor}`, {
              fontFamily: 'monospace', fontSize: '36px', color: '#88ddff'
            }).setOrigin(0.5).setScrollFactor(0).setDepth(305).setScale(0.5);

            this.tweens.add({
              targets: floorText, scale: 1.0,
              duration: 300, ease: 'Back.Out'
            });

            this.time.delayedCall(1000, () => {
              this.floor = targetFloor;
              this.buildFloor(false);
              
              if (spawnX !== null && spawnY !== null
                  && spawnX >= 0 && spawnX < GW
                  && spawnY >= 0 && spawnY < GH) {
                this.px = spawnX;
                this.py = spawnY;
                this.player.setPosition(
                  spawnX * TILE + TILE / 2,
                  spawnY * TILE + TILE / 2
                );
                this.cameras.main.centerOn(
                  spawnX * TILE + TILE / 2,
                  spawnY * TILE + TILE / 2
                );
              }
              this.player.setVisible(true);
              this.player.setAlpha(1);
              this.markExplored();
              this.updateFog();
              this.refreshTileVisibility();
              this.refreshHUD();
              ascText.destroy();
              floorText.destroy();
              this.tweens.add({
                targets: this.overlayFade, alpha: 0, duration: 400,
                onComplete: () => {
                  this.isTransitioningFloor = false;
                  this.processingTurn = false;
                }
              });
            });
          }
        });
      }
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
    this.saveCurrentFloorState();
    this.floor += 1;

    // Step 1: screen shake + fade ke hitam
    this.cameras.main.shake(200, 0.01);
    this.tweens.add({
      targets: this.overlayFade,
      alpha: 1,
      duration: 400,
      onComplete: () => {
        const cx = this.scale.width / 2;
        const cy = this.scale.height / 2;
        // Step 2: "DESCENDING..." text
        const descText = this.add
          .text(cx, cy - 30, "DESCENDING...", {
            fontFamily: "monospace",
            fontSize: "16px",
            color: "#888888",
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
                ? "— THE CRYPT —"
                : this.floor <= 10
                  ? "— THE OVERGROWTH —"
                  : this.floor <= 15
                    ? "— THE FORGE —"
                    : "— THE ABYSS —";

            const floorText = this.add
              .text(cx, cy, `FLOOR ${this.floor}`, {
                fontFamily: "monospace",
                fontSize: "36px",
                color: "#f0c040",
              })
              .setOrigin(0.5)
              .setScrollFactor(0)
              .setDepth(305)
              .setScale(0.5);

            const biomeText = this.add
              .text(cx, cy + 38, biome, {
                fontFamily: "monospace",
                fontSize: "14px",
                color: "#c8b8e8",
              })
              .setOrigin(0.5)
              .setScrollFactor(0)
              .setDepth(305)
              .setAlpha(0);

            this.tweens.add({
              targets: floorText,
              scale: 1.0,
              duration: 300,
              ease: "Back.Out",
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
              this.player.setDepth(58);
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
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    const burst = this.add
      .text(cx, cy - 40, `LEVEL ${this.playerLevel}!  +2 PTS`, {
        fontFamily: "monospace",
        fontSize: "22px",
        color: "#f0c040",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(340)
      .setScale(0.6);
      
    this.burstLevelUp = burst;

    this.tweens.add({
      targets: burst,
      y: cy - 80,
      scale: 1.0,
      duration: 400,
      ease: "Back.Out",
      onComplete: () => {
        this.tweens.add({
          targets: burst,
          alpha: 0,
          y: cy - 110,
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
    if (stat === "atk") this.playerAtk += 2;
    else if (stat === "def") this.playerDef += 1;
    else if (stat === "hp") {
      this.playerMaxHp += 8;
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
        this.gameOverTitle.setText("YOU DIED").setVisible(true);
        this.gameOverStats
          .setText(
            `Floor reached: ${this.floor}\nEnemies slain: ${this.enemiesSlain}`,
          )
          .setVisible(true);
        this.gameOverRestart.setText("Press R to restart").setVisible(true);
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
          if (Math.random() < 0.4) {
            const item = rollLoot();
            this.spawnGroundItem(enemyData.gx, enemyData.gy, item);
          }
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
      this.spawnDamageNumber(nx, ny, `-${dmg}`, "#ffffff");
      if (targetEnemy.hp <= 0) {
        this.px = nx;
        this.py = ny;
        this.playEnemyDeath(targetEnemy, () => {
          this.enemiesSlain += 1;
          this.grantXp(10, () => {
            this.tweenPlayerToGrid(nx, ny, ox, oy, () =>
              this.finishPlayerTurn(),
            );
          });
        });
      } else {
        this.playPlayerAttackLunge(nx, ny, targetEnemy.sprite, () =>
          this.finishPlayerTurn(),
        );
      }
      return;
    }

    const ox = this.px;
    const oy = this.py;
    this.px = nx;
    this.py = ny;
    this.tweenPlayerToGrid(nx, ny, ox, oy, () => {
      // Pickup ground item
      const itemIdx = this.groundItems.findIndex(
        (i) => i.gx === this.px && i.gy === this.py,
      );
      if (itemIdx !== -1) {
        const item = this.groundItems[itemIdx];
        item.sprite.destroy();
        this.groundItems.splice(itemIdx, 1);
        item.onUse(this);
        this.spawnDamageNumber(this.px, this.py, item.name, item.color);
      }
      if (
        this.stairs &&
        this.px === this.stairs.gx &&
        this.py === this.stairs.gy
      ) {
        this.beginFloorTransition();
        return;
      }
      if (this.stairsUp && this.px === this.stairsUp.gx
          && this.py === this.stairsUp.gy) {
        if (this.stairsUp.locked) {
          this.spawnFloatingText(this.px, this.py,
            'Cannot ascend yet!', '#888888');
          this.finishPlayerTurn();
          return;
        }
        this.beginAscendTransition();
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

    runEnemyTurn(this, () => {
      this.turn++;
      this.refreshHUD();
      this.processingTurn = false;
      if (this.playerHp <= 0) {
        this.triggerGameOver();
      }
    });
  }

  repositionUI(w, h) {
    if (this.overlayFade) {
      this.overlayFade.setPosition(w/2, h/2);
      this.overlayFade.width = w;
      this.overlayFade.height = h;
    }
    if (this.uiFloorLabel) this.uiFloorLabel.setPosition(w - 10, 10);
    if (this.uiProfileBtn) this.uiProfileBtn.setPosition(w - 10, h - 10);
    if (this.uiProfileHint && this.uiProfileHint.active) this.uiProfileHint.setPosition(w - 10, h - 26);
    if (this.uiProfileBadge) this.uiProfileBadge.setPosition(w - 10, h - 28);
    
    if (this.profileOverlayBg) {
      this.profileOverlayBg.setPosition(w/2, h/2);
      this.profileOverlayBg.width = 280;
      this.profileOverlayBg.height = 320;
    }
    if (this.profileOverlayTitle) this.profileOverlayTitle.setPosition(w/2, h/2 - 130);

    if (this.profileStatTexts) {
      const statOffsets = [-90, -65, -40, -15, 20];
      Object.keys(this.profileStatTexts).forEach((key, i) => {
        const row = this.profileStatTexts[key];
        if (row.lbl) row.lbl.setPosition(w/2 - 100, h/2 + statOffsets[i]);
        if (row.val) row.val.setPosition(w/2, h/2 + statOffsets[i]);
      });
    }

    if (this.profileBtnAtk) this.profileBtnAtk.setPosition(w/2, h/2 + 60);
    if (this.profileBtnDef) this.profileBtnDef.setPosition(w/2, h/2 + 95);
    if (this.profileBtnHp) this.profileBtnHp.setPosition(w/2, h/2 + 130);
    if (this.profileCloseBtn) this.profileCloseBtn.setPosition(w/2, h/2 + 165);

    if (this.gameOverTitle) this.gameOverTitle.setPosition(w/2, h/2 - 30);
    if (this.gameOverStats) this.gameOverStats.setPosition(w/2, h/2 + 15);
    if (this.gameOverRestart) this.gameOverRestart.setPosition(w/2, h/2 + 70);
    
    if (this.burstLevelUp && this.burstLevelUp.active) {
      this.burstLevelUp.setPosition(w/2, this.burstLevelUp.y);
    }

    if (this.player && this.player.active) {
      this.cameras.main.centerOn(this.player.x, this.player.y);
    }
  }
}
