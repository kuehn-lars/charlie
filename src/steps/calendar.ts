import { config } from '../../config';
import {
  addDays,
  addMonths,
  formatDayAccessible,
  formatDayShort,
  formatMonth,
  monthGrid,
  startOfMonth,
  weekdayLabels,
} from '../dates';
import { h } from '../dom';
import { GLYPHS, pixelIcon } from '../icons';
import type { DayStatus } from '../schedule';

export interface CalendarOptions {
  today: string;
  min: string;
  max: string;
  /** Initially visible / focused day. */
  initial: string;
  status(day: string): DayStatus;
  isSelected(day: string): boolean;
  hasSlots(day: string): boolean;
  onSelect(day: string): void;
}

export interface Calendar {
  el: HTMLElement;
  refresh(): void;
}

/**
 * Month grid following the WAI-ARIA date grid pattern: one roving tab stop,
 * arrows move by day/week, Home/End to week edges, PageUp/PageDown by month.
 * Unavailable days stay focusable (aria-disabled) so their reason can be read.
 */
export function createCalendar(o: CalendarOptions): Calendar {
  const t = config.texts.when;
  const first = startOfMonth(o.min);
  const lastMonth = startOfMonth(o.max);
  const last = addDays(addMonths(lastMonth, 1), -1);
  const clampDay = (d: string) => (d < first ? first : d > last ? last : d);

  let month = startOfMonth(o.initial);
  let focusDay = clampDay(o.initial);
  let revealed: string | null = null;

  const titleId = 'cal-title';
  const title = h('h3', { class: 'cal-title', id: titleId, 'aria-live': 'polite' });
  const prev = h(
    'button',
    { type: 'button', class: 'icon-btn', 'aria-label': t.prevMonth },
    pixelIcon(GLYPHS.left, 16),
  );
  const next = h(
    'button',
    { type: 'button', class: 'icon-btn', 'aria-label': t.nextMonth },
    pixelIcon(GLYPHS.right, 16),
  );
  const tbody = h('tbody');
  const info = h('p', { class: 'cal-info', 'aria-live': 'polite' });

  const describe = (day: string, s: DayStatus): string => {
    if (s.kind === 'blocked')
      return `${formatDayShort(day)}: ${s.reason ?? t.blockedFallbackReason}`;
    if (s.kind === 'available' && s.label) return `${formatDayShort(day)}: ${s.label}`;
    return '';
  };

  function render() {
    // Rebuilding the grid must not drop keyboard focus.
    const hadFocus = tbody.contains(document.activeElement);
    title.textContent = formatMonth(month);
    prev.disabled = month <= first;
    next.disabled = month >= lastMonth;
    const days = monthGrid(month);
    const rows: HTMLTableRowElement[] = [];
    for (let r = 0; r < 6; r++) {
      const tr = h('tr');
      for (let c = 0; c < 7; c++) {
        const day = days[r * 7 + c]!;
        const td = h('td', { role: 'gridcell' });
        if (startOfMonth(day) === month) {
          const s = o.status(day);
          const selected = o.isSelected(day);
          const unavailable = s.kind !== 'available';
          const extra =
            s.kind === 'blocked'
              ? `, ${s.reason ?? t.blockedFallbackReason}`
              : s.kind === 'available' && s.label
                ? `, ${s.label}`
                : '';
          const btn = h(
            'button',
            {
              type: 'button',
              class: 'day',
              'data-day': day,
              tabindex: day === focusDay ? 0 : -1,
              'aria-label': formatDayAccessible(day) + extra,
              'aria-pressed': String(selected),
              'aria-disabled': unavailable ? 'true' : null,
              'aria-current': day === o.today ? 'date' : null,
              'data-today': day === o.today,
              'data-blocked': s.kind === 'blocked',
              'data-outside': s.kind === 'outside',
              'data-highlight': s.kind === 'available' && Boolean(s.label),
              'data-has-slots': o.hasSlots(day),
              'data-revealed': revealed === day,
            },
            String(Number(day.slice(8))),
          );
          td.setAttribute('aria-selected', String(selected));
          td.append(btn);
        }
        tr.append(td);
      }
      rows.push(tr);
    }
    tbody.replaceChildren(...rows);
    if (hadFocus) {
      tbody
        .querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)
        ?.focus({ preventScroll: true });
    }
  }

  function focusOn(day: string) {
    focusDay = clampDay(day);
    if (startOfMonth(focusDay) !== month) {
      month = startOfMonth(focusDay);
      render();
    } else {
      for (const b of tbody.querySelectorAll<HTMLButtonElement>('.day')) {
        b.tabIndex = b.dataset.day === focusDay ? 0 : -1;
      }
    }
    tbody.querySelector<HTMLButtonElement>(`[data-day="${focusDay}"]`)?.focus();
  }

  function showMonth(delta: number) {
    month = addMonths(month, delta);
    focusDay = clampDay(addMonths(focusDay, delta));
    if (startOfMonth(focusDay) !== month) focusDay = clampDay(month);
    render();
  }

  prev.addEventListener('click', () => {
    showMonth(-1);
  });
  next.addEventListener('click', () => {
    showMonth(1);
  });

  const dayOf = (e: Event) => (e.target as Element).closest<HTMLButtonElement>('.day')?.dataset.day;

  tbody.addEventListener('click', (e) => {
    const day = dayOf(e);
    if (!day) return;
    focusDay = day;
    const s = o.status(day);
    info.textContent = describe(day, s);
    if (s.kind !== 'available') {
      revealed = day;
      render();
      return;
    }
    revealed = null;
    o.onSelect(day);
  });

  // Hover / focus reveal reasons and labels, so nothing depends on hover alone.
  const peek = (e: Event) => {
    const day = dayOf(e);
    if (day) info.textContent = describe(day, o.status(day)) || info.textContent;
  };
  tbody.addEventListener('pointerover', peek);
  tbody.addEventListener('focusin', peek);

  tbody.addEventListener('keydown', (e) => {
    const day = dayOf(e);
    if (!day) return;
    const col = [...(e.target as HTMLElement).closest('tr')!.children].indexOf(
      (e.target as HTMLElement).closest('td')!,
    );
    const moves: Record<string, () => string> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      Home: () => addDays(day, -col),
      End: () => addDays(day, 6 - col),
      PageUp: () => addMonths(day, -1),
      PageDown: () => addMonths(day, 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    focusOn(move());
  });

  render();

  const legendItems = new Set(
    config.highlightedDates.filter((d) => d.date >= o.min && d.date <= o.max).map((d) => d.label),
  );

  const el = h(
    'div',
    { class: 'cal' },
    h('div', { class: 'cal-head' }, title, h('div', { class: 'cal-nav' }, prev, next)),
    h(
      'table',
      { class: 'cal-grid', role: 'grid', 'aria-labelledby': titleId },
      h(
        'thead',
        null,
        h(
          'tr',
          null,
          ...weekdayLabels('short').map((label, i) =>
            h('th', { scope: 'col', abbr: weekdayLabels('long')[i] }, label),
          ),
        ),
      ),
      tbody,
    ),
    info,
    h(
      'p',
      { class: 'legend', 'aria-hidden': 'true' },
      ...[...legendItems].map((label) => h('span', null, h('i', { class: 'lg-highlight' }), label)),
      h('span', null, h('i', { class: 'lg-blocked' }), t.blockedFallbackReason),
      h('span', null, h('i', { class: 'lg-slot' }), t.slotsTitle),
    ),
  );
  return { el, refresh: render };
}
