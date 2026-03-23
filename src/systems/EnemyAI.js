import Phaser from "phaser";
import { GW, GH, ENEMY_DETECT_RADIUS, SEARCH_MAX_TURNS, PATH_CACHE_TURNS } from "../data/constants.js";
import { findPath, hasLOS, chebyshev, manhattan } from "../utils/pathfinding.js";

export function enemyCanSeePlayer(scene, e) {
  if (chebyshev(e.gx, e.gy, scene.px, scene.py) > ENEMY_DETECT_RADIUS)
    return false;
  return hasLOS(scene.grid, e.gx, e.gy, scene.px, scene.py);
}

export function pickRandomPatrolStep(scene, e) {
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
    if (scene.grid[ny][nx] !== 0) continue;
    
    const safe = scene.rooms[0];
    if (nx >= safe.x && nx < safe.x + safe.w &&
        ny >= safe.y && ny < safe.y + safe.h) continue;

    if (nx === scene.px && ny === scene.py) continue;
    if (scene.enemyAt(nx, ny)) continue;
    return { x: nx, y: ny };
  }
  return null;
}

export function runEnemyTurn(scene, onAllEnemiesDone) {
  const runAt = (i) => {
    if (i >= scene.enemies.length) {
      scene.refreshEnemyVisibility();
      onAllEnemiesDone();
      return;
    }

    const e = scene.enemies[i];
    if (e.hp <= 0) {
      runAt(i + 1);
      return;
    }

    const dist = manhattan(e.gx, e.gy, scene.px, scene.py);
    if (dist === 1) {
      scene.spawnDamageNumber(scene.px, scene.py, `-${e.atk}`, "#ff4444");
      scene.applyPlayerDamage(Math.max(1, e.atk - scene.playerDef), () => {
        if (scene.playerHp <= 0) {
          onAllEnemiesDone();
          return;
        }
        runAt(i + 1);
      });
      return;
    }

    const canSee = enemyCanSeePlayer(scene, e);
    const prevAiState = e.aiStatePrev !== undefined ? e.aiStatePrev : e.aiState;

    if (e.aiState === "hunt") {
      if (canSee) {
        e.lastKnownPx = scene.px;
        e.lastKnownPy = scene.py;
        e.pathCacheTurn = -1000;
      } else {
        e.aiState = "search";
        e.searchTurns = 0;
        e.roamStepsLeft = -1;
        e.cachedPath = [];
        e.pathCacheTurn = -1000;
      }
    }

    if (e.aiState === "search") {
      if (canSee) {
        e.aiState = "hunt";
        e.lastKnownPx = scene.px;
        e.lastKnownPy = scene.py;
        e.cachedPath = [];
        e.pathCacheTurn = -1000;
      } else {
        e.searchTurns++;
        if (e.searchTurns >= SEARCH_MAX_TURNS) {
          e.aiState = "idle";
          e.patrolTick = 0;
          e.roamStepsLeft = -1;
          e.cachedPath = [];
          e.pathCacheTurn = -1000;
        }
      }
    }

    if (e.aiState === "idle" && canSee) {
      e.aiState = "hunt";
      e.lastKnownPx = scene.px;
      e.lastKnownPy = scene.py;
      e.cachedPath = [];
      e.pathCacheTurn = -1000;
    }

    if (e.aiState !== prevAiState) {
      e.aiStatePrev = e.aiState;
      scene.syncEnemyStateIcon(e);
    }

    if (e.aiState === "idle") {
      e.patrolTick++;
      if (e.patrolTick < 2) {
        runAt(i + 1);
        return;
      }
      e.patrolTick = 0;
      const step = pickRandomPatrolStep(scene, e);
      if (!step) {
        runAt(i + 1);
        return;
      }
      scene.tweenEnemyStep(e, step.x, step.y, () => runAt(i + 1));
      return;
    }

    if (e.aiState === "search") {
      if (e.gx === e.lastKnownPx && e.gy === e.lastKnownPy) {
        if (e.roamStepsLeft < 0) {
          e.roamStepsLeft = Phaser.Math.Between(3, 5);
        }
        if (e.roamStepsLeft > 0) {
          const step = pickRandomPatrolStep(scene, e);
          if (!step) {
            runAt(i + 1);
            return;
          }
          e.roamStepsLeft--;
          scene.tweenEnemyStep(e, step.x, step.y, () => runAt(i + 1));
          return;
        }
        runAt(i + 1);
        return;
      }

      const needRecalcS = scene.turn - e.pathCacheTurn >= PATH_CACHE_TURNS;
      if (needRecalcS) {
        e.cachedPath = findPath(
          e.gx,
          e.gy,
          e.lastKnownPx,
          e.lastKnownPy,
          (x, y) =>
            scene.isWalkableForPath(x, y, e.lastKnownPx, e.lastKnownPy, e),
        );
        e.pathCacheTurn = scene.turn;
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

      if (
        !scene.isWalkableForPath(
          nextS.x,
          nextS.y,
          e.lastKnownPx,
          e.lastKnownPy,
          e,
        )
      ) {
        e.cachedPath = [];
        e.pathCacheTurn = -1000;
        runAt(i + 1);
        return;
      }

      if (nextS.x === scene.px && nextS.y === scene.py) {
        scene.spawnDamageNumber(scene.px, scene.py, `-${e.atk}`, "#ff4444");
        e.cachedPath = [];
        scene.applyPlayerDamage(Math.max(1, e.atk - scene.playerDef), () => {
          if (scene.playerHp <= 0) {
            onAllEnemiesDone();
            return;
          }
          runAt(i + 1);
        });
        return;
      }

      const occS = scene.enemyAt(nextS.x, nextS.y);
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

      scene.tweenEnemyStep(e, nextS.x, nextS.y, () => runAt(i + 1));
      return;
    }

    const needRecalc = scene.turn - e.pathCacheTurn >= PATH_CACHE_TURNS;
    if (needRecalc) {
      e.cachedPath = findPath(e.gx, e.gy, scene.px, scene.py, (x, y) =>
        scene.isWalkableForPath(x, y, scene.px, scene.py, e),
      );
      e.pathCacheTurn = scene.turn;
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

    if (!scene.isWalkableForPath(next.x, next.y, scene.px, scene.py, e)) {
      e.cachedPath = [];
      e.pathCacheTurn = -1000;
      runAt(i + 1);
      return;
    }

    if (next.x === scene.px && next.y === scene.py) {
      scene.spawnDamageNumber(scene.px, scene.py, `-${e.atk}`, "#ff4444");
      e.cachedPath = [];
      scene.applyPlayerDamage(Math.max(1, e.atk - scene.playerDef), () => {
        if (scene.playerHp <= 0) {
          onAllEnemiesDone();
          return;
        }
        runAt(i + 1);
      });
      return;
    }

    const occ = scene.enemyAt(next.x, next.y);
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

    scene.tweenEnemyStep(e, next.x, next.y, () => runAt(i + 1));
  };

  runAt(0);
}
