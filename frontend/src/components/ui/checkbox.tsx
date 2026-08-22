import * as React from "react"
import { cn } from "@/lib/utils"
import { Check, Minus } from "lucide-react"

/**
 * §8 Form Controls: 16px, 4px radius, 1px `--border-default`.
 *
 * The unchecked border is `--border-default` and NOT `--border-subtle`: an
 * unchecked box's only boundary is that line, which makes it informational, and
 * §3 requires >=3:1 for that. White-alpha at 0.06 composites to 1.29:1.
 */
export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, indeterminate = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        role="checkbox"
        type="button"
        disabled={disabled}
        aria-checked={indeterminate ? "mixed" : checked}
        data-state={indeterminate ? "indeterminate" : checked ? "checked" : "unchecked"}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
          "transition-colors duration-[--duration-fast] ease-standard",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:border-border disabled:text-disabled",
          checked || indeterminate
            ? "border-transparent bg-primary text-primary-foreground"
            : "border-input bg-transparent",
          className
        )}
        {...props}
      >
        {indeterminate ? (
          <Minus className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        ) : checked ? (
          <Check className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
        ) : null}
      </button>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
