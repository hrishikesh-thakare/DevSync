import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './helpers/constants.js';

const IS_CI = !!process.env.CI;

/**
 * DevSync Playwright Configuration
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  workers: IS_CI ? 1 : 2,
  reporter: IS_CI
    ? [['list'], ['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'on-failure' }]],

  // Global settings
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    actionTimeout: 15_000,
  },

  // Global setup: authenticates all test users and saves storage states
  globalSetup: './global-setup.ts',

  // Timeouts
  timeout: 30_000,
  expect: { timeout: 10_000 },

  // Browser projects
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test on more browsers:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Auto-start frontend + backend dev servers before tests
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      env: {
        NODE_ENV: 'test',
        // Never send real emails from test runs — the backend falls back to
        // mock-logging the "sent" mail (and returns dev-only links in
        // responses), which is exactly what the recovery e2e tests need.
        SMTP_HOST: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        // Disable Gemini to avoid quota exhaustion & libuv crashes under parallelism
        GEMINI_API_KEY: '',
        // Turn on email-verification enforcement so CI covers the blocked
        // login path (specs that register then sign in verify first).
        REQUIRE_EMAIL_VERIFICATION: 'true',
      },
      port: 3001,
      // Reuse existing server so it doesn't clash with the pre-started CI backend
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: 'npm run dev',
      cwd: '../frontend',
      port: 5173,
      // The frontend has no test-specific env, so a running dev server is fine.
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      // Production-mode backend used by the rate-limit spec: the main test
      // backend runs with NODE_ENV=test, where rate limiting is skipped.
      // This instance exercises the real limiter behind a trusted proxy
      // (TRUST_PROXY_HOPS=1) on a separate port.
      command: 'npm run dev',
      cwd: '../backend',
      env: {
        NODE_ENV: 'production',
        PORT: '3002',
        SMTP_HOST: '',
        SMTP_USER: '',
        SMTP_PASS: '',
        TRUST_PROXY_HOPS: '1',
        GEMINI_API_KEY: '',
      },
      port: 3002,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
