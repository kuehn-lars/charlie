import { expect, test } from '@playwright/test';
import { config } from '../../config';
import { addDays, addMonths, formatSlotLong, formatSlotShort } from '../../src/dates';
import {
  addSlot,
  firstBlockedDay,
  next,
  times,
  reachNote,
  sayYes,
  selectableDays,
  showDay,
  start,
  step,
  today,
} from './helpers';

const t = config.texts;
const API = 'https://api.web3forms.com/submit';

test('happy path with DRY_RUN sends nothing and logs the payload', async ({ page }) => {
  const payloads: unknown[] = [];
  page.on('console', async (msg) => {
    if (msg.text().startsWith('[DRY_RUN]')) payloads.push(await msg.args()[1]?.jsonValue());
  });
  let apiCalls = 0;
  await page.route(API, (route) => {
    apiCalls++;
    return route.abort();
  });

  await start(page, { dryRun: true });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    t.question.headline.replaceAll('*', ''),
  );
  await sayYes(page);

  const [d1, d2] = selectableDays(2);
  await addSlot(page, d1!, times(d1!)[0]!);
  await addSlot(page, d1!, times(d1!)[1]!);
  await addSlot(page, d2!, times(d2!)[0]!);
  await next(page);

  const pick = config.activities.find((a) => a.recommended) ?? config.activities[0]!;
  await expect(page.getByRole('button', { name: t.next })).toBeDisabled();
  await page.getByText(pick.title, { exact: true }).click();
  await next(page);

  await page.getByLabel(t.note.label).fill('Bis bald.');
  await expect(page.locator('#note-count')).toHaveText('9 / 1000');
  await page.getByRole('button', { name: t.note.submit }).click();

  await expect(page.getByRole('heading', { name: t.done.headline })).toBeVisible();
  await expect.poll(() => payloads.length).toBe(1);
  expect(apiCalls).toBe(0);

  const payload = payloads[0] as Record<string, unknown>;
  expect(payload).toMatchObject({
    access_key: config.WEB3FORMS_ACCESS_KEY,
    subject: t.email.subject,
    from_name: t.email.fromName,
    botcheck: false,
  });
  const message = payload.message as string;
  for (const [d, time] of [
    [d1!, times(d1!)[0]!],
    [d1!, times(d1!)[1]!],
    [d2!, times(d2!)[0]!],
  ] as const) {
    expect(message).toContain(formatSlotLong(d, time));
  }
  expect(message).toContain(`${t.email.activity}: ${pick.title}`);
  expect(message).toContain('Bis bald.');
  expect(message).toContain(`${t.email.neinAttempts}: 0`);
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});

test('Nein escapes the mouse and never registers a click', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'mouse behavior');
  await start(page, { dryRun: true });
  const nein = page.locator('[data-nein]');
  const ja = page.getByRole('button', { name: t.question.yes, exact: true });
  const headline = page.getByRole('heading', { level: 1 });
  const viewport = page.viewportSize()!;
  const stage = (await page.locator('.stage').boundingBox())!;

  for (let i = 0; i < 6; i++) {
    const before = (await nein.boundingBox())!;
    const cx = before.x + before.width / 2;
    const cy = before.y + before.height / 2;
    // Approach vertically from the roomier side, then click where it was.
    const ay = cy + (cy < viewport.height / 2 ? 1 : -1) * (before.height / 2 + 60);
    await page.mouse.move(cx, ay, { steps: 6 });
    await page.mouse.click(cx, cy);
    await page.waitForTimeout(450);

    const after = (await nein.boundingBox())!;
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(100);
    // Only ever inside the painting (and the viewport).
    expect(after.x).toBeGreaterThanOrEqual(stage.x);
    expect(after.y).toBeGreaterThanOrEqual(Math.max(0, stage.y));
    expect(after.x + after.width).toBeLessThanOrEqual(stage.x + stage.width);
    expect(after.y + after.height).toBeLessThanOrEqual(
      Math.min(viewport.height, stage.y + stage.height),
    );
    for (const other of [(await ja.boundingBox())!, (await headline.boundingBox())!]) {
      const overlap =
        after.x < other.x + other.width &&
        after.x + after.width > other.x &&
        after.y < other.y + other.height &&
        after.y + after.height > other.y;
      expect(overlap).toBe(false);
    }
  }

  // Keyboard: focusing it hands focus to Ja.
  await nein.focus();
  await expect(ja).toBeFocused();

  expect(await page.evaluate(() => window.__neinClicks)).toBe(0);
  expect(await step(page)).toBe('1');
  await expect(page.locator('.quip')).not.toBeEmpty();
  const scale = () => ja.evaluate((el) => Number(el.style.getPropertyValue('--scale') || 1));
  expect(await scale()).toBeGreaterThan(1);

  // The count survives a reload (it goes into the email), Ja's size does not.
  await page.reload();
  await expect(ja).toBeVisible();
  expect(await scale()).toBe(1);
  const stored = await page.evaluate(() => localStorage.getItem('fuer-charlie:v1'));
  expect((JSON.parse(stored ?? '{}') as { neinCount: number }).neinCount).toBeGreaterThan(0);
});

