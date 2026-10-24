import { config } from '../../config';
import { formatDayShort, isTime, todayIn } from '../dates';
import { h } from '../dom';
import { GLYPHS, pixelIcon } from '../icons';
import {
  addSlot,
  bounds,
  dayStatus,
  hasSlot,
  isPastTime,
  removeSlot,
  slotKey,
  type Slot,
} from '../schedule';
import { createCalendar } from './calendar';
import { nextButton, stepFoot, stepHead, type App, type View } from './common';

export function whenStep(app: App): View {
  const t = config.texts.when;
  const now = new Date();
  const today = todayIn(now);
  const { min, max } = bounds(config, today);
  const slots = () => app.store.get().slots;

  let selected: string | null = slots()[0]?.date ?? null;
  let customOpen = false;

  const dayBox = h('section', { 'aria-labelledby': 'day-title' });
  const slotBox = h('section', { 'aria-labelledby': 'slots-title' });
  const msg = h('p', { class: 'msg', 'aria-live': 'polite' });

  const next = nextButton(config.texts.next, () => {
    app.go(3);
  });

  const calendar = createCalendar({
    today,
    min,
    max,
    initial: selected ?? min,
    status: (d) => dayStatus(config, today, d),
    isSelected: (d) => d === selected,
    hasSlots: (d) => slots().some((s) => s.date === d),
    onSelect: (d) => {
      selected = d;
      msg.textContent = '';
      refresh();
      // On phones the time chips are below the fold; bring them into view.
      if (window.matchMedia('(max-width: 899px)').matches) {
        dayBox.scrollIntoView({
          behavior: app.reducedMotion ? 'auto' : 'smooth',
          block: 'nearest',
        });
      }
    },
  });

  function toggle(slot: Slot) {
    if (hasSlot(slots(), slot)) {
      app.store.set({ slots: removeSlot(slots(), slot) });
      msg.textContent = '';
    } else {
      const result = addSlot(slots(), slot, config.maxSlots);
      if (!result.ok) {
        msg.textContent = result.error === 'max' ? t.maxReached(config.maxSlots) : t.duplicate;
        return;
      }
      app.store.set({ slots: result.slots });
      msg.textContent = '';
    }
    refresh();
  }

  function renderDay() {
    if (!selected) {
      dayBox.replaceChildren(
        h('h3', { class: 'panel-title', id: 'day-title' }, t.timesTitle),
        h('p', { class: 'hint' }, t.pickDayHint),
      );
      return;
    }
    const day = selected;
    const status = dayStatus(config, today, day);
    const own = slots()
      .filter((s) => s.date === day)
      .map((s) => s.time);
    const times = [...new Set([...config.timePresets, ...own])].sort();
    const chips = times.map((time) => {
      const slot = { date: day, time };
      const past = isPastTime(slot, now);
      return h(
        'button',
        {
          type: 'button',
          class: 'chip',
          'data-focus-key': `time-${time}`,
          'aria-pressed': String(hasSlot(slots(), slot)),
          disabled: past,
          title: past ? t.pastTime : null,
          onclick: () => {
            toggle(slot);
          },
        },
        time,
      );
    });
    const other = h(
      'button',
      {
        type: 'button',
        class: 'chip chip-other',
        'data-focus-key': 'other',
        'aria-expanded': String(customOpen),
        'aria-controls': 'custom-time-row',
        onclick: () => {
          customOpen = !customOpen;
          renderDay();
          if (customOpen) document.getElementById('custom-time')?.focus();
        },
      },
      t.customTime,
    );

    const input = h('input', {
      id: 'custom-time',
      class: 'input',
      type: 'time',
      step: 300,
      required: true,
    });
    const add = h('button', { type: 'submit', class: 'btn btn-secondary' }, t.add);
    const custom = h(
      'form',
      {
        class: 'custom',
        id: 'custom-time-row',
        hidden: !customOpen,
        onsubmit: (e: Event) => {
          e.preventDefault();
          const time = input.value.slice(0, 5);
          if (!isTime(time)) return;
          const slot = { date: day, time };
          if (isPastTime(slot, now)) {
            msg.textContent = t.pastTime;
            return;
          }
          if (hasSlot(slots(), slot)) {
            msg.textContent = t.duplicate;
            return;
          }
          customOpen = false; // the new time now shows up as a chip
          toggle(slot);
          dayBox.querySelector<HTMLElement>(`[data-focus-key="time-${time}"]`)?.focus();
        },
      },
      h(
        'div',
        { class: 'field' },
        h('label', { class: 'label', for: 'custom-time' }, t.customTimeLabel),
        input,
      ),
      add,
    );

    dayBox.replaceChildren(
      h(
        'h3',
        { class: 'panel-title', id: 'day-title' },
        t.timesFor(formatDayShort(day)),
        status.kind === 'available' && status.label
          ? h('span', { class: 'label' }, status.label)
          : null,
      ),
      h('div', { class: 'chips', role: 'group', 'aria-labelledby': 'day-title' }, ...chips, other),
      custom,
      msg,
    );
  }

  let shown = new Set(slots().map(slotKey));

  function renderSlots() {
    const list = slots();
    const fresh = (s: Slot) => !shown.has(slotKey(s));
    const count = h('span', { class: 'label' }, `${list.length} / ${config.maxSlots}`);
    const body =
      list.length === 0
        ? h('p', { class: 'empty' }, t.slotsEmpty)
        : h(
            'ul',
            { class: 'slots' },
            ...list.map((slot) => {
              const label = `${formatDayShort(slot.date)} · ${slot.time}`;
              return h(
                'li',
                { class: 'slot', 'data-new': fresh(slot) },
                h(
                  'span',
                  { class: 'slot-label' },
                  formatDayShort(slot.date),
                  h('span', { class: 'mono' }, slot.time),
                ),
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'icon-btn',
                    'aria-label': t.remove(label),
                    onclick: () => {
                      toggle(slot);
                    },
                  },
                  pixelIcon(GLYPHS.close, 14),
                ),
              );
            }),
          );
    shown = new Set(list.map(slotKey));
    slotBox.replaceChildren(
      h('h3', { class: 'panel-title', id: 'slots-title' }, t.slotsTitle, count),
      body,
    );
  }

  /** Re-renders the panels, keeping keyboard focus on the same control. */
  function refresh() {
    const key = (document.activeElement as HTMLElement | null)?.dataset.focusKey;
    calendar.refresh();
    renderDay();
    renderSlots();
    next.disabled = slots().length === 0;
    if (key) dayBox.querySelector<HTMLElement>(`[data-focus-key="${key}"]`)?.focus();
  }
  refresh();

  const el = h(
    'div',
    { class: 'step when' },
    stepHead(t.headline, t.lead),
    calendar.el,
    h('div', { class: 'panel' }, dayBox, slotBox),
    stepFoot({
      back: () => {
        app.go(1);
      },
      next,
    }),
  );
  return { el, title: t.title };
}
