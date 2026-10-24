/**
 * Sprite primitives. A Frame is a small RGBA bitmap stored as a Uint32Array in
 * ImageData byte order (little-endian: 0xAABBGGRR). 0 means transparent.
 *
 * Sprites are authored as rows of characters (one char per pixel, mapped
 * through a palette) and composed at startup, so every animation frame is a
 * plain bitmap by the time the render loop sees it.
 */

export type Color = number;
export type Palette = Readonly<Record<string, Color>>;
export type Point = readonly [x: number, y: number];

export interface Frame {
  readonly w: number;
  readonly h: number;
  readonly px: Uint32Array;
}

/** '#RRGGBB' -> packed little-endian RGBA. */
export function rgba(hex: string, alpha = 255): Color {
  const n = parseInt(hex.slice(1), 16);
  return ((alpha << 24) | ((n & 0xff) << 16) | (n & 0xff00) | (n >>> 16)) >>> 0;
}

export function palette(entries: Readonly<Record<string, string>>): Palette {
  return Object.fromEntries(Object.entries(entries).map(([k, v]) => [k, rgba(v)]));
}

export const createFrame = (w: number, h: number): Frame => ({ w, h, px: new Uint32Array(w * h) });

export const cloneFrame = (f: Frame): Frame => ({ w: f.w, h: f.h, px: f.px.slice() });

/** Paints character rows onto `f`. Characters missing from the palette are transparent. */
export function paint(f: Frame, rows: readonly string[], pal: Palette, dx = 0, dy = 0): Frame {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = pal[row[x]!];
      const tx = x + dx;
      const ty = y + dy;
      if (c !== undefined && tx >= 0 && ty >= 0 && tx < f.w && ty < f.h) f.px[ty * f.w + tx] = c;
    }
  });
  return f;
}

/**
 * Round-brush polyline: every pixel whose center lies within `width / 2` of
 * the path is filled. Used for generated limbs and tails.
 */
export function stroke(f: Frame, points: readonly Point[], width: number, color: Color): Frame {
  const r2 = (width / 2) ** 2;
  const reach = Math.ceil(width / 2) + 1;
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[i + 1]!;
    const steps = Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) * 3) + 1;
    for (let s = 0; s <= steps; s++) {
      const cx = x1 + ((x2 - x1) * s) / steps;
      const cy = y1 + ((y2 - y1) * s) / steps;
      for (let y = Math.floor(cy) - reach; y <= Math.floor(cy) + reach; y++) {
        for (let x = Math.floor(cx) - reach; x <= Math.floor(cx) + reach; x++) {
          if (x < 0 || y < 0 || x >= f.w || y >= f.h) continue;
          if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r2) f.px[y * f.w + x] = color;
        }
      }
    }
  }
  return f;
}

/** Replaces one color, e.g. eye -> coat for a blink frame. */
export function recolor(f: Frame, from: Color, to: Color): Frame {
  const out = cloneFrame(f);
  for (let i = 0; i < out.px.length; i++) if (out.px[i] === from) out.px[i] = to;
  return out;
}

// ---------------------------------------------------------------------------
// Limbs. Quadrupeds share one leg model: hip -> knee -> foot, two segments
// with their own width/color, plus an optional 2px hoof/paw. A gait is just a
// per-leg phase offset; `legPoses` samples it into frames.
// ---------------------------------------------------------------------------

export interface LegSpec {
  x: number;
  hip: number;
  knee: number;
  ground: number;
  upperWidth: number;
  lowerWidth: number;
  upper: Color;
  lower: Color;
  foot?: Color;
  /** Horizontal knee offset at rest (hind legs angle back). */
  kneeOffset?: number;
}

export interface LegPose {
  dx: number;
  lift: number;
}

export const REST: LegPose = { dx: 0, lift: 0 };

