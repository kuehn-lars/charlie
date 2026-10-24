import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite';
import { config, type Palette } from './config';
import { STORAGE_KEY } from './src/state';
import { THEME_KEY } from './src/theme';

/**
 * The Vite base is the path of SITE_URL ('/charlie/' for
 * https://kuehn-lars.github.io/charlie/). It must match the GitHub repo name
 * for project Pages; SITE_URL in config.ts is the single place to change it.
 */
const base = new URL(config.SITE_URL).pathname;

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Palette as CSS custom properties; color lists become --sky-0, --sky-1, ... */
const cssVars = (palette: Palette) =>
  Object.entries(palette)
    .flatMap(([k, v]) =>
      Array.isArray(v) ? v.map((c, i) => `--${kebab(k)}-${i}:${c}`) : [`--${kebab(k)}:${v}`],
    )
    .join(';');

/** Injects everything config-driven into <head> at build (and dev) time. */
function headInject(): Plugin {
  const { texts, palette, paletteDark, SITE_URL } = config;
  const ogImage = new URL('og.png', SITE_URL).href;
  const meta = (attrs: Record<string, string>): HtmlTagDescriptor => ({
    tag: 'meta',
    attrs,
    injectTo: 'head',
  });
  return {
    name: 'fuer-charlie:head',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const tags: HtmlTagDescriptor[] = [
          { tag: 'title', children: texts.documentTitle, injectTo: 'head-prepend' },
          meta({ name: 'description', content: texts.shareDescription }),
          meta({ name: 'theme-color', content: palette.bg }),
          meta({ property: 'og:type', content: 'website' }),
          meta({ property: 'og:locale', content: 'de_DE' }),
          meta({ property: 'og:url', content: SITE_URL }),
          meta({ property: 'og:title', content: texts.documentTitle }),
          meta({ property: 'og:description', content: texts.shareDescription }),
          meta({ property: 'og:image', content: ogImage }),
          meta({ property: 'og:image:width', content: '1200' }),
          meta({ property: 'og:image:height', content: '630' }),
          meta({ property: 'og:image:alt', content: texts.documentTitle }),
          meta({ name: 'twitter:card', content: 'summary_large_image' }),
          meta({ name: 'twitter:title', content: texts.documentTitle }),
          meta({ name: 'twitter:description', content: texts.shareDescription }),
          meta({ name: 'twitter:image', content: ogImage }),
          {
            tag: 'style',
            // Explicit choice wins; without JS the system preference decides.
            children:
              `:root{color-scheme:light;${cssVars(palette)}}` +
              `:root[data-theme=dark]{color-scheme:dark;${cssVars(paletteDark)}}` +
              `@media (prefers-color-scheme:dark){:root:not([data-theme=light]){color-scheme:dark;${cssVars(paletteDark)}}}`,
            injectTo: 'head',
          },
          {
            // Apply the resumed step before first paint so the stage height
            // does not jump when the app boots on step 2-4. Same for the theme,
            // so dark mode never flashes light.
            tag: 'script',
            children: `var d=document.documentElement;try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||'{}').step;if(s>1&&s<5)d.dataset.boot=String(s)}catch(e){}try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}d.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'`,
            injectTo: 'head',
          },
        ];
        // Preload the two latin font files once they have hashed names.
        for (const file of Object.keys(ctx.bundle ?? {})) {
          if (/geist(-mono)?-latin-wght-normal.*\.woff2$/.test(file)) {
            tags.push({
              tag: 'link',
              attrs: {
                rel: 'preload',
                href: base + file,
                as: 'font',
                type: 'font/woff2',
                crossorigin: '',
              },
              injectTo: 'head',
            });
          }
        }
        return tags;
      },
    },
  };
}

export default defineConfig(({ mode }) => ({
  base,
  plugins: [headInject()],
  build: {
    target: 'es2022',
    outDir: mode === 'e2e' ? 'dist-e2e' : 'dist',
    assetsInlineLimit: 0,
  },
  preview: { port: mode === 'e2e' ? 4174 : 4173, strictPort: true },
}));