test('Nein jumps away on touch without registering a click', async ({ page }, info) => {
  test.skip(info.project.name !== 'webkit-iphone', 'touch behavior');
  await start(page, { dryRun: true });
  const nein = page.locator('[data-nein]');
  const stage = (await page.locator('.stage').boundingBox())!;
  const before = (await nein.boundingBox())!;
  await nein.tap();
  await page.waitForTimeout(600);
  await expect(nein).toBeVisible();
  const after = (await nein.boundingBox())!;
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(50);
  expect(after.x).toBeGreaterThanOrEqual(stage.x);
  expect(after.y).toBeGreaterThanOrEqual(stage.y);
  expect(after.x + after.width).toBeLessThanOrEqual(stage.x + stage.width);
  expect(after.y + after.height).toBeLessThanOrEqual(stage.y + stage.height);
  // Chasing it keeps failing.
  await nein.tap();
  await page.waitForTimeout(600);

  expect(await page.evaluate(() => window.__neinClicks)).toBe(0);
  expect(await step(page)).toBe('1');
  await expect(page.locator('.quip')).not.toBeEmpty();
  const stored = await page.evaluate(() => localStorage.getItem('fuer-charlie:v1'));
  expect(JSON.parse(stored ?? '{}')).toMatchObject({ neinCount: 2 });
});

test('blocked and past dates are not selectable', async ({ page }) => {
  const blocked = firstBlockedDay();
  test.skip(!blocked, 'config.ts has no blocked day in the selectable range');
  await start(page, { dryRun: true });
  await sayYes(page);

  const yesterday = addDays(today, -1);
  if (yesterday.slice(0, 7) === today.slice(0, 7)) {
    await expect(page.locator(`[data-day="${yesterday}"]`)).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  }

  const cell = await showDay(page, blocked!.day);
  await expect(cell).toHaveAttribute('aria-disabled', 'true');
  await cell.click({ force: true });
  await expect(cell).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.cal-info')).toContainText(blocked!.reason);
  await expect(page.getByText(t.when.pickDayHint)).toBeVisible();
  await expect(page.getByRole('button', { name: t.next })).toBeDisabled();
});

test('multiple slots, including several on the same day', async ({ page }) => {
  await start(page, { dryRun: true });
  await sayYes(page);
  const [d1, d2] = selectableDays(2);
  await addSlot(page, d2!, times(d2!)[0]!);
  await addSlot(page, d1!, times(d1!)[1]!);
  await addSlot(page, d1!, times(d1!)[0]!);

  const slots = page.locator('.slot');
  await expect(slots).toHaveCount(3);
  const expected = [
    [d1!, times(d1!)[0]!],
    [d1!, times(d1!)[1]!],
    [d2!, times(d2!)[0]!],
  ].map(([d, time]) => formatSlotShort(d!, time!));
  for (const [i, label] of expected.entries()) {
    await expect(slots.nth(i).getByRole('button')).toHaveAccessibleName(t.when.remove(label));
  }

  // A custom time on the selected day (d1), then the same time again.
  await page.getByRole('button', { name: t.when.customTime }).click();
  await page.getByLabel(t.when.customTimeLabel).fill('20:15');
  await page.getByRole('button', { name: t.when.add }).click();
  await expect(slots).toHaveCount(4);
  await page.getByRole('button', { name: t.when.customTime }).click();
  await page.getByLabel(t.when.customTimeLabel).fill('20:15');
  await page.getByRole('button', { name: t.when.add }).click();
  await expect(page.locator('.msg')).toHaveText(t.when.duplicate);
  await expect(slots).toHaveCount(4);

  await slots.first().getByRole('button').click();
  await expect(slots).toHaveCount(3);
  await expect(page.getByRole('button', { name: t.next })).toBeEnabled();
});

