import { cn } from "@/lib/utils"

/**
 * §3 Presence: an 8px `--radius-full` dot on the avatar's bottom-right, with a
 * 2px ring in the surface colour behind it so it reads as separate from the
 * photo.
 *
 *   online  → `--success`
 *   away    → `--warning`
 *   offline → `--text-muted`, HOLLOW (1px `--border-strong`, transparent fill)
 *
 * Offline uses `--text-muted` (5.86:1) rather than `--text-disabled` (3.45:1),
 * because a presence dot is a non-text graphic and needs 3:1 against its
 * surface.
 *
 * The `users.presence` column is an unconstrained varchar with no server-side
 * validation, so anything outside the three known values is treated as offline
 * rather than trusted — §3's "verify the exact accepted values against your
 * validation layer before shipping".
 */
export type Presence = "online" | "away" | "offline"

export function normalizePresence(value?: string | null, statusText?: string | null): Presence {
  // The stored value is authoritative — `POST /auth/status` and
  // `POST /auth/presence` validate it against this same three-value enum.
  if (value === "online" || value === "away" || value === "offline") return value

  // Fallback for rows written before the API was validated, when "Away" was
  // only ever recorded as free-text status against an `offline` presence.
  if (statusText === "Away") return "away"

  return "offline"
}

const dotStyles: Record<Presence, string> = {
  online: "bg-success",
  away: "bg-warning",
  offline: "bg-transparent border border-border-strong",
}

const dotLabels: Record<Presence, string> = {
  online: "Online",
  away: "Away",
  offline: "Offline",
}

interface PresenceDotProps {
  presence: Presence
  /** Token class for the ring, matching the surface the avatar sits on. */
  ringClassName?: string
  className?: string
}

export function PresenceDot({
  presence,
  ringClassName = "ring-card",
  className,
}: PresenceDotProps) {
  return (
    <span
      role="img"
      aria-label={dotLabels[presence]}
      className={cn(
        "block h-2 w-2 rounded-full ring-2",
        dotStyles[presence],
        ringClassName,
        className
      )}
    />
  )
}
