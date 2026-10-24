import { describe, expect, it } from 'vitest';
import { config, type Config } from '../../config';
import { NOTE_MAX, initialState, restore as restoreWith } from '../../src/state';

const cfg: Config = {
  ...config,
  minDate: undefined,
  maxDate: undefined,
  blockedDates: [],
  highlightedDates: [],
  blockedWeekdays: [],
  allowMultiple: false,
};
const restore = (raw: string | null, now: Date) => restoreWith(raw, now, cfg);
const now = new Date('2026-10-24T08:00:00Z');
const slot = { date: '2026-10-31', time: '19:30' };

describe('restore', () => {
  it('falls back to the initial state on missing or corrupt data', () => {
    expect(restore(null, now)).toEqual(initialState());
    expect(restore('{not json', now)).toEqual(initialState());
    expect(restore('42', now)).toEqual(initialState());
  });

  it('restores a valid snapshot', () => {
    const raw = JSON.stringify({
      step: 4,
      slots: [slot],
      activities: [cfg.activities[1]!.id],
      note: 'Hallo',
      neinCount: 7,
    });
    expect(restore(raw, now)).toEqual({
      step: 4,
      slots: [slot],
      activities: [cfg.activities[1]!.id],
      note: 'Hallo',
      neinCount: 7,
    });
  });

  it('drops unknown activities, caps the note and steps back when prerequisites vanished', () => {
    const raw = JSON.stringify({
      step: 4,
      slots: [{ date: '2026-10-01', time: '12:00' }], // now in the past
      activities: ['gone'],
      note: 'x'.repeat(NOTE_MAX + 50),
      neinCount: -3,
    });
    const state = restore(raw, now);
    expect(state.step).toBe(2);
    expect(state.slots).toEqual([]);
    expect(state.activities).toEqual([]);
    expect(state.note).toHaveLength(NOTE_MAX);
    expect(state.neinCount).toBe(0);
  });

  it('never resumes on the success screen', () => {
    expect(restore(JSON.stringify({ step: 5, slots: [slot] }), now).step).toBe(1);
  });
});
