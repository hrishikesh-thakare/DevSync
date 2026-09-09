/**
 * Leave Workspace Tests
 *
 * Covers DELETE /workspaces/:slug/members/me (self-service leave):
 *   - owners cannot leave (must transfer ownership or delete the workspace)
 *   - members leave → membership deactivated → access revoked
 *   - re-inviting a user who left restores access
 *   - non-members get 404, unauthenticated gets 401
 *
 * Uses a freshly registered user so no other suite is affected by the
 * deactivated membership.
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS, TEST_PASSWORD } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;
const API = process.env.API_URL || 'http://localhost:3001/api';

test.describe('Workspace — Leave Workspace', () => {
  test('owner cannot leave the workspace (400)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/members/me`, accessToken, {
      method: 'DELETE',
    });
    expect(status).toBe(400);
    expect(data.error).toContain('Owners cannot leave');
  });

  test('member can leave, loses access, and a re-invite restores it', async () => {
    const email = `leave-test-${Date.now()}@demo.com`;

    const reg = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName: 'Leave Test', password: TEST_PASSWORD }),
    });
    expect(reg.ok).toBe(true);
    const { accessToken } = await reg.json();

    const owner = await apiLogin(TEST_USERS.owner.email);

    // Invite + accept
    const invite = await apiRequest(`/workspaces/${SLUG}/invite`, owner.accessToken, {
      method: 'POST',
      body: JSON.stringify({ email, role: 'member' }),
    });
    expect([200, 201]).toContain(invite.status);
    const accept = await apiRequest(`/workspaces/${SLUG}/invites/accept`, accessToken, {
      method: 'POST',
    });
    expect([200, 201]).toContain(accept.status);

    // Sanity: member has access before leaving
    const before = await apiRequest(`/workspaces/${SLUG}`, accessToken);
    expect(before.status).toBe(200);

    // Leave
    const leave = await apiRequest(`/workspaces/${SLUG}/members/me`, accessToken, {
      method: 'DELETE',
    });
    expect(leave.status).toBe(200);

    // Access is revoked
    const after = await apiRequest(`/workspaces/${SLUG}`, accessToken);
    expect(after.status).toBe(403);

    // Re-inviting re-activates the deactivated membership directly (no new
    // invite is created for an existing user — see inviteMember)
    const invite2 = await apiRequest(`/workspaces/${SLUG}/invite`, owner.accessToken, {
      method: 'POST',
      body: JSON.stringify({ email, role: 'member' }),
    });
    expect([200, 201]).toContain(invite2.status);
    const restored = await apiRequest(`/workspaces/${SLUG}`, accessToken);
    expect(restored.status).toBe(200);
  });

  test('non-member cannot leave a workspace (404)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const { status } = await apiRequest(`/workspaces/${SLUG}/members/me`, accessToken, {
      method: 'DELETE',
    });
    expect(status).toBe(404);
  });

  test('leaving requires authentication (401)', async () => {
    const { status } = await apiRequest(`/workspaces/${SLUG}/members/me`, '', {
      method: 'DELETE',
    });
    expect(status).toBe(401);
  });
});