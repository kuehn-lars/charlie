import { describe, expect, it } from 'vitest';
import { PROXIMITY, pickSpot } from '../../src/steps/nein';

const viewport = { w: 1440, h: 900 };
const size = { w: 104, h: 52 };
const ja = { left: 200, top: 400, right: 320, bottom: 460 };
const headline = { left: 200, top: 220, right: 800, bottom: 370 };

function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

describe('pickSpot', () => {
  it('stays inside the viewport, off protected rects, away from the pointer', () => {
    const pointer = { x: 380, y: 430 };
    for (let s = 1; s < 200; s++) {
      const spot = pickSpot(viewport, size, pointer, [ja, headline], seeded(s));
      expect(spot).not.toBeNull();
      const box = {
        left: spot!.x,
        top: spot!.y,
        right: spot!.x + size.w,
        bottom: spot!.y + size.h,
      };
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(viewport.w);
      expect(box.bottom).toBeLessThanOrEqual(viewport.h);
      for (const p of [ja, headline]) {
        const overlap =
          box.left < p.right && box.right > p.left && box.top < p.bottom && box.bottom > p.top;
        expect(overlap).toBe(false);
      }
      const dx = Math.max(box.left - pointer.x, 0, pointer.x - box.right);
      const dy = Math.max(box.top - pointer.y, 0, pointer.y - box.bottom);
      expect(Math.hypot(dx, dy)).toBeGreaterThan(PROXIMITY);
    }
  });

  it('gives up when the viewport cannot hold the button', () => {
    expect(pickSpot({ w: 100, h: 60 }, size, { x: 0, y: 0 }, [])).toBeNull();
  });
});