export function drawLeg(f: Frame, leg: LegSpec, pose: LegPose = REST): void {
  const footY = leg.ground - pose.lift;
  const kneeX = leg.x + (leg.kneeOffset ?? 0) + pose.dx * 0.45;
  stroke(
    f,
    [
      [leg.x, leg.hip],
      [kneeX, leg.knee],
    ],
    leg.upperWidth,
    leg.upper,
  );
  stroke(
    f,
    [
      [kneeX, leg.knee],
      [leg.x + pose.dx, footY],
    ],
    leg.lowerWidth,
    leg.lower,
  );
  if (leg.foot !== undefined) {
    const fx = Math.round(leg.x + pose.dx);
    for (const x of [fx - 1, fx]) {
      if (x >= 0 && x < f.w && footY >= 0 && footY < f.h) f.px[footY * f.w + x] = leg.foot;
    }
  }
}

/**
 * Samples a cyclic gait into `count` poses per leg.
 * @param phases phase offset per leg in turns (0..1)
 * @param stride max horizontal foot travel in px
 */
export function gait(phases: readonly number[], stride: number, count: number): LegPose[][] {
  return Array.from({ length: count }, (_, i) =>
    phases.map((phase) => {
      const a = (i / count + phase) * Math.PI * 2;
      return {
        dx: Math.round(stride * Math.sin(a) * 10) / 10,
        lift: Math.cos(a) > 0.3 ? 1 : 0,
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// Animation: frames with per-frame durations (seconds).
// ---------------------------------------------------------------------------

export interface Animation {
  readonly frames: readonly Frame[];
  readonly durations: readonly number[];
  readonly loop: boolean;
  readonly length: number;
}

export function sequence(steps: readonly (readonly [Frame, number])[], loop = true): Animation {
  const durations = steps.map(([, d]) => d);
  return {
    frames: steps.map(([f]) => f),
    durations,
    loop,
    length: durations.reduce((a, b) => a + b, 0),
  };
}

export const animation = (frames: readonly Frame[], fps: number, loop = true): Animation =>
  sequence(
    frames.map((f) => [f, 1 / fps] as const),
    loop,
  );

export function frameAt(anim: Animation, t: number): Frame {
  let time = anim.loop ? t % anim.length : Math.min(t, anim.length - 1e-6);
  for (let i = 0; i < anim.frames.length; i++) {
    time -= anim.durations[i]!;
    if (time < 0) return anim.frames[i]!;
  }
  return anim.frames[anim.frames.length - 1]!;
}

// ---------------------------------------------------------------------------
// Blitting onto a render surface.
// ---------------------------------------------------------------------------

export interface Surface {
  readonly w: number;
  readonly h: number;
  readonly px: Uint32Array;
}

/**
 * Copies opaque pixels of `f` to `dst` at integer position (x, y), optionally
 * mirrored. `fade` (0..1) drops pixels through the ordered-dither matrix,
 * which gives a dithered fade-out instead of alpha blending.
 */
export function blit(dst: Surface, f: Frame, x: number, y: number, flip = false, fade = 1): void {
  const x0 = Math.round(x);
  const y0 = Math.round(y);
  for (let sy = 0; sy < f.h; sy++) {
    const ty = y0 + sy;
    if (ty < 0 || ty >= dst.h) continue;
    for (let sx = 0; sx < f.w; sx++) {
      const c = f.px[sy * f.w + (flip ? f.w - 1 - sx : sx)]!;
      if (c === 0) continue;
      const tx = x0 + sx;
      if (tx < 0 || tx >= dst.w) continue;
      if (fade < 1 && bayer(tx, ty) >= fade) continue;
      dst.px[ty * dst.w + tx] = c;
    }
  }
}

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

/** 8x8 ordered-dither threshold in [0, 1). */
export const bayer = (x: number, y: number): number => (BAYER8[(y & 7) * 8 + (x & 7)]! + 0.5) / 64;

/** Deterministic white noise in [0, 1) for grain. */
export function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
