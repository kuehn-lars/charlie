import { defineConfig, devices } from '@playwright/test';
import { config } from './config';

const PORT = 4174;
const base = new URL(config.SITE_URL).pathname;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}${base}`,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'webkit-iphone',
      use: {
        ...devices['iPhone 15'],
        browserName: 'webkit',
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
  ],
  // e2e mode builds to dist-e2e and enables the window.__CHARLIE_DRY_RUN__ override.
  webServer: {
    command: 'npx vite build --mode e2e && npx vite preview --mode e2e',
    url: `http://localhost:${PORT}${base}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
