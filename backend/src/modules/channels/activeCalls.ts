/**
 * Ephemeral "a call is live in this channel" record — never persisted,
 * because it's derived state (Zoom, not DevSync, is the actual source of
 * truth for whether anyone is still in the meeting). This just avoids
 * minting a new Zoom meeting on every "Start call" click: the first click
 * creates one, everyone after reuses the same `joinUrl` until it ages out.
 */

export interface ActiveCall {
  joinUrl: string;
  meetingId: number;
  createdAt: number;
}

// Long enough that a call spanning a normal working session doesn't get
// silently replaced mid-conversation; short enough that a channel doesn't
// offer a day-old, almost-certainly-empty "Join call" forever. Zoom instant
// meetings have no fixed end time of their own to key off instead.
const TTL_MS = 4 * 60 * 60 * 1000;

const activeCalls = new Map<string, ActiveCall>();

export function getActiveCall(channelId: string): ActiveCall | undefined {
  const call = activeCalls.get(channelId);
  if (!call) return undefined;
  if (Date.now() - call.createdAt > TTL_MS) {
    activeCalls.delete(channelId);
    return undefined;
  }
  return call;
}

export function setActiveCall(channelId: string, call: ActiveCall): void {
  activeCalls.set(channelId, call);
}

export function clearActiveCall(channelId: string): void {
  activeCalls.delete(channelId);
}
