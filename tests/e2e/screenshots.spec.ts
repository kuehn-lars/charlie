import { expect, test } from '@playwright/test';
import { config } from '../../config';
import { addSlot, next, presets, sayYes, selectableDays, start } from './helpers';

/*
 * Visual review aid, not an assertion suite: captures every step per project
 * into test-results/screens. Run with `SCREENSHOTS=1 npm run test:e2e -- screenshots`.
 */
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to capture review screenshots');

const t = config.texts;

test('every step', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  let calls = 0;
  await page.route('https://api.web3forms.com/submit', (route) =>
    ++calls === 1
      ? route.abort()
      : route.fulfill({
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body: '{"success":true}',
        }),
  );
  await start(page, { dryRun: false });
  await page.waitForTimeout(600);
  await shot('1-question');

  await sayYes(page);
  await page.waitForTimeout(900);
  await shot('2-when-empty');
  const [d1, d2] = selectableDays(2);
  await addSlot(page, d1!, presets[0]!);
  await addSlot(page, d1!, presets[2]!);
  await addSlot(page, d2!, presets[3]!);
  await shot('2-when');

  await next(page);
  await page.getByText(config.activities.at(-1)!.title, { exact: true }).click();
  await page.waitForTimeout(700);
  await shot('3-what');

  await next(page);
  await page.getByLabel(t.note.label).fill('Ich freu mich schon.');
  await page.waitForTimeout(700);
  await shot('4-note');

  await page.getByRole('button', { name: t.note.submit }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.waitForTimeout(500);
  await shot('4-note-error');

  await page.getByRole('button', { name: t.note.retry }).click();
  await expect(page.getByRole('heading', { name: t.done.headline })).toBeVisible();
  await page.waitForTimeout(1500);
  await shot('5-done');
});
