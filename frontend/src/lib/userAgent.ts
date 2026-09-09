/**
 * Turns the raw `user-agent` header stored on a refresh token into something a
 * person can recognise in the session list.
 *
 * Deliberately coarse: the goal is only "is this the laptop or the phone", so a
 * handful of substring checks beat pulling in a UA-parsing dependency. Order
 * matters — Edge and Chrome both claim "Chrome", and every Chromium browser
 * also claims "Safari".
 */
export function describeUserAgent(ua: string | null | undefined): string {
  if (!ua || ua === 'unknown') return 'Unknown device';

  const browser =
    /\bEdg\//.test(ua) ? 'Edge'
    : /\bOPR\/|\bOpera\b/.test(ua) ? 'Opera'
    : /\bChrome\//.test(ua) ? 'Chrome'
    : /\bFirefox\//.test(ua) ? 'Firefox'
    : /\bSafari\//.test(ua) ? 'Safari'
    : null;

  const os =
    /\bWindows\b/.test(ua) ? 'Windows'
    : /\bAndroid\b/.test(ua) ? 'Android'
    : /\biPhone\b|\biPad\b/.test(ua) ? 'iOS'
    : /\bMac OS X\b/.test(ua) ? 'macOS'
    : /\bLinux\b/.test(ua) ? 'Linux'
    : null;

  if (browser && os) return `${browser} on ${os}`;
  if (browser) return browser;
  if (os) return os;
  // Not a browser at all — curl, Playwright's API client, a mobile app.
  return ua.length > 60 ? `${ua.slice(0, 60)}…` : ua;
}
