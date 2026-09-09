import { defineConfig } from 'vitest/config';

/**
 * Unit tests only — no database, no HTTP server, no Playwright.
 *
 * The e2e suite already covers the integrated product, but it needs Postgres
 * plus two running servers, so the pure logic underneath it (encryption, cookie
 * attribute derivation, CORS matching, the retry queue, status transitions) had
 * no way to be exercised in isolation. These run in about a second and catch
 * the class of regression that otherwise only surfaces as a flaky browser test.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // Each suite sets the env vars it needs before importing the module under
    // test, so they must not share a process-wide `process.env`.
    isolate: true,
    pool: 'forks',
  },
});
