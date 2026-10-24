import type { Config } from '../config';
import { addMonths, isBetween, isDay, isTime, isoWeekday } from './dates';
import { bounds, isRange } from './schedule';

const HEX_RE = /^#[0-9a-f]{6}$/i;

/** Returns human-readable problems with the config. Empty array = all good. */
export function validateConfig(cfg: Config, today: string): string[] {
  const warnings: string[] = [];
  const warn = (msg: string) => warnings.push(msg);

  const checkDay = (value: string, where: string) => {
    if (!isDay(value)) warn(`${where}: "${value}" is not a valid YYYY-MM-DD date.`);
    return isDay(value);
  };

  if (cfg.minDate !== undefined) checkDay(cfg.minDate, 'minDate');
  if (cfg.maxDate !== undefined) checkDay(cfg.maxDate, 'maxDate');
  const { min, max } = bounds(cfg, today);
  if (isDay(min) && isDay(max) && min > max) {
    warn(`minDate (${min}) is after maxDate (${max}); no day is selectable.`);
  }
  if (cfg.maxDate && isDay(cfg.maxDate) && cfg.maxDate > addMonths(today, 12)) {
    warn(`maxDate (${cfg.maxDate}) is more than a year ahead. Intended?`);
  }

  cfg.blockedDates.forEach((b, i) => {
    const where = `blockedDates[${i}]`;
    if (isRange(b)) {
      const okFrom = checkDay(b.from, `${where}.from`);
      const okTo = checkDay(b.to, `${where}.to`);
      if (okFrom && okTo && b.from > b.to) {
        warn(`${where}: range is inverted (from ${b.from} is after to ${b.to}).`);
      }
    } else {
      checkDay(b.date, `${where}.date`);
    }
  });

  const blockedWeekdays = new Set(cfg.blockedWeekdays);
  for (const w of blockedWeekdays) {
    if (!Number.isInteger(w) || w < 1 || w > 7) {
      warn(`blockedWeekdays: ${w} is not an ISO weekday (1 = Monday ... 7 = Sunday).`);
    }
  }
  if (blockedWeekdays.size >= 7) warn('blockedWeekdays blocks every day of the week.');

  const seenHighlights = new Set<string>();
  cfg.highlightedDates.forEach((h, i) => {
    const where = `highlightedDates[${i}]`;
    if (!checkDay(h.date, `${where}.date`)) return;
    if (seenHighlights.has(h.date)) warn(`${where}: ${h.date} is highlighted twice.`);
    seenHighlights.add(h.date);
    const blockedBy = cfg.blockedDates.find((b) =>
      isRange(b) ? isBetween(h.date, b.from, b.to) : b.date === h.date,
    );
    if (blockedBy || blockedWeekdays.has(isoWeekday(h.date))) {
      warn(`${where}: ${h.date} is both highlighted and blocked. Blocked wins.`);
    }
    if (!h.label.trim()) warn(`${where}: label is empty.`);
    if (h.from !== undefined && !isTime(h.from))
      warn(`${where}.from: "${h.from}" is not HH:MM (24h).`);
  });

  const seenTimes = new Set<string>();
  cfg.timePresets.forEach((t, i) => {
    if (!isTime(t)) warn(`timePresets[${i}]: "${t}" is not HH:MM (24h).`);
    if (seenTimes.has(t)) warn(`timePresets[${i}]: "${t}" is listed twice.`);
    seenTimes.add(t);
  });

  if (!Number.isInteger(cfg.maxSlots) || cfg.maxSlots < 1) {
    warn(`maxSlots must be a positive integer, got ${cfg.maxSlots}.`);
  }

  if (cfg.activities.length === 0) warn('activities is empty; step 3 cannot be completed.');
  const seenIds = new Set<string>();
  cfg.activities.forEach((a, i) => {
    if (seenIds.has(a.id)) warn(`activities[${i}]: id "${a.id}" is used twice.`);
    seenIds.add(a.id);
  });
  if (cfg.activities.filter((a) => a.recommended).length > 1) {
    warn('More than one activity is marked recommended.');
  }

  const key = cfg.WEB3FORMS_ACCESS_KEY.trim();
  if (!key || key === 'YOUR_ACCESS_KEY') {
    warn(
      cfg.DRY_RUN
        ? 'WEB3FORMS_ACCESS_KEY is not set (fine while DRY_RUN is true, required before deploying).'
        : 'WEB3FORMS_ACCESS_KEY is not set and DRY_RUN is false: submissions will fail.',
    );
  }

  try {
    const url = new URL(cfg.SITE_URL);
    if (!url.pathname.endsWith('/')) warn('SITE_URL must end with a slash.');
  } catch {
    warn(`SITE_URL "${cfg.SITE_URL}" is not an absolute URL.`);
  }

  const colors = { palette: cfg.palette, paletteDark: cfg.paletteDark, horse: cfg.horse };
  for (const [group, values] of Object.entries(colors)) {
    for (const [name, value] of Object.entries(values)) {
      for (const c of [value as string | readonly string[]].flat()) {
        if (!HEX_RE.test(c)) warn(`Color ${group}.${name}: "${c}" is not #RRGGBB.`);
      }
    }
  }
  for (const [group, p] of Object.entries({ palette: cfg.palette, paletteDark: cfg.paletteDark })) {
    for (const key of ['sky', 'sun', 'clouds', 'hills', 'meadow'] as const) {
      if (p[key].length < 2) warn(`${group}.${key} needs at least 2 colors.`);
    }
  }

  return warnings;
}
