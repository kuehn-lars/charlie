import { expect, type Page } from '@playwright/test';
import { config } from '../../config';
import { addDays, todayIn } from '../../src/dates';
import { bounds, dayStatus } from '../../src/schedule';

/*
 * Tests derive their dates from config.ts and the real clock, so they keep
 * working when the schedule in config.ts changes.
 */

declare global {
  interface Window {
    __neinClicks: number;
  }
}

export const today = todayIn();
const { max } = bounds(config, today);
const t = config.texts;

function* daysFrom(from: string) {
  for (let d = from; d <= max; d = addDays(d, 1)) yield d;
}

/** The first `n` selectable days strictly after today (avoids past preset times). */
export function selectableDays(n: number): string[] {
  const out: string[] = [];
  for (const d of daysFrom(addDays(today, 1))) {
    if (dayStatus(config, today, d).kind === 'available') out.push(d);
    if (out.length === n) return out;
  }
  throw new Error(`config.ts offers fewer than ${n} selectable days`);
}

export function firstBlockedDay(): { day: string; reason: string } | null {
  for (const d of daysFrom(today)) {
    const s = dayStatus(config, today, d);
    if (s.kind === 'blocked') return { day: d, reason: s.reason ?? t.when.blockedFallbackReason };
  }
  return null;
}

export const presets = config.timePresets;

/**
 * Opens the site with DRY_RUN forced on or off (e2e builds only) and a
 * capture-phase counter of every click that reaches the "Nein" button.
 */
export async function start(page: Page, opts: { dryRun: boolean }) {
  await page.addInitScript((dryRun) => {
    window.__CHARLIE_DRY_RUN__ = dryRun;
    window.__neinClicks = 0;
    window.addEventListener(
      'click',
      (e) => {
        if (e.target instanceof Element && e.target.closest('[data-nein]')) window.__neinClicks++;
      },
      true,
    );
  }, opts.dryRun);
  await page.goto('./');
  await expect(page.locator('#main')).toHaveAttribute('data-ready', '');
}

export const step = (page: Page) => page.locator('#main').getAttribute('data-step');

export async function sayYes(page: Page) {
  await page.getByRole('button', { name: t.question.yes, exact: true }).click();
  await expect(page.getByRole('heading', { name: t.when.headline })).toBeVisible();
}

export async function showDay(page: Page, day: string) {
  const cell = page.locator(`[data-day="${day}"]`);
  for (let i = 0; i < 14 && (await cell.count()) === 0; i++) {
    await page.getByRole('button', { name: t.when.nextMonth }).click();
  }
  await expect(cell).toBeVisible();
  return cell;
}

export async function addSlot(page: Page, day: string, time: string) {
  await (await showDay(page, day)).click();
  const chip = page.locator('.chips').getByRole('button', { name: time, exact: true });
  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
}

export async function next(page: Page) {
  await page.getByRole('button', { name: t.next }).click();
}

/** Steps 1-3 with one slot and the first activity; ends on step 4. */
export async function reachNote(page: Page) {
  await sayYes(page);
  const [day] = selectableDays(1);
  await addSlot(page, day!, presets[0]!);
  await next(page);
  await page.getByText(config.activities[0]!.title, { exact: true }).click();
  await next(page);
  await expect(page.getByRole('heading', { name: t.note.headline })).toBeVisible();
}
