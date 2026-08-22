import * as React from "react"
import { cn } from "@/lib/utils"

/* ── RadioGroup ────────────────────────────────────────────────── */

interface RadioGroupContextValue {
  value: string
  onValueChange: (value: string) => void
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({
  value: "",
  onValueChange: () => {},
})

export interface RadioGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  onValueChange: (value: string) => void
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, ...props }, ref) => (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div
        ref={ref}
        role="radiogroup"
        className={cn("flex flex-col gap-2", className)}
        {...props}
      />
    </RadioGroupContext.Provider>
  )
)
RadioGroup.displayName = "RadioGroup"

export interface RadioGroupItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext)
    const isChecked = ctx.value === value

    return (
      <button
        ref={ref}
        type="button"
        role="radio"
        aria-checked={isChecked}
        onClick={() => ctx.onValueChange(value)}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-100 ease-in-out",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          isChecked
            ? "border-[var(--primary)]"
            : "border-border",
          className
        )}
        {...props}
      >
        {isChecked && (
          <span className="block h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
        )}
      </button>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
