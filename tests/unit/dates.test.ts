import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  formatDayShort,
  formatInstant,
  formatMonth,
  formatSlotLong,
  formatSlotShort,
  isoWeekday,
  monthGrid,
  nowTimeIn,
  parseDay,
  todayIn,
  weekdayLabels,
} from '../../src/dates';

describe('parseDay', () => {
  it('accepts real days only', () => {
    expect(parseDay('2026-10-31')).toEqual({ y: 2026, m: 10, d: 31 });
    expect(parseDay('2028-02-29')).not.toBeNull();
    expect(parseDay('2026-02-29')).toBeNull();
    expect(parseDay('2026-11-31')).toBeNull();
    expect(parseDay('2026-1-5')).toBeNull();
    expect(parseDay('2026-10-31T00:00')).toBeNull();
  });
});

describe('day arithmetic', () => {
  it('crosses month and year edges', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('is unaffected by DST transitions', () => {
    // Berlin: CET -> CEST on 2026-03-29, CEST -> CET on 2026-10-25.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2026-03-01', 61)).toBe('2026-05-01');
  });

  it('clamps months to the last day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-10-24', 3)).toBe('2027-01-24');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('computes ISO weekdays', () => {
    expect(isoWeekday('2026-10-26')).toBe(1); // Monday
    expect(isoWeekday('2026-10-31')).toBe(6); // Saturday
    expect(isoWeekday('2026-11-01')).toBe(7); // Sunday
    expect(isoWeekday('1969-12-31')).toBe(3); // before the epoch
  });
});

describe('monthGrid', () => {
  it('starts on Monday and always has 42 days', () => {
    const grid = monthGrid('2026-11-15'); // Nov 1st 2026 is a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-10-26');
    expect(grid[6]).toBe('2026-11-01');
    expect(isoWeekday(grid[0]!)).toBe(1);
  });

  it('starts on the 1st when the month begins on Monday', () => {
    expect(monthGrid('2027-02-10')[0]).toBe('2027-02-01');
  });
});

describe('Berlin wall clock', () => {
  it('resolves the calendar day across the spring DST switch', () => {
    // 00:30Z on 2026-03-29 is 01:30 CET, same day.
    expect(todayIn(new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29');
    // 22:30Z on 2026-03-28 is 23:30 CET, still the 28th.
    expect(todayIn(new Date('2026-03-28T22:30:00Z'))).toBe('2026-03-28');
    // 01:30Z on 2026-03-29 is 03:30 CEST (02:00-03:00 does not exist).
    expect(nowTimeIn(new Date('2026-03-29T01:30:00Z'))).toBe('03:30');
  });

  it('resolves the calendar day across the autumn DST switch', () => {
    // 22:30Z on 2026-10-24 is 00:30 CEST on the 25th.
    expect(todayIn(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
    // 23:30Z on 2026-10-25 is 00:30 CET on the 26th.
    expect(todayIn(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26');
    // 22:30Z on 2026-10-25 is still 23:30 CET on the 25th.
    expect(todayIn(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-25');
  });

  it('crosses the year edge in Berlin before UTC does', () => {
    expect(todayIn(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
  });
});

describe('German formatting', () => {
  it('formats short slots without abbreviation dots', () => {
    expect(formatSlotShort('2026-10-31', '19:30')).toBe('Sa, 31. Okt · 19:30');
    expect(formatDayShort('2026-05-04')).toBe('Mo, 4. Mai');
    expect(formatDayShort('2027-03-01')).toBe('Mo, 1. März');
  });

  it('formats long slots', () => {
    expect(formatSlotLong('2026-10-31', '19:30')).toBe('Samstag, 31. Oktober 2026 um 19:30 Uhr');
  });

  it('formats days independently of the host time zone', () => {
    // A naive `new Date('2026-11-01')` would render Oct 31st west of UTC.
    expect(formatDayShort('2026-11-01')).toBe('So, 1. Nov');
  });

  it('formats months and weekday headers', () => {
    expect(formatMonth('2026-10-24')).toBe('Oktober 2026');
    expect(weekdayLabels()).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  });

  it('formats instants in Berlin time', () => {
    expect(formatInstant(new Date('2026-10-24T12:05:00Z'))).toBe(
      'Samstag, 24. Oktober 2026 um 14:05 Uhr',
    );
    expect(formatInstant(new Date('2026-12-24T17:00:00Z'))).toBe(
      'Donnerstag, 24. Dezember 2026 um 18:00 Uhr',
    );
  });
});
