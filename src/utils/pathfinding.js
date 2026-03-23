import { GW, GH, PATH_MAX_EXPANSIONS, PATH_MAX_STEPS } from "../data/constants.js";

export function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export function bresenhamLine(x0, y0, x1, y1) {
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

export function hasLOS(grid, x1, y1, x2, y2) {
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

export function findPath(sx, sy, tx, ty, isWalkable) {
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
