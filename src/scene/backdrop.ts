import type { Palette } from '../../config';
import { bayer, hash, rgba, type Color } from './sprite';

/** Meadow height in scene px. Actor lanes live inside it. */
export const MEADOW = 24;

export interface BackdropColors {
  sky: readonly Color[];
  sun: readonly Color[];
  clouds: readonly Color[];
  hills: readonly Color[];
  meadow: readonly Color[];
  blooms: readonly Color[];
  sparkles: readonly Color[];
}

export const backdropColors = (p: Palette): BackdropColors => ({
  sky: p.sky.map((c) => rgba(c)),
  sun: p.sun.map((c) => rgba(c)),
  clouds: p.clouds.map((c) => rgba(c)),
  hills: p.hills.map((c) => rgba(c)),
  meadow: p.meadow.map((c) => rgba(c)),
  blooms: p.blooms.map((c) => rgba(c)),
  sparkles: p.sparkles.map((c) => rgba(c)),
});

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
  /** 0 = currently invisible (a twinkle in its dark phase). */
  color: Uint32Array;
}

export interface Backdrop {
  layout: Layout;
  /** Painted, non-scattering layer (sky, halo, hills), copied into the frame buffer every frame. */
  base: Uint32Array;
  particles: Particles;
  /** Particle indices that twinkle, their resting colors and phase offsets. */
  twinkle: { index: Uint32Array; color: Uint32Array; phase: Float32Array };
}

const smoothstep = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** Picks between two neighboring stops of `stops` at `v` (0..1), dithered by threshold `t`. */
function ramp(stops: readonly Color[], v: number, t: number): Color {
  const pos = Math.min(stops.length - 1, Math.max(0, v * (stops.length - 1)));
  const i = Math.floor(pos);
  return pos - i > t ? stops[Math.min(i + 1, stops.length - 1)]! : stops[i]!;
}

/**
 * The painting. Everything is ordered dither between palette stops, so it
 * reads as pixel art up close and as a painting from a step back:
 *
 * - Sky: a vertical ramp sampled through swirling, domain-warped coordinates
 *   (bands bend into Van Gogh brush strokes), warmed around the sun, with
 *   short dabs of color jitter that follow the swirl.
 * - Halo: wobbling concentric rings around the sun.
 * - Hills: two layered silhouettes in front of the setting sun.
 * - Particles (scatter under the pointer): the ringed sun disc, brush-stroke
 *   clouds, a striped meadow with flower dabs, and twinkling sparkles.
 */
