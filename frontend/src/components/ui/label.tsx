import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * §8 Form Controls: "Label | 13px weight 510 `--text-secondary`, 6px below."
 *
 * `htmlFor` is not optional. "Every control needs a `<label>`. A placeholder is
 * not a label — it disappears on input."
 */
const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "block mb-1.5 text-button font-[510] text-muted-foreground",
      "peer-disabled:cursor-not-allowed peer-disabled:text-disabled",
      className
    )}
    {...props}
  />
))
Label.displayName = "Label"

export { Label }
