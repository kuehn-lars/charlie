import { config } from '../../config';
import { formatSlotShort } from '../dates';
import { h } from '../dom';
import { accent, type App, type View } from './common';

export function doneStep(app: App): View {
  const t = config.texts.done;
  const { slots } = app.store.get();
  const el = h(
    'div',
    { class: 'step hero done' },
    h('p', { class: 'eyebrow' }, t.eyebrow),
    h('h1', { class: 'display', tabindex: -1 }, accent(t.headline)),
    h('p', { class: 'lead' }, t.body),
    h(
      'ul',
      { class: 'recap' },
      ...slots.map((s) => h('li', null, formatSlotShort(s.date, s.time))),
    ),
  );
  return { el, title: t.title };
}
