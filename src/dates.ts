/**
 * Calendar-day arithmetic on 'YYYY-MM-DD' strings.
 *
 * A calendar day has no time zone. We therefore never construct a `Date` from
 * a date-only string (`new Date('2026-10-31')` is UTC midnight, which is the
 * previous day west of Greenwich). Instead days are mapped to integer day
 * numbers via `Date.UTC`, and all arithmetic happens on those integers, so
 * DST transitions cannot shift a day. The only place a real instant is turned
 * into a calendar day is `todayIn`, which asks Intl for the wall-clock date in
 * Europe/Berlin.
 */

export const TIME_ZONE = 'Europe/Berlin';
const LOCALE = 'de-DE';
const DAY_MS = 86_400_000;

export interface Ymd {
  y: number;
  m: number; // 1-12
  d: number; // 1-31
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseDay(s: string): Ymd | null {
  const match = ISO_RE.exec(s);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return null;
  return { y, m, d };
}

export const isDay = (s: string): boolean => parseDay(s) !== null;
export const isTime = (s: string): boolean => TIME_RE.test(s);

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function formatYmd({ y, m, d }: Ymd): string {
  return `${pad(y, 4)}-${pad(m)}-${pad(d)}`;
}

function mustParse(s: string): Ymd {
  const ymd = parseDay(s);
  if (!ymd) throw new RangeError(`Invalid day: ${s}`);
  return ymd;
}

/** Days since 1970-01-01. */
export function toDayNumber(s: string): number {
  const { y, m, d } = mustParse(s);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

export function fromDayNumber(n: number): string {
  const date = new Date(n * DAY_MS);
  return formatYmd({ y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() });
}

export const addDays = (s: string, n: number): string => fromDayNumber(toDayNumber(s) + n);

/** Adds months, clamping to the last day of the target month (Jan 31 + 1 = Feb 28). */
export function addMonths(s: string, n: number): string {
  const { y, m, d } = mustParse(s);
  const index = y * 12 + (m - 1) + n;
  const ty = Math.floor(index / 12);
  const tm = (index % 12) + 1;
  return formatYmd({ y: ty, m: tm, d: Math.min(d, daysInMonth(ty, tm)) });
}

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(s: string): number {
  // 1970-01-01 was a Thursday (ISO 4).
  return ((((toDayNumber(s) + 3) % 7) + 7) % 7) + 1;
}

export const startOfMonth = (s: string): string => `${s.slice(0, 7)}-01`;

export function isBetween(s: string, from: string, to: string): boolean {
  return s >= from && s <= to;
}

/**
 * The 6x7 grid of days shown for a month, starting on the Monday on or
 * before the 1st. Always 42 days so the calendar height never changes.
 */
export function monthGrid(monthDay: string): string[] {
  const first = startOfMonth(monthDay);
  const start = addDays(first, -(isoWeekday(first) - 1));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function wallClockParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), hh: get('hour'), mm: get('minute') };
}

/** The calendar day it currently is in `timeZone`. */
export function todayIn(now: Date = new Date(), timeZone = TIME_ZONE): string {
  return formatYmd(wallClockParts(now, timeZone));
}

/** Current wall-clock time 'HH:MM' in `timeZone`. */
export function nowTimeIn(now: Date = new Date(), timeZone = TIME_ZONE): string {
  const { hh, mm } = wallClockParts(now, timeZone);
  return `${pad(hh)}:${pad(mm)}`;
}

// ---------------------------------------------------------------------------
// Formatting. Days are formatted as UTC noon in UTC, which renders exactly the
// calendar day regardless of the viewer's zone.
// ---------------------------------------------------------------------------

function dayAsDate(s: string): Date {
  const { y, m, d } = mustParse(s);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function fmt(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.DateTimeFormat(LOCALE, { timeZone: 'UTC', ...options });
    formatters.set(key, f);
  }
  return f;
}

const stripDot = (s: string) => s.replace(/\.$/, '');

/** "Sa, 31. Okt" (CLDR format-context abbreviations, dots stripped). */
export function formatDayShort(s: string): string {
  const parts = fmt({ weekday: 'short', day: 'numeric', month: 'short' }).formatToParts(
    dayAsDate(s),
  );
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    stripDot(parts.find((p) => p.type === type)?.value ?? '');
  return `${part('weekday')}, ${part('day')}. ${part('month')}`;
}

/** "Samstag, 31. Oktober 2026" */
export function formatDayLong(s: string): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    dayAsDate(s),
  );
}

/** "31. Oktober 2026", for accessible names of calendar cells. */
export function formatDayAccessible(s: string): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long' }).format(dayAsDate(s));
}

/** "Oktober 2026" */
export function formatMonth(s: string): string {
  return fmt({ month: 'long', year: 'numeric' }).format(dayAsDate(s));
}

/** ["Mo", "Di", ..., "So"] or ["Montag", ...] */
export function weekdayLabels(style: 'short' | 'long' = 'short'): string[] {
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, i) =>
    stripDot(fmt({ weekday: style }).format(dayAsDate(addDays('2024-01-01', i)))),
  );
}

/** "Samstag, 31. Oktober 2026 um 19:30 Uhr" */
export function formatSlotLong(day: string, time: string): string {
  return `${formatDayLong(day)} um ${time} Uhr`;
}

/** "Sa, 31. Okt · 19:30" */
export function formatSlotShort(day: string, time: string): string {
  return `${formatDayShort(day)} · ${time}`;
}

/** An instant as Berlin wall-clock time: "Samstag, 24. Oktober 2026 um 14:05 Uhr". */
export function formatInstant(now: Date, timeZone = TIME_ZONE): string {
  return formatSlotLong(todayIn(now, timeZone), nowTimeIn(now, timeZone));
}
