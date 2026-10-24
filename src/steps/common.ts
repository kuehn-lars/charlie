import type { Fx } from '../scene/fx';
import type { Scene } from '../scene/engine';
import type { Step, Store } from '../state';
import { config } from '../../config';
import { h } from '../dom';
import { GLYPHS, pixelIcon } from '../icons';

export interface App {
  store: Store;
  go(step: Step): void;
  scene: Scene | null;
  fx: Fx | null;
  reducedMotion: boolean;
  dryRun: boolean;
}

export interface View {
  el: HTMLElement;
  /** Accessible title, announced on entry. */
  title: string;
  cleanup?(): void;
}

/** Renders "*word*" as an accent <em>. Text only, no HTML parsing. */
export function accent(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  text.split(/\*([^*]+)\*/).forEach((part, i) => {
    if (part) frag.append(i % 2 ? h('em', null, part) : part);
  });
  return frag;
}

export function stepHead(title: string, lead: string): HTMLElement {
  return h(
    'header',
    { class: 'step-head' },
    h('h2', { class: 'step-title', tabindex: -1 }, accent(title)),
    h('p', { class: 'lead' }, lead),
  );
}

export function stepFoot(opts: {
  back: () => void;
  next: HTMLButtonElement;
  /** Full-width row above the buttons, e.g. a submission error. */
  before?: HTMLElement;
}): HTMLElement {
  return h(
    'footer',
    { class: 'step-foot' },
    opts.before,
    h(
      'button',
      { type: 'button', class: 'btn btn-ghost', onclick: opts.back },
      pixelIcon(GLYPHS.left, 16),
      config.texts.back,
    ),
    opts.next,
  );
}

export function nextButton(label: string, onClick: () => void): HTMLButtonElement {
  return h(
    'button',
    { type: 'button', class: 'btn btn-primary', onclick: onClick },
    label,
    pixelIcon(GLYPHS.arrow, 16),
  );
}
