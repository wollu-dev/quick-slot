/** Fair randomness and the game logic behind the draw games (roulette, ladder, pinball) */

/** Uniform integer in [0, n) from the browser's cryptographic generator (no modulo bias) */
export function randomInt(n: number): number {
  if (n <= 1) return 0;
  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}
/** Uniform float in [0, 1) */
export const randomFloat = () => randomInt(0x40000000) / 0x40000000;

export function shuffle<T>(list: T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** One entry per line or comma; blank entries dropped */
export const parseEntries = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Evenly spaced hues for segments and balls (the games' only hard-coded colors) */
export const hue = (i: number, n: number) => `hsl(${Math.round((i * 360) / Math.max(1, n) + 210) % 360} 70% 55%)`;

/* ------------------------------------------------------------------ */
/* Roulette                                                            */
/* ------------------------------------------------------------------ */

/**
 * Picks the winner first, then the wheel angle that lands it under the pointer at the top,
 * with a random spot inside the segment and several full turns for the spin.
 */
export function rouletteSpin(count: number, current: number): { winner: number; angle: number } {
  const winner = randomInt(count);
  const seg = 360 / count;
  const inside = seg * (0.15 + 0.7 * randomFloat());
  // Segment i spans [i*seg, (i+1)*seg) clockwise from the top; rotating the wheel by -x brings angle x to the pointer
  const target = 360 - (winner * seg + inside);
  const base = current - (current % 360);
  const turns = 5 + randomInt(3);
  return { winner, angle: base + turns * 360 + target };
}

/* ------------------------------------------------------------------ */
/* Ladder                                                              */
/* ------------------------------------------------------------------ */

/** Rungs per row: rungs[row][col] joins column col and col+1. No two rungs touch in a row. */
export function makeLadder(columns: number, rows = 12): boolean[][] {
  const rungs: boolean[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < columns - 1; c++) row.push(!row[c - 1] && randomInt(100) < 45);
    rungs.push(row);
  }
  // Make sure every pair of neighbouring columns is crossed at least once
  for (let c = 0; c < columns - 1; c++) {
    if (rungs.some((row) => row[c])) continue;
    const free = rungs.map((row, r) => (!row[c - 1] && !row[c + 1] ? r : -1)).filter((r) => r >= 0);
    const r = free.length ? free[randomInt(free.length)] : randomInt(rows);
    rungs[r][c] = true;
    if (rungs[r][c - 1]) rungs[r][c - 1] = false;
    if (rungs[r][c + 1]) rungs[r][c + 1] = false;
  }
  return rungs;
}

/** The path from the top of column `start`: the column at each row boundary, ending at the result column */
export function tracePath(rungs: boolean[][], start: number): number[] {
  const path = [start];
  let c = start;
  for (const row of rungs) {
    if (row[c]) c++;
    else if (row[c - 1]) c--;
    path.push(c);
  }
  return path;
}

/* ------------------------------------------------------------------ */
/* Pinball                                                             */
/* ------------------------------------------------------------------ */

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  index: number;
  finished: number | null;
  /** Seconds without real movement, to nudge balls that get stuck */
  still: number;
}

export interface Peg {
  x: number;
  y: number;
  r: number;
}

export const BOARD = { w: 360, h: 620, finish: 600 };

/** Staggered pegs with a few larger bumpers */
export function makePegs(): Peg[] {
  const pegs: Peg[] = [];
  const rows = 14;
  for (let r = 0; r < rows; r++) {
    const y = 90 + r * 34;
    const offset = r % 2 ? 0 : 18;
    // Keep pegs away from the walls: a gap narrower than a ball would trap it
    for (let x = 36 + offset; x <= BOARD.w - 36; x += 36) pegs.push({ x, y, r: 4 });
  }
  for (const [x, y] of [
    [90, 230],
    [270, 330],
    [180, 430],
  ])
    pegs.push({ x, y, r: 12 });
  return pegs;
}

export function spawnBalls(n: number): Ball[] {
  const r = n > 24 ? 6 : 8;
  return shuffle(Array.from({ length: n }, (_, i) => i)).map((index, k) => ({
    x: 30 + randomFloat() * (BOARD.w - 60),
    y: 14 - (k % 6) * 14 - Math.floor(k / 6) * 6,
    vx: (randomFloat() - 0.5) * 60,
    vy: 0,
    r,
    index,
    finished: null,
    still: 0,
  }));
}

/** Advances the simulation by `dt` seconds; returns indexes of balls that crossed the finish line in this step */
export function stepBalls(balls: Ball[], pegs: Peg[], dt: number, clock: number): number[] {
  const g = 900;
  const done: number[] = [];
  for (const b of balls) {
    if (b.finished !== null) continue;
    b.vy += g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    // Walls
    if (b.x < b.r) {
      b.x = b.r;
      b.vx = Math.abs(b.vx) * 0.6;
    } else if (b.x > BOARD.w - b.r) {
      b.x = BOARD.w - b.r;
      b.vx = -Math.abs(b.vx) * 0.6;
    }
    // Pegs
    for (const p of pegs) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const min = b.r + p.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      b.x = p.x + nx * min;
      b.y = p.y + ny * min;
      const vn = b.vx * nx + b.vy * ny;
      if (vn < 0) {
        b.vx -= 1.4 * vn * nx;
        b.vy -= 1.4 * vn * ny;
        // A little randomness on every hit keeps the board fair and unpredictable
        b.vx += (randomFloat() - 0.5) * 40;
      }
    }
    if (Math.hypot(b.vx, b.vy) < 25) b.still += dt;
    else b.still = 0;
    if (b.still > 0.6) {
      b.vx += (randomFloat() - 0.5) * 220;
      b.vy -= 120;
      b.still = 0;
    }
    if (b.y > BOARD.finish) {
      b.finished = clock;
      done.push(b.index);
    }
  }
  // Balls push each other apart
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.finished !== null) continue;
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      if (b.finished !== null) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rel < 0) {
        const k = rel * 0.9;
        a.vx += k * nx;
        a.vy += k * ny;
        b.vx -= k * nx;
        b.vy -= k * ny;
      }
    }
  }
  return done;
}
