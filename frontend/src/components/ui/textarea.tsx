import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Renders the §8 error treatment: danger border + `aria-invalid`. */
  invalid?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid = false, ...props }, ref) => {
    return (
      <textarea
        aria-invalid={invalid || undefined}
        className={cn(
          "flex min-h-[80px] w-full rounded-[6px] border bg-input-bg px-3 py-2 text-base sm:text-ui font-normal text-muted-foreground",
          "transition-colors duration-[--duration-fast] ease-standard",
          "placeholder:text-subtle-foreground",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:text-disabled disabled:border-border",
          invalid ? "border-danger-border" : "border-input",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
