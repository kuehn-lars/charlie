import { config } from '../../config';
import { formatSlotShort } from '../dates';
import { h } from '../dom';
import { GLYPHS, pixelIcon } from '../icons';
import { NOTE_MAX, type Step } from '../state';
import { buildPayload, submit } from '../submit';
import { stepFoot, stepHead, type App, type View } from './common';

export function noteStep(app: App): View {
  const t = config.texts.note;
  const state = app.store.get();

  const textarea = h('textarea', {
    id: 'note',
    class: 'textarea',
    maxlength: NOTE_MAX,
    rows: 6,
    'aria-describedby': 'note-count',
  });
  textarea.value = state.note;
  const counter = h('span', { class: 'counter', id: 'note-count' });
  const updateCount = () => {
    const n = textarea.value.length;
    counter.textContent = `${n} / ${NOTE_MAX}`;
    counter.toggleAttribute('data-near', n > NOTE_MAX * 0.9);
  };
  updateCount();
  textarea.addEventListener('input', () => {
    updateCount();
    app.store.set({ note: textarea.value.slice(0, NOTE_MAX) });
  });

  // Honeypot: real people never see or tick this.
  const botcheck = h('input', {
    type: 'checkbox',
    name: 'botcheck',
    class: 'hp',
    tabindex: -1,
    autocomplete: 'off',
    'aria-hidden': 'true',
  });

  const edit = (step: Step, what: string) =>
    h(
      'button',
      {
        type: 'button',
        class: 'btn btn-ghost',
        'aria-label': `${what}: ${t.edit}`,
        onclick: () => {
          app.go(step);
        },
      },
      t.edit,
    );

  const activityTitles = state.activities.map(
    (id) => config.activities.find((a) => a.id === id)?.title ?? id,
  );

  const summary = h(
    'section',
    { class: 'summary', 'aria-labelledby': 'summary-title' },
    h('h3', { class: 'summary-title', id: 'summary-title' }, t.summaryTitle),
    h(
      'dl',
      { class: 'summary-list' },
      h(
        'div',
        { class: 'summary-row' },
        h('dt', null, t.summarySlots),
        h(
          'dd',
          null,
          h('ul', null, ...state.slots.map((s) => h('li', null, formatSlotShort(s.date, s.time)))),
        ),
        edit(2, t.summarySlots),
      ),
      h(
        'div',
        { class: 'summary-row' },
        h('dt', null, t.summaryActivity),
        h('dd', null, activityTitles.join(', ')),
        edit(3, t.summaryActivity),
      ),
    ),
  );

  const alert = h('div', { class: 'alert', role: 'alert', hidden: true });
  const send = h(
    'button',
    { type: 'button', class: 'btn btn-primary' },
    t.submit,
    pixelIcon(GLYPHS.arrow, 16),
  );

  let busy = false;
  async function onSubmit() {
    if (busy) return;
    busy = true;
    send.disabled = true;
    send.setAttribute('aria-busy', 'true');
    send.replaceChildren(h('span', { class: 'sending' }, t.sending));
    alert.hidden = true;
    const s = app.store.get();
    const payload = buildPayload(config, s, new Date(), botcheck.checked);
    const result = await submit(payload, { dryRun: app.dryRun });
    busy = false;
    if (result.ok) {
      app.go(5);
      return;
    }
    // Inputs stay in the store (and localStorage); the primary action becomes the retry.
    console.warn('[submit] failed:', result.reason);
    send.disabled = false;
    send.removeAttribute('aria-busy');
    send.replaceChildren(t.retry, pixelIcon(GLYPHS.arrow, 16));
    alert.replaceChildren(
      h('p', { class: 'alert-title' }, t.errorTitle),
      h('p', null, t.errorBody),
    );
    alert.hidden = false;
    send.focus();
  }
  send.addEventListener('click', () => void onSubmit());

  const el = h(
    'div',
    { class: 'step' },
    stepHead(t.headline, t.lead),
    h(
      'div',
      { class: 'review' },
      h(
        'div',
        { class: 'field' },
        h(
          'div',
          { class: 'field-head' },
          h('label', { class: 'field-label', for: 'note' }, t.label),
          h('span', { class: 'label' }, t.optional),
        ),
        textarea,
        counter,
        botcheck,
      ),
      summary,
    ),
    stepFoot({
      back: () => {
        app.go(3);
      },
      next: send,
      before: alert,
    }),
  );
  return { el, title: t.title };
}
