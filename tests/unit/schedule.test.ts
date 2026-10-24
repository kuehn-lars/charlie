import { describe, expect, it } from 'vitest';
import {
  addSlot,
  bounds,
  dayStatus,
  dayTimes,
  isPastTime,
  removeSlot,
  sanitizeSlots,
  sortSlots,
} from '../../src/schedule';

const cfg = {
  minDate: undefined,
  maxDate: undefined,
  blockedDates: [{ from: '2026-11-13', to: '2026-11-15', reason: 'Reise' }, { date: '2026-11-21' }],
  highlightedDates: [{ date: '2026-10-31', label: 'Lars hat frei' }],
  blockedWeekdays: [1],
};
const today = '2026-10-24';

describe('bounds', () => {
  it('defaults to today until three months ahead', () => {
    expect(bounds(cfg, today)).toEqual({ min: '2026-10-24', max: '2027-01-24' });
  });
  it('never lets minDate undercut today', () => {
    expect(bounds({ ...cfg, minDate: '2026-01-01' }, today).min).toBe(today);
    expect(bounds({ ...cfg, minDate: '2026-11-01' }, today).min).toBe('2026-11-01');
  });
});

describe('dayStatus', () => {
  it('excludes past and out-of-range days', () => {
    expect(dayStatus(cfg, today, '2026-10-23').kind).toBe('outside');
    expect(dayStatus(cfg, today, '2027-01-25').kind).toBe('outside');
    expect(dayStatus(cfg, today, today).kind).toBe('available');
  });
  it('blocks single days, inclusive ranges and weekdays', () => {
    expect(dayStatus(cfg, today, '2026-11-13')).toEqual({ kind: 'blocked', reason: 'Reise' });
    expect(dayStatus(cfg, today, '2026-11-15').kind).toBe('blocked');
    expect(dayStatus(cfg, today, '2026-11-16').kind).toBe('blocked'); // Monday
    expect(dayStatus(cfg, today, '2026-11-17').kind).toBe('available');
    expect(dayStatus(cfg, today, '2026-11-21')).toEqual({ kind: 'blocked', reason: undefined });
  });
  it('labels highlighted days', () => {
    expect(dayStatus(cfg, today, '2026-10-31')).toEqual({
      kind: 'available',
      label: 'Lars hat frei',
    });
  });
});

describe('slots', () => {
  const a = { date: '2026-10-31', time: '19:30' };
  const b = { date: '2026-10-31', time: '12:00' };
  const c = { date: '2026-10-28', time: '18:00' };

  it('adds sorted, allows several times per day, rejects duplicates', () => {
    let r = addSlot([], a, 3);
    expect(r.ok).toBe(true);
    r = addSlot(r.ok ? r.slots : [], b, 3);
    expect(r).toEqual({ ok: true, slots: [b, a] });
    expect(addSlot([b, a], { ...a }, 3)).toEqual({ ok: false, error: 'duplicate' });
  });

  it('enforces the maximum', () => {
    expect(addSlot([a, b], c, 2)).toEqual({ ok: false, error: 'max' });
  });

  it('removes and sorts', () => {
    expect(removeSlot([a, b, c], b)).toEqual([a, c]);
    expect(sortSlots([a, b, c])).toEqual([c, b, a]);
  });

  it('knows which times today are past', () => {
    const now = new Date('2026-10-24T12:30:00Z'); // 14:30 in Berlin
    expect(isPastTime({ date: '2026-10-24', time: '12:00' }, now)).toBe(true);
    expect(isPastTime({ date: '2026-10-24', time: '14:30' }, now)).toBe(true);
    expect(isPastTime({ date: '2026-10-24', time: '15:00' }, now)).toBe(false);
    expect(isPastTime({ date: '2026-10-25', time: '09:00' }, now)).toBe(false);
  });

  it('sanitizes restored slots', () => {
    const now = new Date('2026-10-24T08:00:00Z');
    const restored = sanitizeSlots(
      cfg,
      now,
      [a, a, c, { date: '2026-11-13', time: '12:00' }, { date: 'x', time: '1' }, null, 'junk'],
      5,
    );
    expect(restored).toEqual([c, a]);
  });

  it('drops restored slots before the time Lars is free', () => {
    const late = { ...cfg, highlightedDates: [{ date: '2026-10-31', label: 'x', from: '17:30' }] };
    const now = new Date('2026-10-24T08:00:00Z');
    const slots = [
      { date: '2026-10-31', time: '12:00' },
      { date: '2026-10-31', time: '17:30' },
    ];
    expect(sanitizeSlots(late, now, slots, 5)).toEqual([slots[1]]);
  });
});

describe('dayTimes', () => {
  const presets = ['12:00', '14:00', '16:00', '18:00', '20:00'];
  const times = {
    highlightedDates: [{ date: '2026-10-26', label: 'x', from: '17:30' }],
    timePresets: presets,
  };
  it('offers the presets on days without a start time', () => {
    expect(dayTimes(times, '2026-10-25')).toEqual(presets);
  });
  it('drops presets before the earliest free time', () => {
    expect(dayTimes(times, '2026-10-26')).toEqual(['18:00', '20:00']);
    const exact = {
      ...times,
      highlightedDates: [{ date: '2026-10-26', label: 'x', from: '18:00' }],
    };
    expect(dayTimes(exact, '2026-10-26')).toEqual(['18:00', '20:00']);
  });
});
