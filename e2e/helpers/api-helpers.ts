/**
 * DevSync E2E API Helpers
 * Direct API calls for test setup/teardown and assertion-level verification.
 * These bypass the UI to speed up test data setup.
 */
import { API_URL, TEST_PASSWORD, authStatePath } from './constants.js';
import fs from 'fs';
import path from 'path';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    userId: string;
    email: string;
    fullName: string;
  };
}

/**
 * Login via the API and return the access token + user info.
 */
export async function apiLogin(email: string, password: string = TEST_PASSWORD): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`API login failed for ${email}: ${res.status} ${body.error || res.statusText}`);
  }

  return res.json();
}

/**
 * Make an authenticated API request.
 */
export async function apiRequest(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<{ status: number; data: any }> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  let data: any;
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    data = await res.json();
  }

  return { status: res.status, data };
}

/**
 * Gets the pre-authenticated JWT token for a specific role from the saved state on disk.
 * This avoids hitting the login API for every single API test.
 */
export function getAuthToken(role: string): string {
  try {
    const statePath = path.resolve(import.meta.dirname, '..', authStatePath(role));
    const content = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(content);
    // Find the accessToken in localStorage
    const origin = state.origins?.[0];
    const tokenRecord = origin?.localStorage?.find((item: any) => item.name === 'accessToken');
    if (!tokenRecord) {
      throw new Error('No accessToken found in storage state');
    }
    return tokenRecord.value;
  } catch (err: any) {
    throw new Error(`Failed to read auth token for role "${role}": ${err?.message || String(err)}. Did you run global-setup?`);
  }
}
