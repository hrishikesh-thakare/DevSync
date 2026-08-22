import * as React from "react"
import { cn } from "@/lib/utils"

/* ── Switch ────────────────────────────────────────────────────── */

export interface SwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "inline-flex h-[18px] w-[32px] shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-100 ease-in-out",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-[var(--primary)]" : "bg-muted",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-[14px] w-[14px] rounded-full shadow-sm transition-transform duration-100 ease-in-out",
            checked
              ? "translate-x-[14px] bg-primary-foreground"
              : "translate-x-0 bg-muted-foreground"
          )}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
