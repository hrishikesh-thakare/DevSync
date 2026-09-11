/**
 * DevSync E2E Global Setup
 *
 * Runs once before all tests. Authenticates key test users via the API
 * and saves their browser storage states (JWT in localStorage) so each
 * test can start pre-authenticated without going through the login UI.
 */
import type { FullConfig } from '@playwright/test';
import { BASE_URL, TEST_USERS, AUTH_STATE_DIR } from './helpers/constants.js';
import { apiLogin } from './helpers/api-helpers.js';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  // Ensure the auth state directory exists
  const authDir = path.resolve(import.meta.dirname, AUTH_STATE_DIR);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Authenticate each test user and save their storage state
  const userEntries = Object.entries(TEST_USERS) as [string, typeof TEST_USERS[keyof typeof TEST_USERS]][];

  // We need to parse BASE_URL to get the origin for storage state
  const origin = new URL(BASE_URL).origin;

  // Tests that use the plain `page` fixture (most of auth/*, avatar-upload,
  // etc.) never touch the per-role files below — Playwright hands them a
  // genuinely empty context. playwright.config.ts points its top-level
  // `use.storageState` at this file so those contexts start with the banner
  // already dismissed too, without an accessToken that would sign them in.
  const basePath = path.resolve(authDir, 'base.json');
  fs.writeFileSync(
    basePath,
    JSON.stringify(
      { cookies: [], origins: [{ origin, localStorage: [{ name: 'cookie-consent', value: 'all' }] }] },
      null,
      2,
    ),
    'utf8',
  );

  for (const [role, user] of userEntries) {
    console.log(`  🔐 Authenticating ${role}: ${user.email}...`);

    try {
      // Get JWT from the API
      const loginData = await apiLogin(user.email, user.password);

      // Save the storage state to disk manually without launching a browser
      const statePath = path.resolve(authDir, `${role}.json`);
      const state = {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [
              { name: 'accessToken', value: loginData.accessToken },
              // Without this, CookieConsentBanner renders fixed to the
              // viewport bottom on first paint and physically covers the
              // chat composer, timing out any test that clicks into it
              // (e.g. mentions-ui.spec.ts).
              { name: 'cookie-consent', value: 'all' },
            ]
          }
        ]
      };
      
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf8');
      console.log(`  ✅ Saved auth state for ${role} → ${statePath}`);
    } catch (err) {
      console.error(`  ❌ Failed to authenticate ${role} (${user.email}):`, err);
      // Don't throw — let the tests fail with proper error messages
    }
  }
}

export default globalSetup;
