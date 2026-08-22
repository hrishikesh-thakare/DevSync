const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/** A field-level validation failure from the backend's zod `validate()` middleware. */
export interface ApiFieldError {
  path: string;
  message: string;
}

/**
 * Carries the HTTP status alongside the message so callers can tell apart the
 * states the backend deliberately distinguishes — 401 bad credentials, 423
 * account lockout, 403 unverified email, 429 rate limit — rather than
 * string-matching the error text.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details?: ApiFieldError[];

  constructor(message: string, status: number, details?: ApiFieldError[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

/**
 * Custom fetch wrapper that automatically includes credentials (cookies)
 * and intercepts 401 Unauthorized errors to attempt a token refresh.
 *
 * The return type is a generic defaulting to `any`, which is the one deliberate
 * `any` left in this codebase. Two reasons it stays:
 *
 *  - Callers that *do* know the shape get it for free by annotating the target
 *    (`const p: Project[] = await apiFetch(...)` infers `T = Project[]`), so the
 *    escape hatch costs nothing where types exist.
 *  - Narrowing the default to `unknown` is not a lint fix but a data-layer
 *    refactor. Several stores currently assign a partially-built object literal
 *    to a fully-specified interface (see `useTaskStore.fetchTasks`, which omits
 *    `projectId`, `activityLog`, `createdBy` and more) and only typecheck
 *    because `any` flows through. Tightening this signature means completing
 *    those interfaces against the real API responses first.
 *
 * Prefer annotating the call site over widening this.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  
  const token = localStorage.getItem('accessToken');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // Extremely important for sending HTTP-only cookies
  };

  let response = await fetch(url, config);

  // If 401 Unauthorized, attempt to refresh token
  // Public auth endpoints must never trigger the refresh dance: a 401 from them
  // is the real answer, not an expired-session symptom.
  const PUBLIC_AUTH = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/oauth/callback'];

  if (response.status === 401 && !PUBLIC_AUTH.includes(endpoint)) {
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        // Token refreshed successfully, save it and retry original request
        const refreshData = await refreshRes.json();
        localStorage.setItem('accessToken', refreshData.accessToken);
        
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${refreshData.accessToken}`
        };
        
        response = await fetch(url, config);

        // A fresh token that still gets rejected means the session is truly gone
        // (user deactivated, deleted, or role revoked) — stop pretending otherwise.
        if (response.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
      } else {
        // Refresh failed, force logout via Zustand store
        window.dispatchEvent(new Event('auth:unauthorized'));
        throw new ApiError('Session expired. Please log in again.', 401);
      }
    } catch (refreshErr) {
      window.dispatchEvent(new Event('auth:unauthorized'));
      throw refreshErr;
    }
  }

  // Parse JSON response
  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || response.statusText || 'An API error occurred',
      response.status,
      data?.details,
    );
  }

  return data;
}
