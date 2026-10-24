import { createFrame, paint, type Color, type Frame } from './sprite';

// Paper outline (p) keeps hearts legible on top of the rose sun.
// prettier-ignore
const HEART = [
  '.pp...pp.',
  'prrp.prrp',
  'prbbrrrrp',
  'prbrrrrrp',
  '.prrrrrp.',
  '..prrrp..',
  '...prp...',
  '....p....',
];

export const heartFrame = (rose: Color, blush: Color, paper: Color): Frame =>
  paint(createFrame(9, 8), HEART, { r: rose, b: blush, p: paper });

/** A heart that floats up, sways and dither-fades out. Units: px, seconds. */
export interface Heart {
  x: number;
  y: number;
  t: number;
  life: number;
  sway: number;
  rise: number;
}

export function spawnHearts(
  list: Heart[],
  x: number,
  y: number,
  count: number,
  random: () => number,
) {
  for (let i = 0; i < count; i++) {
    list.push({
      x: x + (random() - 0.5) * 14,
      y: y - random() * 4,
      t: -i * 0.12,
      life: 1.1 + random() * 0.5,
      sway: random() * Math.PI * 2,
      rise: 14 + random() * 8,
    });
  }
}

/** Advances hearts in place and drops finished ones. */
export function stepHearts(list: Heart[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const h = list[i]!;
    h.t += dt;
    if (h.t < 0) continue;
    h.y -= h.rise * dt;
    h.x += Math.sin(h.t * 5 + h.sway) * 6 * dt;
    if (h.t > h.life) list.splice(i, 1);
  }
}

export const heartFade = (h: Heart): number =>
  h.t < 0 ? 0 : Math.min(1, (h.life - h.t) / (h.life * 0.5));
