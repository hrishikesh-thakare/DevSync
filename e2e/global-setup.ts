/**
 * DevSync E2E Global Setup
 *
 * Runs once before all tests. Authenticates key test users via the API
 * and saves their browser storage states (JWT in localStorage) so each
 * test can start pre-authenticated without going through the login UI.
 */
import { chromium, type FullConfig } from '@playwright/test';
import { API_URL, BASE_URL, TEST_USERS, AUTH_STATE_DIR, authStatePath } from './helpers/constants.js';
import { apiLogin } from './helpers/api-helpers.js';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  // Ensure the auth state directory exists
  const authDir = path.resolve(import.meta.dirname, AUTH_STATE_DIR);
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const browser = await chromium.launch();

  // Authenticate each test user and save their storage state
  const userEntries = Object.entries(TEST_USERS) as [string, typeof TEST_USERS[keyof typeof TEST_USERS]][];

  for (const [role, user] of userEntries) {
    console.log(`  🔐 Authenticating ${role}: ${user.email}...`);

    try {
      // Get JWT from the API
      const loginData = await apiLogin(user.email, user.password);

      // Create a new browser context and inject the token into localStorage
      const context = await browser.newContext();
      const page = await context.newPage();

      // Navigate to the app to set the origin for localStorage
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

      // Set the access token in localStorage (matching how the frontend stores it)
      await page.evaluate((token: string) => {
        localStorage.setItem('accessToken', token);
      }, loginData.accessToken);

      // Save the storage state to disk
      const statePath = path.resolve(authDir, `${role}.json`);
      await context.storageState({ path: statePath });
      console.log(`  ✅ Saved auth state for ${role} → ${statePath}`);

      await context.close();
    } catch (err) {
      console.error(`  ❌ Failed to authenticate ${role} (${user.email}):`, err);
      // Don't throw — let the tests fail with proper error messages
    }
  }

  await browser.close();
}

export default globalSetup;
