import { config } from '../../config';
import { h } from '../dom';
import { pixelIcon } from '../icons';
import { nextButton, stepFoot, stepHead, type App, type View } from './common';

export function whatStep(app: App): View {
  const t = config.texts.what;
  const multiple = config.allowMultiple;
  const next = nextButton(config.texts.next, () => {
    app.go(4);
  });
  const sync = () => {
    next.disabled = app.store.get().activities.length === 0;
  };

  const options = config.activities.map((a) => {
    const input = h('input', {
      type: multiple ? 'checkbox' : 'radio',
      name: 'activity',
      value: a.id,
      checked: app.store.get().activities.includes(a.id),
      'aria-describedby': `act-${a.id}-desc`,
    });
    input.addEventListener('change', () => {
      const current = app.store.get().activities;
      const activities = multiple
        ? input.checked
          ? [...current, a.id]
          : current.filter((id) => id !== a.id)
        : [a.id];
      app.store.set({ activities });
      sync();
    });
    return h(
      'label',
      { class: 'option', 'data-recommended': a.recommended === true },
      input,
      h('span', { class: 'option-icon' }, pixelIcon(a.icon, 48)),
      h(
        'span',
        null,
        a.recommended && a.badge ? h('span', { class: 'badge' }, a.badge) : null,
        h('span', { class: 'option-title' }, a.title),
        h('span', { class: 'option-desc', id: `act-${a.id}-desc` }, a.description),
      ),
      h('span', {
        class: multiple ? 'option-check is-box' : 'option-check',
        'aria-hidden': 'true',
      }),
    );
  });
  sync();

  const el = h(
    'div',
    { class: 'step' },
    stepHead(t.headline, multiple ? t.leadMultiple : t.leadSingle),
    h('fieldset', { class: 'options' }, h('legend', { class: 'sr-only' }, t.headline), ...options),
    stepFoot({
      back: () => {
        app.go(2);
      },
      next,
    }),
  );
  return { el, title: t.title };
}
