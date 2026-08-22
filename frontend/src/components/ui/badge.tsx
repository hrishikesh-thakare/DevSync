import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * §8 Status Chips / Priority Badges: 12px, pill radius, 2px 8px padding.
 *
 * Every tinted variant pairs `bg-*-muted` with `text-*-on-muted`, never with
 * the ramp's base colour. §3 measures why: `--primary` on its own 15% tint is
 * 3.53:1 and `--special` is 3.89:1, both under 4.5:1. `--success` and
 * `--warning` are light enough that their on-muted value IS the base.
 */
const badgeVariants = {
  default: "bg-primary-muted text-primary-on-muted",
  secondary: "bg-hover text-muted-foreground",
  destructive: "bg-danger-muted text-danger-on-muted",
  outline: "bg-transparent shadow-sm text-muted-foreground",
  success: "bg-success-muted text-success-on-muted",
  warning: "bg-warning-muted text-warning-on-muted",
  info: "bg-info-muted text-info-on-muted",
  special: "bg-special-muted text-special-on-muted",
  /** Neutral count pill — §8 Count Badges. */
  count: "bg-muted text-subtle-foreground",
  /** Unread count pill — §8 Count Badges. */
  unread: "bg-primary text-primary-foreground",
}

export type BadgeVariant = keyof typeof badgeVariants

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-[510]",
        "transition-colors duration-[--duration-fast] ease-standard",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
