import type { HorseColors, Palette } from '../../config';
import { Actor, clampX, type World } from './actor';
import { createCat } from './animals/cat';
import { createDog } from './animals/dog';
import { createLewin } from './animals/lewin';
import {
  buildBackdrop,
  drawParticles,
  stepParticles,
  type Backdrop,
  type BackdropColors,
} from './backdrop';
import { heartFade, heartFrame, spawnHearts, stepHearts, type Heart } from './heart';
import { applyGrid, pixelGrid, type PixelGrid } from './pixels';
import { blit, rgba } from './sprite';

export interface SceneOptions {
  palette: Palette;
  horse: HorseColors;
  reducedMotion: boolean;
}

export interface Scene {
  /** The "Ja" moment: everyone jumps, Lewin sends hearts. */
  celebrate(): void;
  /** Success screen: keep celebrating at a relaxed pace. */
  setHappy(on: boolean): void;
}

/** CSS px per scene pixel. Desktop gets chunkier pixels so sprites read at distance. */
const cssPixelFor = (cssW: number) => (cssW >= 720 ? 4 : 3);

type MutableWorld = { -readonly [K in keyof World]: World[K] };

/**
 * The hero scene: one canvas, one rAF loop, rendered into a scene-resolution
 * ImageData that CSS upscales by an integer factor.
 */
export function createScene(canvas: HTMLCanvasElement, opts: SceneOptions): Scene {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('2D canvas unavailable');
  const p = opts.palette;
  const colors: BackdropColors = {
    bg: rgba(p.bg),
    rose: rgba(p.rose),
    blush: rgba(p.blush),
    sage: rgba(p.sage),
    sageDeep: rgba(p.sageDeep),
  };
  const heart = heartFrame(rgba(p.rose), rgba(p.blush), rgba(p.bg));
  const hearts: Heart[] = [];

  const world: MutableWorld = {
    w: 0,
    h: 0,
    horizon: 0,
    reducedMotion: opts.reducedMotion,
    pointerX: null,
    happy: false,
    random: Math.random,
    hearts: (x, y, n) => {
      spawnHearts(hearts, x, y, opts.reducedMotion ? 1 : n, Math.random);
    },
  };

  let grid: PixelGrid | null = null;
  let backdrop: Backdrop | null = null;
  let image: ImageData | null = null;
  let buf = new Uint32Array(0);
  let actors: Actor[] = [];
  /** Pointer over the canvas, in scene px; drives the scatter. */
  let pointer: { x: number; y: number } | null = null;

  function resize() {
    const parent = canvas.parentElement!;
    const next = pixelGrid(
      parent.clientWidth,
      parent.clientHeight,
      cssPixelFor(parent.clientWidth),
    );
    if (grid && next.w === grid.w && next.h === grid.h && next.device === grid.device) return;
    const prevW = world.w;
    grid = next;
    applyGrid(canvas, grid);
    canvas.hidden = false; // shown only once sized: no layout shift from the 300x150 default
    image = ctx!.createImageData(grid.w, grid.h);
    buf = new Uint32Array(image.data.buffer);
    backdrop = buildBackdrop(grid.w, grid.h, colors);
    world.w = grid.w;
    world.h = grid.h;
    world.horizon = backdrop.layout.horizon;
    if (actors.length === 0) {
      const w = world.w;
      actors = [
        createLewin(opts.horse, Math.round(w * 0.3)),
        createDog(Math.round(w * 0.55)),
        createCat(Math.round(w * 0.16)),
      ];
    } else if (prevW > 0) {
      for (const a of actors) a.x = clampX(world, (a.x * world.w) / prevW, a.frame.w / 2);
    }
    render();
  }

  function update(dt: number) {
    for (const a of actors) a.update(world, dt);
    if (backdrop && !opts.reducedMotion) {
      stepParticles(backdrop.particles, dt, pointer?.x ?? null, pointer?.y ?? 0);
    }
    stepHearts(hearts, dt);
  }

  function render() {
    if (!backdrop || !image || !grid) return;
    buf.set(backdrop.base);
    drawParticles(backdrop.particles, buf, grid.w, grid.h);
    // Back lane first.
    for (const a of [...actors].sort((x, y) => x.spec.lane - y.spec.lane))
      a.draw({ w: grid.w, h: grid.h, px: buf }, world);
    for (const h of hearts) {
      if (h.t >= 0)
        blit({ w: grid.w, h: grid.h, px: buf }, heart, h.x - 4, h.y - 8, false, heartFade(h));
    }
    ctx!.putImageData(image, 0, 0);
  }

  // --- loop -----------------------------------------------------------------
  let raf = 0;
  let last = 0;
  const tick = (t: number) => {
    const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
    last = t;
    update(dt);
    render();
    raf = requestAnimationFrame(tick);
  };
  const start = () => {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };
  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  // --- input ----------------------------------------------------------------
  const toScene = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * world.w;
    const y = ((e.clientY - r.top) / r.height) * world.h;
    return { x, y, inside: x >= 0 && y >= 0 && x < world.w && y < world.h };
  };
  const hitActor = (x: number, y: number) =>
    [...actors].sort((a, b) => b.spec.lane - a.spec.lane).find((a) => a.hit(world, x, y));

  const onMove = (e: PointerEvent) => {
    const s = toScene(e);
    if (e.pointerType === 'mouse') {
      world.pointerX = s.x;
      canvas.style.cursor = s.inside && hitActor(s.x, s.y) ? 'pointer' : '';
    }
    pointer = s.inside && (e.pointerType === 'mouse' || e.buttons !== 0) ? s : null;
  };
  const onDown = (e: PointerEvent) => {
    const s = toScene(e);
    if (e.pointerType !== 'mouse') world.pointerX = s.x; // cat chases the last tap
    if (!s.inside || e.target !== canvas) return;
    pointer = s;
    const a = hitActor(s.x, s.y);
    if (a?.spec.onTap) a.go(a.spec.onTap, world);
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse') pointer = null;
  };
  const onLeave = () => {
    pointer = null;
  };

  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement!);
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVisibility);
  resize();
  start();

  return {
    celebrate() {
      for (const a of actors) if (a.spec.onCelebrate) a.go(a.spec.onCelebrate, world);
    },
    setHappy(on) {
      world.happy = on;
    },
  };
}
