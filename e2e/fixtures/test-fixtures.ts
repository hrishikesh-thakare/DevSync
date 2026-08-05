/**
 * DevSync E2E Custom Test Fixtures
 *
 * Provides pre-authenticated Page objects for each role so tests can
 * simply use `ownerPage`, `adminPage`, etc., without any login boilerplate.
 *
 * Usage in tests:
 *   import { test, expect } from '../../fixtures/test-fixtures';
 *   test('owner can do X', async ({ ownerPage }) => { ... });
 */
import { test as base, type Page, type BrowserContext } from '@playwright/test';
import { authStatePath } from '../helpers/constants.js';
import path from 'path';

// Define the shape of our custom fixtures
type TestFixtures = {
  ownerPage: Page;
  adminPage: Page;
  projectAdminPage: Page;
  developerPage: Page;
  viewerPage: Page;
  outsiderPage: Page;
  crossProjectPage: Page;
  memberNoProjectPage: Page;
};

/**
 * Helper to create a pre-authenticated fixture for a given role.
 */
function createFixture(role: string) {
  return async ({ browser }: { browser: any }, use: any) => {
    const statePath = path.resolve(import.meta.dirname, '..', authStatePath(role));
    const context = await browser.newContext({ storageState: statePath });
    const page = await context.newPage();
    await use(page);
    await context.close();
  };
}

export const test = base.extend<TestFixtures>({
  ownerPage: createFixture('owner'),
  adminPage: createFixture('admin'),
  projectAdminPage: createFixture('projectAdmin'),
  developerPage: createFixture('developer'),
  viewerPage: createFixture('viewer'),
  outsiderPage: createFixture('outsider'),
  crossProjectPage: createFixture('crossProject'),
  memberNoProjectPage: createFixture('memberNoProject'),
});

export { expect } from '@playwright/test';
