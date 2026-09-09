import type { Presence } from '@/types/api';

/**
 * Presence colours, shared between `MemberAvatar` (every roster/board avatar
 * in the app) and `AccountSettingsPage` (the signed-in user's own profile
 * card). Reuses the status domain tokens rather than inventing a parallel
 * palette — they are the categorical ramp already used by the boards, and
 * the rose `--chart-*` scale cannot separate categories (see index.css:99).
 *
 * Lives outside `MemberAvatar.tsx` because a component file may only export
 * components (`react-refresh/only-export-components`) — exporting this
 * constant from there breaks Fast Refresh for the whole file.
 */
export const PRESENCE_STYLE: Record<Presence, { dot: string; chip: string; label: string }> = {
  // `dot` is the small AvatarBadge corner marker used everywhere an avatar
  // already carries the name (boards, message authors, member lists) — big
  // enough to read at a glance next to a face, not meant to stand alone.
  // `chip` is for anywhere presence has to be legible *without* an avatar
  // next to it: a solid colour with *dark* text, not white — `--status-done`
  // and `--status-in-review` are both light/pastel (oklch lightness 0.72 and
  // 0.78), so white text on them is exactly the low-contrast problem this
  // chip exists to fix. `text-background` (near-black in dark mode) is what
  // actually reads; `RoleBadge`/`StatusBadge` on the members page get away
  // with white only because their raw Tailwind colours (`bg-emerald-600`,
  // `bg-red-600`) are a full step darker than this app's own status tokens.
  online: { dot: 'bg-status-done', chip: 'bg-status-done text-background', label: 'Online' },
  away: { dot: 'bg-status-in-review', chip: 'bg-status-in-review text-background', label: 'Away' },
  offline: { dot: 'bg-muted-foreground', chip: 'bg-muted-foreground text-background', label: 'Offline' },
};