test('calendar is operable by keyboard', async ({ page }, info) => {
  test.skip(info.project.name !== 'chromium-desktop', 'hardware keyboard');
  await start(page, { dryRun: true });
  await sayYes(page);
  const [day] = selectableDays(1);
  const cell = await showDay(page, day!);
  await cell.focus();
  await page.keyboard.press('ArrowRight');
  const nextDay = addDays(day!, 1);
  await expect(page.locator(`[data-day="${nextDay}"]`)).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(cell).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(cell).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('PageDown');
  await expect(page.locator(`[data-day="${addMonths(day!, 1)}"]`)).toBeFocused();
});

test('dark mode follows the system until switched, then sticks', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await start(page, { dryRun: true });
  const html = page.locator('html');
  const toggle = page.getByRole('switch', { name: t.darkMode });
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  await toggle.click();
  await expect(html).toHaveAttribute('data-theme', 'light');
  const bg = [1, 3, 5].map((i) => parseInt(config.palette.bg.slice(i, i + 2), 16));
  await expect(page.locator('body')).toHaveCSS('background-color', `rgb(${bg.join(', ')})`);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
});

test('progress survives a reload', async ({ page }) => {
  await start(page, { dryRun: true });
  await sayYes(page);
  const [day] = selectableDays(1);
  await addSlot(page, day!, times(day!)[0]!);
  await next(page);
  const pick = config.activities[1] ?? config.activities[0]!;
  await page.getByText(pick.title, { exact: true }).click();

  await page.reload();
  await expect(page.getByRole('heading', { name: t.what.headline })).toBeVisible();
  await expect(page.locator(`input[value="${pick.id}"]`)).toBeChecked();
  await page.getByRole('button', { name: t.back }).click();
  await expect(page.locator('.slot')).toHaveCount(1);
});

test('failed submission shows an error, keeps inputs, and retries', async ({ page }) => {
  const requests: { body: unknown; headers: Record<string, string> }[] = [];
  await page.route(API, async (route) => {
    const req = route.request();
    requests.push({ body: req.postDataJSON(), headers: req.headers() });
    const ok = requests.length > 1;
    await route.fulfill({
      status: ok ? 200 : 500,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(ok ? { success: true } : { success: false, message: 'Server error' }),
    });
  });

  await start(page, { dryRun: false });
  await reachNote(page);
  await page.getByLabel(t.note.label).fill('Bitte nicht verlieren.');
  await page.getByRole('button', { name: t.note.submit }).click();

  const alert = page.getByRole('alert');
  await expect(alert).toContainText(t.note.errorTitle);
  await expect(page.getByLabel(t.note.label)).toHaveValue('Bitte nicht verlieren.');
  expect(await step(page)).toBe('4');

  await page.getByRole('button', { name: t.note.retry }).click();
  await expect(page.getByRole('heading', { name: t.done.headline })).toBeVisible();

  expect(requests).toHaveLength(2);
  expect(requests[0]!.headers['content-type']).toContain('application/json');
  expect(requests[0]!.headers.accept).toContain('application/json');
  expect(requests[1]!.body).toMatchObject({ subject: t.email.subject, botcheck: false });
  expect((requests[1]!.body as { message: string }).message).toContain('Bitte nicht verlieren.');
});
