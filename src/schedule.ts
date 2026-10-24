import type { BlockedDay, BlockedRange, Config } from '../config';
import { addMonths, isBetween, isoWeekday, isTime, todayIn, nowTimeIn } from './dates';

export interface Slot {
  date: string;
  time: string;
}

export type DayStatus =
  | { kind: 'outside' }
  | { kind: 'blocked'; reason: string | undefined }
  | { kind: 'available'; label: string | undefined };

type ScheduleConfig = Pick<
  Config,
  'minDate' | 'maxDate' | 'blockedDates' | 'highlightedDates' | 'blockedWeekdays'
>;

export const isRange = (b: BlockedDay | BlockedRange): b is BlockedRange => 'from' in b;

/** Resolves config bounds against "today" in Berlin. Today is never undercut. */
export function bounds(cfg: ScheduleConfig, today: string): { min: string; max: string } {
  const min = cfg.minDate && cfg.minDate > today ? cfg.minDate : today;
  const max = cfg.maxDate ?? addMonths(today, 3);
  return { min, max };
}

export function dayStatus(cfg: ScheduleConfig, today: string, day: string): DayStatus {
  const { min, max } = bounds(cfg, today);
  if (day < min || day > max) return { kind: 'outside' };
  for (const b of cfg.blockedDates) {
    if (isRange(b) ? isBetween(day, b.from, b.to) : b.date === day) {
      return { kind: 'blocked', reason: b.reason };
    }
  }
  if (cfg.blockedWeekdays.includes(isoWeekday(day))) return { kind: 'blocked', reason: undefined };
  const highlight = cfg.highlightedDates.find((h) => h.date === day);
  return { kind: 'available', label: highlight?.label };
}

export const isSelectable = (cfg: ScheduleConfig, today: string, day: string): boolean =>
  dayStatus(cfg, today, day).kind === 'available';

/** A time on today's date that has already passed (Berlin) is not offered. */
export function isPastTime(slot: Slot, now: Date): boolean {
  return slot.date === todayIn(now) && slot.time <= nowTimeIn(now);
}

export const slotKey = (s: Slot): string => `${s.date}T${s.time}`;

export const sortSlots = (slots: readonly Slot[]): Slot[] =>
  [...slots].sort((a, b) => slotKey(a).localeCompare(slotKey(b)));

export const hasSlot = (slots: readonly Slot[], slot: Slot): boolean =>
  slots.some((s) => slotKey(s) === slotKey(slot));

export type AddResult = { ok: true; slots: Slot[] } | { ok: false; error: 'duplicate' | 'max' };

export function addSlot(slots: readonly Slot[], slot: Slot, max: number): AddResult {
  if (hasSlot(slots, slot)) return { ok: false, error: 'duplicate' };
  if (slots.length >= max) return { ok: false, error: 'max' };
  return { ok: true, slots: sortSlots([...slots, slot]) };
}

export const removeSlot = (slots: readonly Slot[], slot: Slot): Slot[] =>
  slots.filter((s) => slotKey(s) !== slotKey(slot));

/** Drops persisted slots that are malformed or no longer selectable (e.g. now in the past). */
export function sanitizeSlots(
  cfg: ScheduleConfig,
  now: Date,
  slots: readonly unknown[],
  max: number,
): Slot[] {
  const today = todayIn(now);
  const valid = slots.filter(
    (s): s is Slot =>
      typeof s === 'object' &&
      s !== null &&
      typeof (s as Slot).date === 'string' &&
      typeof (s as Slot).time === 'string' &&
      isTime((s as Slot).time) &&
      isSelectable(cfg, today, (s as Slot).date) &&
      !isPastTime(s as Slot, now),
  );
  const unique = valid.filter((s, i) => valid.findIndex((o) => slotKey(o) === slotKey(s)) === i);
  return sortSlots(unique).slice(0, max);
}
