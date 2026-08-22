import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, Minus } from "lucide-react"

/* ── Checkbox ──────────────────────────────────────────────────── */

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, indeterminate = false, onCheckedChange, ...props }, ref) => {
    return (
      <button
        ref={ref}
        role="checkbox"
        type="button"
        aria-checked={indeterminate ? "mixed" : checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-100 ease-in-out",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          checked || indeterminate
            ? "border-transparent bg-[var(--primary)] text-primary-foreground"
            : "border-border bg-transparent",
          className
        )}
        {...props}
      >
        {indeterminate ? (
          <Minus className="h-3 w-3" strokeWidth={1.75} />
        ) : checked ? (
          <Check className="h-3 w-3" strokeWidth={1.75} />
        ) : null}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
