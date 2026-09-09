/**
 * Avatar upload — previously zero coverage. Exercises the real two-step
 * flow (`AccountSettingsPage.tsx`'s `AvatarUpload`): `POST /auth/avatar`
 * uploads the file and returns a URL, then `PATCH /auth/profile` persists it
 * — this is the one profile field that doesn't save on blur like the others,
 * so both requests have to actually happen for the change to stick.
 *
 * Verified via the `PATCH /auth/profile` response itself, not by re-fetching
 * `/auth/me` afterward: `requireAuth` re-reads the user from the DB on every
 * request but only selects `userId`/`email`/`fullName` — `avatarUrl` is
 * structurally absent from that response regardless of what got saved, so
 * checking it there would say nothing about whether persistence worked.
 * (Also not verified via the `<img>` in the DOM: an `alt=""` image is exposed
 * to accessibility tools as decorative — role `presentation`, not `img` — so
 * `getByRole('img')` would not reliably find it either.)
 */
import { test, expect } from '@playwright/test';
import { API_URL, TEST_PASSWORD } from '../../helpers/constants.js';
import { verifyEmail } from '../../helpers/api-helpers.js';

const BASE = process.env.BASE_URL || 'http://localhost:5173';

// A minimal valid 1x1 PNG — small enough to inline, real enough to pass the
// MIME/decoded-buffer validation `createFileRecord` applies to every upload.
const ONE_PX_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

test('uploading an avatar persists it to the profile', async ({ page }) => {
  const email = `ui-avatar-${Date.now()}@demo.com`;
  const regRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, fullName: 'Avatar Tester', password: TEST_PASSWORD }),
  });
  expect(regRes.ok).toBe(true);
  await verifyEmail(await regRes.json());

  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('you@company.com').fill(email);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(`${BASE}/workspaces`);

  await page.goto(`${BASE}/account`);
  await expect(page.getByLabel('Change avatar')).toBeVisible();

  const [profilePatch] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/profile') && r.request().method() === 'PATCH'),
    page.getByLabel('Upload avatar image').setInputFiles({
      name: 'avatar.png',
      mimeType: 'image/png',
      buffer: ONE_PX_PNG,
    }),
  ]);

  expect(profilePatch.ok()).toBeTruthy();
  const patchBody = await profilePatch.json();
  expect(patchBody.avatarUrl).toMatch(/^https?:\/\//);

  await expect(page.getByText('Avatar updated')).toBeVisible({ timeout: 10_000 });

  const accessToken = await page.evaluate(() => localStorage.getItem('accessToken'));
  await fetch(`${API_URL}/auth/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
});
