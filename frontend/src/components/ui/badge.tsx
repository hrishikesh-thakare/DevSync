import * as React from "react"
import { cn } from "@/lib/utils"

const badgeVariants = {
  default: "bg-[var(--primary-muted)] text-[var(--primary)]",
  secondary: "bg-hover text-muted-foreground",
  destructive: "bg-[var(--danger-muted)] text-[var(--danger)]",
  outline: "bg-transparent border border-border text-muted-foreground",
  success: "bg-[var(--success-muted)] text-[var(--success)]",
  warning: "bg-[var(--warning-muted)] text-[var(--warning)]",
  info: "bg-[var(--info-muted)] text-[var(--info)]",
  special: "bg-[var(--special-muted)] text-[var(--special)]",
}

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: keyof typeof badgeVariants
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-[510] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2",
        badgeVariants[variant],
        className
      )}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
