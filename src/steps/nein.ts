/**
 * The "Nein" button that cannot be pressed. Behavior is decided per event by
 * `pointerType`, not by media queries, so hybrid devices (touch laptops,
 * iPad with trackpad) get the right behavior for the input actually used.
 *
 * - mouse: when the cursor comes within PROXIMITY px (and is nearer to Nein
 *   than to Ja, so reaching for Ja never counts), the button jumps to a random
 *   spot inside the viewport, away from the cursor, never overlapping the
 *   protected elements (Ja, headline). While in flight it is click-through.
 * - touch / pen: on pointerdown it dissolves into pixels and is gone.
 * - keyboard / assistive tech: focusing it makes it escape and hands focus to
 *   Ja; any activation is swallowed.
 *
 * No click on it ever reaches a handler: clicks are cancelled in the capture
 * phase at the window, and the synthetic click after a touch is prevented at
 * touchend.
 */

export const PROXIMITY = 100;
const EDGE = 16;
const KEEP_CLEAR = 12;
const MIN_JUMP = 220;
const COOLDOWN_MS = 350;

export interface NeinOptions {
  button: HTMLButtonElement;
  /** Elements the button must never cover. */
  protect: () => readonly Element[];
  /** Where focus goes when the button is focused. */
  focusTarget: () => HTMLElement;
  reducedMotion: boolean;
  onEscape(): void;
  dissolve(el: HTMLElement): void;
}

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

const overlaps = (a: Rect, b: Rect) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

const inflate = (r: DOMRect, by: number): Rect => ({
  left: r.left - by,
  top: r.top - by,
  right: r.right + by,
  bottom: r.bottom + by,
});

function distanceToRect(x: number, y: number, r: Rect): number {
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

/**
 * Picks a top-left position for a `w x h` box inside the viewport that
 * avoids `protect` and is as far as practical from the pointer. Exported for
 * unit tests.
 */
export function pickSpot(
  viewport: { w: number; h: number },
  size: { w: number; h: number },
  pointer: { x: number; y: number },
  protect: readonly Rect[],
  random: () => number = Math.random,
): { x: number; y: number } | null {
  const maxX = viewport.w - size.w - EDGE;
  const maxY = viewport.h - size.h - EDGE;
  if (maxX < EDGE || maxY < EDGE) return null;
  let best: { x: number; y: number; d: number } | null = null;
  for (let i = 0; i < 60; i++) {
    const x = EDGE + random() * (maxX - EDGE);
    const y = EDGE + random() * (maxY - EDGE);
    const box = { left: x, top: y, right: x + size.w, bottom: y + size.h };
    if (protect.some((p) => overlaps(box, p))) continue;
    const d = distanceToRect(pointer.x, pointer.y, box);
    if (d >= MIN_JUMP) return { x, y };
    if (!best || d > best.d) best = { x, y, d };
  }
  return best && best.d > PROXIMITY ? { x: best.x, y: best.y } : null;
}

export function attachNein(opts: NeinOptions): () => void {
  const { button } = opts;
  let gone = false;
  let escaped = false;

  const isNein = (t: EventTarget | null) => t instanceof Node && button.contains(t);

  let lastEscape = -Infinity;

  function escape(from: { x: number; y: number }) {
    // One escape per approach: ignore triggers while the button is in flight.
    if (gone || performance.now() - lastEscape < COOLDOWN_MS) return;
    lastEscape = performance.now();
    opts.onEscape();
    if (opts.reducedMotion) {
      vanish(false);
      return;
    }
    const rect = button.getBoundingClientRect();
    if (!escaped) {
      // Re-parent to <body> so position: fixed is relative to the viewport
      // even inside transformed / animated ancestors.
      escaped = true;
      button.style.setProperty('--x', `${rect.left}px`);
      button.style.setProperty('--y', `${rect.top}px`);
      button.dataset.escaped = '';
      document.body.append(button);
    }
    const spot = pickSpot(
      { w: document.documentElement.clientWidth, h: window.innerHeight },
      { w: rect.width, h: rect.height },
      from,
      opts.protect().map((el) => inflate(el.getBoundingClientRect(), KEEP_CLEAR)),
    );
    if (!spot) {
      vanish(false); // Viewport too cramped to run anywhere: just leave.
      return;
    }
    // Click-through while flying, so a fast click lands behind it, not on it.
    button.style.pointerEvents = 'none';
    window.setTimeout(() => {
      button.style.pointerEvents = '';
    }, COOLDOWN_MS);
    // Next frame, so the first jump animates from the original position.
    requestAnimationFrame(() => {
      button.style.setProperty('--x', `${spot.x}px`);
      button.style.setProperty('--y', `${spot.y}px`);
    });
  }

  function vanish(dissolve: boolean) {
    if (gone) return;
    gone = true;
    if (dissolve && !opts.reducedMotion) opts.dissolve(button);
    if (document.activeElement === button) opts.focusTarget().focus();
    button.style.visibility = 'hidden';
    button.setAttribute('aria-hidden', 'true');
    button.tabIndex = -1;
  }

  const onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || gone) return;
    const d = distanceToRect(e.clientX, e.clientY, button.getBoundingClientRect());
    if (d >= PROXIMITY) return;
    const yes = opts.focusTarget().getBoundingClientRect();
    if (distanceToRect(e.clientX, e.clientY, yes) <= d) return;
    escape({ x: e.clientX, y: e.clientY });
  };

  const onDown = (e: PointerEvent) => {
    e.preventDefault(); // no focus, no compat mouse events
    if (e.pointerType === 'mouse') {
      escape({ x: e.clientX, y: e.clientY });
    } else {
      opts.onEscape();
      vanish(true);
    }
  };

  // Suppresses the click a tap would synthesize.
  const onTouchEnd = (e: TouchEvent) => {
    e.preventDefault();
  };

  const onClickCapture = (e: MouseEvent) => {
    if (!isNein(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const r = button.getBoundingClientRect();
    escape({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  };

  const onFocus = () => {
    const r = button.getBoundingClientRect();
    escape({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
    opts.focusTarget().focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') e.preventDefault();
  };

  const onResize = () => {
    if (!escaped || gone) return;
    const r = button.getBoundingClientRect();
    if (r.right > window.innerWidth || r.bottom > window.innerHeight)
      escape({ x: r.left, y: r.top });
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('click', onClickCapture, true);
  window.addEventListener('resize', onResize);
  button.addEventListener('pointerdown', onDown);
  button.addEventListener('touchend', onTouchEnd, { passive: false });
  button.addEventListener('focus', onFocus);
  button.addEventListener('keydown', onKey);

  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('click', onClickCapture, true);
    window.removeEventListener('resize', onResize);
    // An escaped button lives in <body>; take it with us.
    if (escaped) button.remove();
  };
}
