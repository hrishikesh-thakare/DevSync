/**
 * Link Unfurling Tests
 *
 * Covers GET /workspaces/:slug/unfurl — URL metadata extraction:
 *   - 400 for missing / malformed / non-http(s) URLs
 *   - 200 with domain + title for a valid page
 *   - 403 for outsiders, 401 for unauthenticated requests
 */
import { test, expect } from '../../fixtures/test-fixtures.js';
import { TEST_WORKSPACE, TEST_USERS } from '../../helpers/constants.js';
import { apiLogin, apiRequest } from '../../helpers/api-helpers.js';

const SLUG = TEST_WORKSPACE.slug;

test.describe('Workspace — Link Unfurling', () => {
  test('unfurl requires a url parameter (400)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(`/workspaces/${SLUG}/unfurl`, accessToken);
    expect(status).toBe(400);
    expect(data.error).toBeTruthy();
  });

  test('unfurl rejects malformed URLs (400)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/unfurl?url=${encodeURIComponent('not a url')}`,
      accessToken
    );
    expect(status).toBe(400);
  });

  test('unfurl rejects non-http(s) protocols (400)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/unfurl?url=${encodeURIComponent('ftp://example.com/file')}`,
      accessToken
    );
    expect(status).toBe(400);
  });

  test('unfurl fetches page metadata for a valid URL', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.owner.email);
    const { status, data } = await apiRequest(
      `/workspaces/${SLUG}/unfurl?url=${encodeURIComponent('https://example.com')}`,
      accessToken
    );
    expect(status).toBe(200);
    expect(data.domain).toBe('example.com');
    expect(data.title).toBeTruthy();
  });

  test('outsider cannot unfurl (403)', async () => {
    const { accessToken } = await apiLogin(TEST_USERS.outsider.email);
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/unfurl?url=${encodeURIComponent('https://example.com')}`,
      accessToken
    );
    expect(status).toBe(403);
  });

  test('unfurl requires authentication (401)', async () => {
    const { status } = await apiRequest(
      `/workspaces/${SLUG}/unfurl?url=${encodeURIComponent('https://example.com')}`,
      ''
    );
    expect(status).toBe(401);
  });
});