export function buildBackdrop(w: number, h: number, c: BackdropColors): Backdrop {
  const lay = layout(w, h);
  const { horizon } = lay;
  const { cx, cy, r } = lay.sun;
  const base = new Uint32Array(w * h);
  const hx: number[] = [];
  const hy: number[] = [];
  const col: number[] = [];
  const add = (x: number, y: number, color: Color) => {
    hx.push(x);
    hy.push(y);
    col.push(color);
  };
  const tw: number[] = [];
  const twinkle = (x: number, y: number, color: Color) => {
    tw.push(hx.length);
    add(x, y, color);
  };

  // Swirls sit right of the headline and above the clouds.
  const swirls = [
    { x: w * 0.93, y: horizon * 0.16, r: Math.max(12, horizon * 0.5), spin: 4.6 },
    { x: w * 0.6, y: horizon * 0.1, r: Math.max(8, horizon * 0.34), spin: -4 },
    { x: w * 0.1, y: horizon * 0.86, r: Math.max(8, horizon * 0.4), spin: 3.6 },
  ];
  const sunOuter = c.sun.slice(-3);
  // Hills and clouds scale with the shorter side, so portrait stages stay calm.
  const span = Math.min(horizon, w * 0.6);
  const hillFar = (x: number) =>
    horizon - Math.max(3, span * 0.2) * (0.55 + 0.45 * Math.sin(x / 23 + 1.1) * Math.sin(x / 9.7));
  const hillNear = (x: number) =>
    horizon - Math.max(2, span * 0.1) * (0.5 + 0.5 * Math.sin(x / 15 + 4.2));
  const star = (x: number, y: number) => hash(x, y + 9001) < 0.004 * (1 - y / horizon) ** 2;

  for (let x = 0; x < w; x++) {
    const top = horizonAt(horizon, x);
    // Grass blades poking above the horizon.
    const g = hash(x, 7);
    if (g < 0.22) add(x, top - 1, c.meadow[0]!);
    if (g < 0.07) add(x, top - 2, c.meadow[1]!);
    if (g < 0.02) add(x, top - 3, c.blooms[Math.floor(hash(x, 3) * c.blooms.length)]!);
    const far = hillFar(x);
    const near = hillNear(x);

    for (let y = 0; y < h; y++) {
      const t = bayer(x, y);
      const n = hash(x, y);
      if (y >= top) {
        // Meadow: banded stripes from light to deep, blade streaks, blooms.
        const depth = (y - top) / Math.max(1, h - top);
        const blade = (hash(x, Math.floor((y + (x & 3)) / 3)) - 0.5) * 0.45;
        const bloom = 0.015 + 0.05 * depth;
        if (n < bloom) {
          add(x, y, c.blooms[Math.floor(hash(y, x) * c.blooms.length)]!);
          if (n < bloom * 0.25) tw.push(hx.length - 1);
        } else add(x, y, ramp(c.meadow, depth + blade, t));
        continue;
      }

      // Hills: the sun sets behind them.
      if (y >= near) {
        base[y * w + x] = ramp(c.hills, 0.75 + (n - 0.5) * 0.4, t);
        continue;
      }
      if (y >= far) {
        base[y * w + x] = ramp(c.hills, ((y - far) / Math.max(1, near - far)) * 0.5, t);
        continue;
      }

      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= r) {
        // Sun: concentric rings from core to rim with a painterly wobble.
        const v = (d / r) ** 1.25 + 0.07 * Math.sin(Math.atan2(dy, dx) * 6 + d / 2.5);
        add(x, y, ramp(c.sun, v, t * 0.8 + n * 0.2));
        continue;
      }

      // Sky: warp the sample point through the swirls and a gentle flow.
      let sx = x;
      let sy = y;
      for (const s of swirls) {
        const ex = sx - s.x;
        const ey = sy - s.y;
        const ed = Math.sqrt(ex * ex + ey * ey);
        if (ed >= s.r) continue;
        const a = s.spin * (1 - ed / s.r) ** 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        sx = s.x + ex * cos - ey * sin;
        sy = s.y + ex * sin + ey * cos;
      }
      sy += 4 * Math.sin(x / 17 + y / 23) + 1.6 * Math.sin(x / 7.1 - y / 11);
      const glow = smoothstep(r * 3.4, r, d);
      const dab = (hash(Math.floor(sx / 6), Math.floor(sy / 2)) - 0.5) * 0.2;
      let color = ramp(c.sky, sy / horizon + glow * 0.35 + dab, t);

      // Halo: wobbling rings of the sun's outer colors, fading outwards.
      if (d < r * 2.2) {
        const k = (d - r) / (r * 1.2);
        const wobble = 1.3 * Math.sin(Math.atan2(dy, dx) * 5 + d / 5);
        const wave = 0.5 + 0.5 * Math.cos(((d - r) / (r * 0.2)) * Math.PI * 2 + wobble);
        if (wave > 0.55 && t < (1 - k) ** 1.6 * 0.95) color = ramp(sunOuter, k + dab, n);
      }
      base[y * w + x] = color;

      if (c.sparkles.length > 0 && glow < 0.9) {
        const sc = c.sparkles[Math.floor(n * 997) % c.sparkles.length]!;
        if (star(x, y)) twinkle(x, y, sc);
        // Bright stars get a cross.
        else if (
          (star(x - 1, y) && hash(x - 1, y) < 0.3) ||
          (star(x + 1, y) && hash(x + 1, y) < 0.3) ||
          (star(x, y - 1) && hash(x, y - 1) < 0.3) ||
          (star(x, y + 1) && hash(x, y + 1) < 0.3)
        )
          add(x, y, sc);
      }
    }
  }

  // Clouds: stacks of tapered brush strokes, drawn over the sun.
  if (horizon > 24) {
    for (let i = 0; i < 5; i++) {
      const ccx = w * (0.12 + 0.2 * i + 0.08 * (hash(i, 51) - 0.5));
      const ccy = horizon * (0.5 + 0.28 * hash(i, 77));
      const len = w * (0.06 + 0.06 * hash(i, 13));
      const thick = Math.max(1.5, span * 0.022);
      for (let k = 0; k < 3; k++) {
        const sx0 = ccx + len * (hash(i, k + 20) - 0.5) * 0.8;
        const sy0 = ccy + (k - 1) * thick * 1.6;
        const sl = len * (1 - 0.25 * Math.abs(k - 1));
        for (let y = Math.floor(sy0 - thick * 1.5); y <= sy0 + thick * 1.5; y++) {
          for (let x = Math.floor(sx0 - sl); x <= sx0 + sl; x++) {
            if (x < 0 || x >= w || y < 0 || y >= hillFar(x)) continue;
            const u = (x - sx0) / sl;
            const v = (y - sy0) / (thick * (1 - u * u * 0.6));
            if (u * u + v * v * 0.6 > 1 + (hash(x >> 1, y) - 0.5) * 0.5) continue;
            add(x, y, ramp(c.clouds, (v + 1) / 2 + (k - 1) * 0.2, bayer(x, y)));
          }
        }
      }
    }
  }

  const count = hx.length;
  const index = Uint32Array.from(tw);
  const color = Uint32Array.from(col);
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
      color,
    },
    twinkle: {
      index,
      color: index.map((i) => color[i]!),
      phase: Float32Array.from(index, (i) => hash(i, 5) * 7),
    },
  };
}

/** Blinks sparkles: each is dark for a short slice of its own cycle. */
export function stepTwinkle(b: Backdrop, time: number): void {
  const { index, color, phase } = b.twinkle;
  for (let i = 0; i < index.length; i++) {
    const cycle = (time * 0.6 + phase[i]!) % 2.4;
    b.particles.color[index[i]!] = cycle < 0.35 ? 0 : color[i]!;
  }
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
    const c = p.color[i]!;
    if (c && x >= 0 && y >= 0 && x < w && y < h) buf[y * w + x] = c;
  }
}
