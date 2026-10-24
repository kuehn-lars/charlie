import { config } from '../config';
import { todayIn } from './dates';
import { h } from './dom';
import { GLYPHS, pixelIcon } from './icons';
import { createScene, type Scene } from './scene/engine';
import { createFx, type Fx } from './scene/fx';
import { TOTAL_STEPS, createStore, type Step } from './state';
import type { App, View } from './steps/common';
import { doneStep } from './steps/done';
import { noteStep } from './steps/note';
import { questionStep } from './steps/question';
import { whatStep } from './steps/what';
import { whenStep } from './steps/when';
import { validateConfig } from './validate-config';

declare global {
  interface Window {
    /** e2e builds only: overrides config.DRY_RUN without touching config.ts. */
    __CHARLIE_DRY_RUN__?: boolean;
  }
}

if (import.meta.env.DEV) {
  for (const warning of validateConfig(config, todayIn())) console.warn(`[config] ${warning}`);
}

const STEPS: Record<Step, (app: App) => View> = {
  1: questionStep,
  2: whenStep,
  3: whatStep,
  4: noteStep,
  5: doneStep,
};

const byId = (id: string) => document.getElementById(id)!;
const main = byId('main');
const content = byId('content');
const progress = byId('progress');
const announcer = byId('announcer');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function tryCreate<T>(make: () => T): T | null {
  try {
    return make();
  } catch (err) {
    console.error(err); // The flow works without canvas effects.
    return null;
  }
}

const scene: Scene | null = tryCreate(() =>
  createScene(byId('scene') as HTMLCanvasElement, {
    palette: config.palette,
    horse: config.horse,
    reducedMotion,
  }),
);
const fx: Fx | null = tryCreate(() => createFx(byId('fx') as HTMLCanvasElement, config.palette));

const store = createStore();
const app: App = {
  store,
  scene,
  fx,
  reducedMotion,
  // MODE is a build-time constant, so production bundles drop the override.
  dryRun:
    import.meta.env.MODE === 'e2e' && typeof window.__CHARLIE_DRY_RUN__ === 'boolean'
      ? window.__CHARLIE_DRY_RUN__
      : config.DRY_RUN,
  go: (step) => {
    store.set({ step });
  },
};

byId('brand').append(pixelIcon(GLYPHS.heart, 14), config.texts.brand);

const bar = h('span', { class: 'progress-bar' });
const counter = h('span');
progress.append(counter, bar);
function renderProgress(step: Step) {
  const shown = Math.min(step, TOTAL_STEPS);
  counter.textContent = `${shown} / ${TOTAL_STEPS}`;
  bar.replaceChildren(
    ...Array.from({ length: TOTAL_STEPS }, (_, i) => h('i', { 'data-on': i < shown })),
  );
}

let current: View | null = null;
let token = 0;

async function show(step: Step, initial: boolean) {
  const mine = ++token;
  const leaving = current;
  if (leaving && !reducedMotion) {
    leaving.el.dataset.leaving = '';
    await new Promise((r) => setTimeout(r, 180));
    if (mine !== token) return;
  }
  leaving?.cleanup?.();

  const view = STEPS[step](app);
  current = view;
  const hero = step === 1 || step === 5;
  main.toggleAttribute('data-hero', hero);
  main.dataset.step = String(step);
  main.dataset.ready = '';
  delete document.documentElement.dataset.boot;
  renderProgress(step);
  scene?.setHappy(step === 5);
  content.replaceChildren(view.el);

  if (!initial) {
    window.scrollTo({ top: 0, behavior: 'instant' });
    view.el.querySelector<HTMLElement>('h1, h2')?.focus({ preventScroll: true });
    announcer.textContent = config.texts.stepAnnouncement(
      Math.min(step, TOTAL_STEPS),
      TOTAL_STEPS,
      view.title,
    );
  }
  if (step === 5 && !initial) scene?.celebrate();
}

store.subscribe((state, prev) => {
  if (state.step !== prev.step) void show(state.step, false);
});
void show(store.get().step, true);
