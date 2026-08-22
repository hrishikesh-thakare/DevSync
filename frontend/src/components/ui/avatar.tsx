import * as React from "react"
import { cn } from "@/lib/utils"

/* ── Avatar (§8 Avatars) ─────────────────────────────────────────
   Sizes are fixed at 20 / 24 / 28 / 40px, always `--radius-full`. The fallback
   is initials at weight 510 on `--bg-surface-raised` — never a random colour
   per user, because §3's one-accent rule holds here too. */

type AvatarSize = "xs" | "sm" | "md" | "lg"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: AvatarSize
}

const avatarSizes: Record<AvatarSize, string> = {
  xs: "h-5 w-5 text-micro",
  sm: "h-6 w-6 text-micro",
  md: "h-7 w-7 text-micro",
  lg: "h-10 w-10 text-ui",
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = "md", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full",
        avatarSizes[size],
        className
      )}
      {...props}
    />
  )
)
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, alt = "", ...props }, ref) => (
  <img
    ref={ref}
    alt={alt}
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
))
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-elevated text-muted-foreground font-[510]",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

/* ── AvatarGroup ─────────────────────────────────────────────────
   §8: overlap at -8px with a 2px ring in the surface colour behind them, max 3
   visible, then a `+N` chip using the same fallback treatment.

   "Do not render a group as a decorative placeholder — if the members aren't
   loaded, render nothing." That is why an empty `names` array returns null
   rather than a row of blank circles. */

interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  names: string[]
  size?: AvatarSize
  max?: number
  /** Token name of the surface behind the group, for the separating ring. */
  ringClassName?: string
}

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")

function AvatarGroup({
  names,
  size = "sm",
  max = 3,
  ringClassName = "ring-card",
  className,
  ...props
}: AvatarGroupProps) {
  if (names.length === 0) return null

  const shown = names.slice(0, max)
  const overflow = names.length - shown.length

  return (
    <div className={cn("flex -space-x-2", className)} {...props}>
      {shown.map((name) => (
        <Avatar key={name} size={size} className={cn("ring-2", ringClassName)}>
          <AvatarFallback title={name}>{initials(name)}</AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <Avatar size={size} className={cn("ring-2", ringClassName)}>
          <AvatarFallback aria-label={`${overflow} more`}>
            +{overflow}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}

export { Avatar, AvatarImage, AvatarFallback, AvatarGroup }
