import { heartFade, heartFrame, spawnHearts, stepHearts, type Heart } from './heart';
import { applyGrid, pixelGrid, type PixelGrid } from './pixels';
import { bayer, blit, rgba, type Color } from './sprite';

/**
 * Viewport overlay for one-shot pixel effects (the "Nein" dissolve, the "Ja"
 * burst). Its rAF loop only runs while something is on screen.
 */
export interface Fx {
  /** Rasterizes `el` into pixels that drift apart and fade. */
  dissolve(el: HTMLElement): void;
  /** Accent pixels and a few hearts bursting out of `el`. */
  burst(el: HTMLElement): void;
}

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  c: Color;
  t: number;
  life: number;
  gravity: number;
}

const CSS_PIXEL = 3;

export function createFx(
  canvas: HTMLCanvasElement,
  accent: { rose: string; roseInk: string; blush: string; bg: string },
): Fx {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  const heart = heartFrame(rgba(accent.rose), rgba(accent.blush), rgba(accent.bg));
  const bits: Bit[] = [];
  const hearts: Heart[] = [];
  let grid: PixelGrid | null = null;
  let image: ImageData | null = null;
  let buf = new Uint32Array(0);
  let raf = 0;
  let last = 0;

  function ensureGrid() {
    const next = pixelGrid(window.innerWidth, window.innerHeight, CSS_PIXEL);
    if (grid && next.w === grid.w && next.h === grid.h && next.device === grid.device) return;
    grid = next;
    applyGrid(canvas, grid);
    canvas.hidden = false;
    image = ctx!.createImageData(grid.w, grid.h);
    buf = new Uint32Array(image.data.buffer);
  }

  function tick(t: number) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    buf.fill(0);
    const surface = { w: grid!.w, h: grid!.h, px: buf };
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]!;
      b.t += dt;
      if (b.t >= b.life) {
        bits.splice(i, 1);
        continue;
      }
      b.vy += b.gravity * dt;
      b.vx *= Math.exp(-2.2 * dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const x = Math.round(b.x);
      const y = Math.round(b.y);
      const fade = 1 - b.t / b.life;
      if (x < 0 || y < 0 || x >= surface.w || y >= surface.h || bayer(x, y) >= fade) continue;
      buf[y * surface.w + x] = b.c;
    }
    stepHearts(hearts, dt);
    for (const h of hearts)
      if (h.t >= 0) blit(surface, heart, h.x - 4, h.y - 8, false, heartFade(h));
    ctx!.putImageData(image!, 0, 0);
    raf = bits.length || hearts.length ? requestAnimationFrame(tick) : 0;
    if (!raf) ctx!.clearRect(0, 0, surface.w, surface.h);
  }

  function run() {
    if (raf) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  }

  /** Element rect in overlay pixels. */
  function rectOf(el: HTMLElement) {
    ensureGrid();
    const r = el.getBoundingClientRect();
    const s = grid!.css;
    return { x: r.left / s, y: r.top / s, w: r.width / s, h: r.height / s, css: r };
  }

  return {
    dissolve(el) {
      const r = rectOf(el);
      const cols = Math.max(1, Math.round(r.w));
      const rows = Math.max(1, Math.round(r.h));
      // Draw a miniature of the element (fill, border, label) and turn every
      // opaque pixel into a particle.
      const off = document.createElement('canvas');
      off.width = cols;
      off.height = rows;
      const o = off.getContext('2d');
      if (!o) return;
      const cs = getComputedStyle(el);
      o.fillStyle = cs.backgroundColor;
      o.fillRect(0, 0, cols, rows);
      o.strokeStyle = cs.borderTopColor;
      o.lineWidth = 1;
      o.strokeRect(0.5, 0.5, cols - 1, rows - 1);
      o.fillStyle = cs.color;
      o.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) / grid!.css}px ${cs.fontFamily}`;
      o.textAlign = 'center';
      o.textBaseline = 'middle';
      o.fillText(el.textContent.trim(), cols / 2, rows / 2 + 0.5);
      const data = o.getImageData(0, 0, cols, rows).data;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          if (data[i + 3]! < 128) continue;
          const c = ((255 << 24) | (data[i + 2]! << 16) | (data[i + 1]! << 8) | data[i]!) >>> 0;
          const dx = x - cols / 2;
          bits.push({
            x: r.x + x,
            y: r.y + y,
            vx: dx * 1.6 + (Math.random() - 0.5) * 24,
            vy: -10 - Math.random() * 34,
            c,
            t: Math.random() * 0.08,
            life: 0.45 + Math.random() * 0.45,
            gravity: -12,
          });
        }
      }
      run();
    },

    burst(el) {
      const r = rectOf(el);
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const palette = [rgba(accent.rose), rgba(accent.roseInk), rgba(accent.blush)];
      for (let i = 0; i < 72; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 40 + Math.random() * 90;
        bits.push({
          x: cx + Math.cos(a) * r.w * 0.3,
          y: cy + Math.sin(a) * r.h * 0.3,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 30,
          c: palette[i % 3]!,
          t: 0,
          life: 0.6 + Math.random() * 0.5,
          gravity: 90,
        });
      }
      spawnHearts(hearts, cx, r.y, 4, Math.random);
      for (const h of hearts) h.rise = 30 + Math.random() * 20;
      run();
    },
  };
}
