import type { CookieOptions } from 'express';
import { env } from '../config/env.js';

/**
 * Options for the `refreshToken` cookie.
 *
 * The default `sameSite: 'lax'` is correct only while the SPA and the API share
 * a site. In the normal production split — frontend on one host, API on another
 * — the refresh call is cross-site, so a Lax cookie is simply not attached to
 * it. The user then gets signed out the moment their 15-minute access token
 * expires, on every device, with no way to recover but logging in again.
 *
 * So the mode is derived from the two URLs we already know rather than left to
 * whoever writes the deploy config: same site → Lax (stronger, and it keeps
 * local dev working over plain http); cross-site → `None` + `Secure`, which is
 * the only combination browsers will attach to a cross-site XHR.
 *
 * `COOKIE_SAMESITE` / `COOKIE_SECURE` override the derivation for the cases it
 * cannot see — a proxy that puts both apps on one hostname, say.
 */

/** `a.b.example.co.uk` → `example.co.uk`; good enough for the public suffixes we care about. */
const registrableDomain = (hostname: string): string => {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  // An IP address or a single label (`localhost`) is its own site.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || !host.includes('.')) return host;

  const parts = host.split('.');
  // Two-part public suffixes (co.uk, com.au, github.io, ...) need three labels
  // to reach the registrable name; everything else needs two.
  const twoPartSuffix = /^(co|com|net|org|gov|edu|ac|gov)\.[a-z]{2}$/.test(parts.slice(-2).join('.'));
  return parts.slice(twoPartSuffix ? -3 : -2).join('.');
};

/**
 * `None` additionally requires `Secure`, and a `Secure` cookie is only stored
 * over https (localhost being the one exception browsers make). So the mode
 * turns on only when the API is actually served over TLS — otherwise a local
 * setup whose `BACKEND_URL` happens to point somewhere else (an ngrok tunnel
 * for GitHub webhooks, say) would silently switch to a cookie the dev server
 * cannot deliver.
 */
const needsCrossSiteCookie = (): boolean => {
  try {
    const frontend = new URL(env.FRONTEND_URL);
    const backend = new URL(env.BACKEND_URL);
    if (backend.protocol !== 'https:') return false;
    return registrableDomain(frontend.hostname) !== registrableDomain(backend.hostname);
  } catch {
    // A malformed URL should not silently produce a cookie that never sends;
    // assume the safer-to-deliver cross-site mode in production only.
    return env.NODE_ENV === 'production';
  }
};

const resolveSameSite = (): 'lax' | 'strict' | 'none' => {
  const override = env.COOKIE_SAMESITE.toLowerCase();
  if (override === 'lax' || override === 'strict' || override === 'none') return override;
  return needsCrossSiteCookie() ? 'none' : 'lax';
};

export const refreshCookieOptions = (): CookieOptions => {
  const sameSite = resolveSameSite();
  return {
    httpOnly: true,
    // `SameSite=None` without `Secure` is rejected outright by every current
    // browser, so it is not an independent choice.
    secure: sameSite === 'none' ? true : env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    sameSite,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  };
};

/**
 * `clearCookie` only matches a cookie whose attributes match the ones it was
 * set with, so this must mirror `refreshCookieOptions` exactly — minus
 * `maxAge`, which Express replaces with an expiry in the past.
 */
export const clearRefreshCookieOptions = (): CookieOptions => {
  const { maxAge: _maxAge, ...rest } = refreshCookieOptions();
  return rest;
};
