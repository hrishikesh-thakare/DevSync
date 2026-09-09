/**
 * DevSync E2E API Helpers
 * Direct API calls for test setup/teardown and assertion-level verification.
 * These bypass the UI to speed up test data setup.
 */
import { API_URL, TEST_PASSWORD, TEST_USERS, authStatePath } from './constants.js';
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
 * Build a reverse map from email → role name so we can look up cached tokens.
 */
const EMAIL_TO_ROLE: Record<string, string> = Object.fromEntries(
  Object.entries(TEST_USERS).map(([role, user]) => [user.email, role])
);

/**
 * Login via the API and return the access token + user info.
 *
 * If the email belongs to a known test user and a cached .auth/<role>.json
 * file exists with a non-expired token, that token is returned directly —
 * avoiding a real login request entirely.  This prevents the parallel test
 * suite from triggering the auth rate-limiter (429).
 */
export async function apiLogin(email: string, password: string = TEST_PASSWORD): Promise<LoginResponse> {
  // Try to serve the token from the pre-cached auth state written by global-setup.
  const role = EMAIL_TO_ROLE[email];
  if (role) {
    try {
      const token = getAuthToken(role);

      // Decode the JWT payload to check expiry (no crypto needed — just base64).
      const payloadB64 = token.split('.')[1];
      if (payloadB64) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8'));
        if (payload.exp && Date.now() / 1000 < payload.exp) {
          // Token is still valid — build a synthetic LoginResponse without hitting the API.
          return {
            accessToken: token,
            refreshToken: '',
            user: {
              userId: payload.userId || payload.sub || '',
              email: payload.email || email,
              fullName: payload.fullName || '',
            },
          };
        }
      }
    } catch {
      // Fall through to real login if anything goes wrong reading the cache.
    }
  }

  // Fallback: perform an actual login (needed for dynamically created test users,
  // or when the cache is absent / expired).
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
 * Verify a freshly registered user's email using the verificationUrl the
 * register endpoint returns in dev/test. Needed whenever a spec registers
 * a user and then signs in, since REQUIRE_EMAIL_VERIFICATION blocks
 * unverified logins.
 */
export async function verifyEmail(regBody: any): Promise<void> {
  const verificationUrl: string | undefined = regBody?.verificationUrl;
  if (!verificationUrl) {
    throw new Error('No verificationUrl in register response; cannot verify email.');
  }
  const token = new URL(verificationUrl).searchParams.get('token');
  if (!token) {
    throw new Error('verificationUrl is missing the token.');
  }
  const res = await fetch(`${API_URL}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) {
    throw new Error(`verify-email failed with status ${res.status}`);
  }
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
