/**
 * Renders public/og.png (1200x630) and public/apple-touch-icon.png (180x180).
 *
 * The scene pixels come from the same backdrop and sprite code as the site,
 * rendered in Node; Playwright only adds typography (real Geist) and takes
 * the screenshot. Run after changing palette, horse colors or texts:
 *
 *   npm run og
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { crc32, deflateSync } from 'node:zlib';
import { config } from '../config';
import type { World } from '../src/scene/actor';
import { createCat } from '../src/scene/animals/cat';
import { createDog } from '../src/scene/animals/dog';
import { createLewin } from '../src/scene/animals/lewin';
import { backdropColors, buildBackdrop, drawParticles } from '../src/scene/backdrop';

const W = 1200;
const H = 630;
const PIXEL = 5;
const INSET = 20;
const FW = W - INSET * 2;
const FH = H - INSET * 2;

function png(width: number, height: number, rgbaBytes: Uint8Array): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    raw.set(rgbaBytes.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function sceneDataUrl(): string {
  const w = FW / PIXEL;
  const h = Math.ceil(FH / PIXEL);
  const backdrop = buildBackdrop(w, h, backdropColors(config.palette));
  const buf = backdrop.base.slice();
  drawParticles(backdrop.particles, buf, w, h);
  const world: World = {
    w,
    h,
    horizon: backdrop.layout.horizon,
    reducedMotion: true,
    pointerX: null,
    happy: false,
    hearts: () => undefined,
    random: () => 0.5,
  };
  const lewin = createLewin(config.horse, Math.round(w * 0.5));
  lewin.go('graze', world);
  const dog = createDog(Math.round(w * 0.3));
  dog.dir = 1;
  const cat = createCat(Math.round(w * 0.16));
  for (const a of [lewin, dog, cat]) a.draw({ w, h, px: buf }, world);
  return `data:image/png;base64,${png(w, h, new Uint8Array(buf.buffer)).toString('base64')}`;
}

const font = (file: string) =>
  `data:font/woff2;base64,${readFileSync(new URL(`../node_modules/${file}`, import.meta.url)).toString('base64')}`;

const css = `
@font-face { font-family: Geist; src: url(${font('@fontsource-variable/geist/files/geist-latin-wght-normal.woff2')}); font-weight: 100 900; }
@font-face { font-family: 'Geist Mono'; src: url(${font('@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2')}); font-weight: 100 900; }
html, body { margin: 0; background: ${config.palette.bg}; }
img { display: block; image-rendering: pixelated; }
`;

const accent = (s: string) =>
  s.replace(
    /\*([^*]+)\*/g,
    `<em style="font-style:normal;color:${config.palette.roseInk}">$1</em>`,
  );

const ogHtml = `<!doctype html><meta charset="utf-8"><style>${css}
.og { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; }
.frame { position: absolute; inset: ${INSET}px; overflow: hidden; border: 2px solid ${config.palette.border}; border-radius: 28px; }
.frame img { position: absolute; left: -2px; bottom: -2px; width: ${FW}px; height: ${Math.ceil(FH / PIXEL) * PIXEL}px; }
.copy { position: absolute; left: 84px; top: 92px; }
.pill { display: inline-block; padding: 10px 18px; border: 2px solid ${config.palette.rose}88; border-radius: 999px;
  font: 500 22px/1 'Geist Mono'; color: ${config.palette.roseInk}; background: ${config.palette.bg}cc; }
h1 { margin: 34px 0 0; font: 500 124px/0.98 Geist; letter-spacing: -0.05em; color: ${config.palette.ink}; }
</style>
<div class="og">
  <div class="frame"><img src="${sceneDataUrl()}" alt=""></div>
  <div class="copy">
    <span class="pill">${config.texts.question.eyebrow}</span>
    <h1>${accent(config.texts.documentTitle.replace(config.names.her, `*${config.names.her}*`))}</h1>
  </div>
</div>`;

const iconHtml = `<!doctype html><meta charset="utf-8"><style>${css}
.icon { width: 180px; height: 180px; display: grid; place-items: center; background: ${config.palette.bg}; }
</style>
<div class="icon"><img src="data:image/svg+xml;base64,${readFileSync(new URL('../public/favicon.svg', import.meta.url)).toString('base64')}" width="126" height="112" alt=""></div>`;

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.setViewportSize({ width: W, height: H });
await page.setContent(ogHtml);
await page.evaluate(() => document.fonts.ready);
writeFileSync(
  new URL('../public/og.png', import.meta.url),
  await page.locator('.og').screenshot({ type: 'png' }),
);
await page.setContent(iconHtml);
writeFileSync(
  new URL('../public/apple-touch-icon.png', import.meta.url),
  await page.locator('.icon').screenshot({ type: 'png' }),
);
await browser.close();
console.log('wrote public/og.png and public/apple-touch-icon.png');
