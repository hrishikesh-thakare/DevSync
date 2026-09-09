import { env } from '../config/env.js';

/**
 * Zoom "Start call" integration — the link-out pattern Slack's own Zoom/Meet
 * Calls integration uses, not an embed. A Server-to-Server OAuth app (see
 * `env.ts`'s doc comment) means there is no per-user or per-workspace OAuth
 * consent flow: every meeting is created under the one Zoom account that
 * owns these credentials, and `join_before_host` means nobody actually
 * needs a Zoom account, or to wait for that account's owner, to join.
 */

interface CachedToken {
  value: string;
  expiresAt: number;
}

let cachedToken: CachedToken | null = null;

async function getAccessToken(): Promise<string> {
  // 30s safety margin so a token doesn't expire mid-flight between this
  // check and the meeting-creation request that uses it.
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }

  if (!env.ZOOM_ACCOUNT_ID || !env.ZOOM_CLIENT_ID || !env.ZOOM_CLIENT_SECRET) {
    throw new Error('Zoom is not configured (ZOOM_ACCOUNT_ID/ZOOM_CLIENT_ID/ZOOM_CLIENT_SECRET).');
  }

  const basic = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${env.ZOOM_ACCOUNT_ID}`,
    { method: 'POST', headers: { Authorization: `Basic ${basic}` } },
  );

  if (!res.ok) {
    throw new Error(`Zoom token request failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.value;
}

export interface ZoomMeeting {
  joinUrl: string;
  meetingId: number;
}

export async function createZoomMeeting(topic: string): Promise<ZoomMeeting> {
  const token = await getAccessToken();
  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic: topic.slice(0, 200),
      type: 1, // instant meeting — starts the moment someone joins, no scheduled time
      settings: {
        // Without this, nobody can get in until the Zoom account owner
        // personally joins as host — but that account exists only to hold
        // API credentials, not to staff every call.
        join_before_host: true,
        waiting_room: false,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Zoom meeting creation failed (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as { id: number; join_url: string };
  return { joinUrl: data.join_url, meetingId: data.id };
}

/**
 * Force-ends a meeting that's in progress, kicking out anyone still on it —
 * not the same as deleting/cancelling a scheduled meeting (`DELETE
 * /meetings/{id}`), which is for a meeting nobody has started yet.
 */
export async function endZoomMeeting(meetingId: number): Promise<void> {
  const token = await getAccessToken();
  const res = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}/status`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'end' }),
  });

  // 404 means the meeting is already gone (everyone already left and Zoom
  // cleaned it up on its own) — not an error worth failing the request over.
  if (!res.ok && res.status !== 404) {
    throw new Error(`Zoom meeting end failed (${res.status}): ${await res.text()}`);
  }
}
