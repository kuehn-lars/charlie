import { describe, expect, it } from 'vitest';
import { config, type Config } from '../../config';
import { validateConfig } from '../../src/validate-config';

const today = '2026-10-24';
const valid: Config = {
  ...config,
  WEB3FORMS_ACCESS_KEY: '00000000-0000-0000-0000-000000000000',
  minDate: undefined,
  maxDate: undefined,
  blockedDates: [{ from: '2026-11-13', to: '2026-11-15' }, { date: '2026-11-21' }],
  highlightedDates: [{ date: '2026-10-31', label: 'Lars hat frei' }],
  blockedWeekdays: [],
};

const warningsFor = (patch: Partial<Config>) => validateConfig({ ...valid, ...patch }, today);

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    expect(validateConfig(valid, today)).toEqual([]);
  });

  it('accepts the shipped config apart from the access key', () => {
    const warnings = validateConfig(config, today);
    expect(warnings.every((w) => w.includes('WEB3FORMS_ACCESS_KEY'))).toBe(true);
  });

  it('flags invalid dates', () => {
    expect(warningsFor({ blockedDates: [{ date: '2026-02-30' }] })).toEqual([
      'blockedDates[0].date: "2026-02-30" is not a valid YYYY-MM-DD date.',
    ]);
    expect(warningsFor({ highlightedDates: [{ date: '31.10.2026', label: 'x' }] })[0]).toMatch(
      /highlightedDates\[0\]\.date/,
    );
    expect(warningsFor({ maxDate: '2027-13-01' })[0]).toMatch(/^maxDate/);
  });

  it('flags inverted ranges', () => {
    expect(warningsFor({ blockedDates: [{ from: '2026-11-15', to: '2026-11-13' }] })).toEqual([
      'blockedDates[0]: range is inverted (from 2026-11-15 is after to 2026-11-13).',
    ]);
  });

  it('flags inverted min/max', () => {
    expect(warningsFor({ minDate: '2026-12-01', maxDate: '2026-11-01' })[0]).toMatch(
      /minDate .* is after maxDate/,
    );
  });

  it('flags days that are both blocked and highlighted', () => {
    expect(warningsFor({ highlightedDates: [{ date: '2026-11-14', label: 'frei' }] })).toEqual([
      'highlightedDates[0]: 2026-11-14 is both highlighted and blocked. Blocked wins.',
    ]);
    // Blocked by weekday (2026-10-31 is a Saturday).
    expect(warningsFor({ blockedWeekdays: [6] })[0]).toMatch(/both highlighted and blocked/);
  });

  it('flags a missing access key, louder without DRY_RUN', () => {
    expect(warningsFor({ WEB3FORMS_ACCESS_KEY: 'YOUR_ACCESS_KEY', DRY_RUN: true })[0]).toMatch(
      /fine while DRY_RUN/,
    );
    expect(warningsFor({ WEB3FORMS_ACCESS_KEY: '', DRY_RUN: false })[0]).toMatch(
      /submissions will fail/,
    );
  });

  it('flags bad presets, weekdays, max slots, activities, URL and colors', () => {
    expect(warningsFor({ timePresets: ['19:30', '25:00', '19:30'] })).toHaveLength(2);
    expect(warningsFor({ blockedWeekdays: [0] })[0]).toMatch(/not an ISO weekday/);
    expect(warningsFor({ maxSlots: 0 })[0]).toMatch(/maxSlots/);
    const dup = valid.activities[0]!;
    expect(warningsFor({ activities: [dup, dup] })[0]).toMatch(/used twice/);
    expect(warningsFor({ SITE_URL: 'kuehn-lars.github.io/charlie' })[0]).toMatch(/absolute URL/);
    expect(warningsFor({ SITE_URL: 'https://x.github.io/charlie' })[0]).toMatch(/trailing|slash/);
    expect(warningsFor({ palette: { ...valid.palette, rose: '#E86' } })[0]).toMatch(/rose/);
  });
});
