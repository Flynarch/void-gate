import { GW, GH } from "../data/constants.js";

export function roomOverlaps(rooms, rx, ry, rw, rh) {
  for (const r of rooms) {
    if (
      rx < r.x + r.w + 1 &&
      rx + rw + 1 > r.x &&
      ry < r.y + r.h + 1 &&
      ry + rh + 1 > r.y
    ) {
      return true;
    }
  }
  return false;
}

export function carveRoom(grid, rx, ry, rw, rh) {
  for (let y = ry; y < ry + rh; y++) {
    for (let x = rx; x < rx + rw; x++) {
      grid[y][x] = 0;
    }
  }
}

export function carveCorridor(grid, x0, y0, x1, y1) {
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

export function generateDungeon(rng) {
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

  throw new Error("Dungeon generation failed");
}
