import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  compact?: boolean
  /** Renders the §8 error treatment: danger border + `aria-invalid`. */
  invalid?: boolean
}

/**
 * §8 Inputs & Forms. Two details that are easy to get wrong:
 *
 *   - The ground is `rgba(255,255,255,0.02)` — "nearly invisible" — not
 *     `--bg-inset`, which is darker than the canvas and reads as a well.
 *   - The base size is 16px so iOS does not auto-zoom on focus (§11), stepping
 *     down to the 14px UI size once there is a pointer / larger viewport.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, compact = false, invalid = false, ...props }, ref) => {
    return (
      <input
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          "flex w-full rounded-[6px] border bg-input-bg px-3 text-base sm:text-ui font-normal text-muted-foreground",
          "transition-colors duration-[--duration-fast] ease-standard",
          "placeholder:text-subtle-foreground",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:text-disabled disabled:border-border",
          invalid ? "border-danger-border" : "border-input",
          compact ? "h-[32px]" : "h-[36px]",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
