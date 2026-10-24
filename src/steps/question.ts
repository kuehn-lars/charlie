import { config } from '../../config';
import { h } from '../dom';
import { accent, type App, type View } from './common';
import { attachNein } from './nein';

const GROW_PER_ESCAPE = 0.035;
const GROW_MAX = 1.35;

export function questionStep(app: App): View {
  const t = config.texts.question;
  const headline = h('h1', { class: 'display', tabindex: -1 }, accent(t.headline));
  const quip = h('p', { class: 'quip', 'aria-live': 'polite' });
  const yes = h('button', { type: 'button', class: 'btn btn-primary btn-lg btn-yes' }, t.yes);
  const no = h(
    'button',
    { type: 'button', class: 'btn btn-secondary btn-lg btn-no', 'data-nein': '' },
    t.no,
  );

  const grow = () => {
    const n = app.store.get().neinCount;
    yes.style.setProperty('--scale', String(Math.min(GROW_MAX, 1 + n * GROW_PER_ESCAPE)));
  };
  grow();

  const detach = attachNein({
    button: no,
    protect: () => [yes, headline],
    focusTarget: () => yes,
    reducedMotion: app.reducedMotion,
    dissolve: (el) => app.fx?.dissolve(el),
    onEscape: () => {
      const neinCount = app.store.get().neinCount + 1;
      app.store.set({ neinCount });
      quip.textContent = t.escapes[(neinCount - 1) % t.escapes.length] ?? '';
      grow();
    },
  });

  let accepted = false;
  yes.addEventListener('click', () => {
    if (accepted) return;
    accepted = true;
    if (!app.reducedMotion) app.fx?.burst(yes);
    app.scene?.celebrate();
    window.setTimeout(
      () => {
        app.go(2);
      },
      app.reducedMotion ? 0 : 750,
    );
  });

  const el = h(
    'div',
    { class: 'step hero' },
    h('p', { class: 'eyebrow' }, t.eyebrow),
    headline,
    h('div', { class: 'answer' }, yes, no),
    quip,
  );
  return { el, title: t.title, cleanup: detach };
}
