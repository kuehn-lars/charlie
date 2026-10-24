import { bayer, hash, type Color } from './sprite';

/** Meadow height in scene px. Actor lanes live inside it. */
export const MEADOW = 24;

export interface BackdropColors {
  bg: Color;
  rose: Color;
  blush: Color;
  sage: Color;
  sageDeep: Color;
}

export interface Layout {
  horizon: number;
  sun: { cx: number; cy: number; r: number };
}

/**
 * Sun placement adapts continuously to the stage shape: a large disc resting
 * on the horizon in the hero, sinking until only its cap shows in the compact
 * strip, so the stage height can animate between the two.
 */
export function layout(w: number, h: number): Layout {
  const horizon = h - MEADOW;
  const portrait = h > w;
  const tall = Math.min(1, Math.max(0, (horizon - 30) / 70)); // 0 = strip, 1 = hero
  const rHero = portrait
    ? Math.min(w * 0.46, horizon * 0.36)
    : Math.min(w * 0.2, horizon * 0.5, 72);
  const rStrip = Math.min(w * 0.12, Math.max(10, (horizon - 4) / 0.8));
  const r = Math.round(rStrip + (rHero - rStrip) * tall);
  const cx = Math.round(w * (portrait ? 0.62 : 0.74));
  const cy = Math.round(horizon + r * (0.2 - 0.7 * tall));
  return { horizon, sun: { cx, cy, r } };
}

/** Gentle rolling horizon, deterministic per column. */
export const horizonAt = (horizon: number, x: number): number =>
  horizon + Math.round(1.2 * Math.sin(x / 19) + 0.8 * Math.sin(x / 7.3 + 1.7));

/**
 * Scatterable pixels. Struct-of-arrays so the per-frame loop touches only
 * typed memory.
 */
export interface Particles {
  count: number;
  hx: Int16Array;
  hy: Int16Array;
  ox: Float32Array;
  oy: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  color: Uint32Array;
}

export interface Backdrop {
  layout: Layout;
  /** Paper-only base layer, copied into the frame buffer every frame. */
  base: Uint32Array;
  particles: Particles;
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export function buildBackdrop(w: number, h: number, c: BackdropColors): Backdrop {
  const lay = layout(w, h);
  const { cx, cy, r } = lay.sun;
  const base = new Uint32Array(w * h).fill(c.bg);
  const hx: number[] = [];
  const hy: number[] = [];
  const col: number[] = [];
  const add = (x: number, y: number, color: Color) => {
    hx.push(x);
    hy.push(y);
    col.push(color);
  };

  for (let x = 0; x < w; x++) {
    const top = horizonAt(lay.horizon, x);
    // Grass blades poking above the horizon.
    const g = hash(x, 7);
    if (g < 0.16) add(x, top - 1, c.sage);
    if (g < 0.05) add(x, top - 2, c.sage);

    for (let y = 0; y < h; y++) {
      const t = bayer(x, y);
      const n = hash(x, y);
      if (y >= top) {
        // Meadow: sage dither getting denser towards the bottom, deep sage
        // clustering in the lower half.
        const depth = (y - top) / Math.max(1, h - top);
        const density = y === top ? 0.9 : 0.16 + 0.5 * depth;
        if (t < density * 0.38 * depth) add(x, y, c.sageDeep);
        else if (t < density) add(x, y, c.sage);
        continue;
      }
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= r) {
        // Sun: dense checker at the top dissolving into a sparse grid below.
        const v = Math.min(1, (y - (cy - r)) / (2 * r));
        const density = 0.05 + 0.68 * (1 - v) ** 1.4;
        if (t < density) add(x, y, c.rose);
        else if (n < 0.1) add(x, y, c.blush);
        continue;
      }
      // Grain halo around the sun, and a faint sage haze off the meadow's left end.
      const halo = smoothstep(r * 2.1, r * 1.02, d) ** 1.6 * 0.26;
      const haze = smoothstep(w * 0.3, 0, Math.hypot(x, (y - top) * 3)) * 0.07;
      if (n < halo) add(x, y, n < halo * 0.18 ? c.rose : c.blush);
      else if (n > 1 - haze) add(x, y, c.sage);
    }
  }

  const count = hx.length;
  return {
    layout: lay,
    base,
    particles: {
      count,
      hx: Int16Array.from(hx),
      hy: Int16Array.from(hy),
      ox: new Float32Array(count),
      oy: new Float32Array(count),
      vx: new Float32Array(count),
      vy: new Float32Array(count),
      color: Uint32Array.from(col),
    },
  };
}

const RADIUS = 11;
const PUSH = 900;
const SPRING = 38;
const DAMPING = 7;

/**
 * Spring-damper per pixel: pushed away from the pointer, pulled home. Settled
 * pixels far from the pointer are skipped cheaply.
 */
export function stepParticles(p: Particles, dt: number, px: number | null, py: number): void {
  const damp = Math.exp(-DAMPING * dt);
  for (let i = 0; i < p.count; i++) {
    let ox = p.ox[i]!;
    let oy = p.oy[i]!;
    let vx = p.vx[i]!;
    let vy = p.vy[i]!;
    let near = false;
    if (px !== null) {
      const dx = p.hx[i]! + ox - px;
      const dy = p.hy[i]! + oy - py;
      const d2 = dx * dx + dy * dy;
      if (d2 < RADIUS * RADIUS) {
        near = true;
        const d = Math.sqrt(d2) || 1;
        const f = (1 - d / RADIUS) * PUSH * dt;
        vx += (dx / d) * f;
        vy += (dy / d) * f;
      }
    }
    if (!near && ox === 0 && oy === 0 && vx === 0 && vy === 0) continue;
    vx = (vx - ox * SPRING * dt) * damp;
    vy = (vy - oy * SPRING * dt) * damp;
    ox += vx * dt;
    oy += vy * dt;
    if (
      !near &&
      Math.abs(ox) < 0.05 &&
      Math.abs(oy) < 0.05 &&
      Math.abs(vx) < 0.05 &&
      Math.abs(vy) < 0.05
    ) {
      ox = oy = vx = vy = 0;
    }
    p.ox[i] = ox;
    p.oy[i] = oy;
    p.vx[i] = vx;
    p.vy[i] = vy;
  }
}

export function drawParticles(p: Particles, buf: Uint32Array, w: number, h: number): void {
  for (let i = 0; i < p.count; i++) {
    const x = Math.round(p.hx[i]! + p.ox[i]!);
    const y = Math.round(p.hy[i]! + p.oy[i]!);
    if (x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = p.color[i]!;
  }
}
