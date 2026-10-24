/**
 * Integer pixel scaling. A canvas whose backing store is `w x h` scene pixels
 * is stretched by CSS so each scene pixel covers exactly `device` physical
 * pixels; with `image-rendering: pixelated` that is crisp at any DPR.
 */
export interface PixelGrid {
  w: number;
  h: number;
  /** Physical pixels per scene pixel. */
  device: number;
  /** CSS pixels per scene pixel (device / dpr, may be fractional). */
  css: number;
}

export function pixelGrid(cssW: number, cssH: number, cssPixel: number): PixelGrid {
  const dpr = window.devicePixelRatio || 1;
  const device = Math.max(1, Math.round(cssPixel * dpr));
  const css = device / dpr;
  return {
    w: Math.max(1, Math.ceil(cssW / css)),
    h: Math.max(1, Math.ceil(cssH / css)),
    device,
    css,
  };
}

export function applyGrid(canvas: HTMLCanvasElement, g: PixelGrid): void {
  canvas.width = g.w;
  canvas.height = g.h;
  canvas.style.width = `${g.w * g.css}px`;
  canvas.style.height = `${g.h * g.css}px`;
}
