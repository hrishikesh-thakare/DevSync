import * as React from "react"
import { cn } from "@/lib/utils"

/* ── RadioGroup (§8 Form Controls, §18 Keyboard map) ─────────────
   16px, `--radius-full`, 1px `--border-default`, checked 6px `--primary` dot.

   A radiogroup is a single tab stop with a roving tabindex: Tab enters the
   group at the checked item, and Arrow keys move between options (wrapping),
   selecting as they go. Making each radio its own tab stop — which is what a
   plain row of buttons does — is the failure this implements around. */

interface RadioGroupContextValue {
  value: string
  onValueChange: (value: string) => void
  name: string
  register: (value: string, el: HTMLButtonElement | null) => void
  focusRelative: (from: string, delta: number) => void
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({
  value: "",
  onValueChange: () => {},
  name: "",
  register: () => {},
  focusRelative: () => {},
})

export interface RadioGroupProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: string
  onValueChange: (value: string) => void
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const name = React.useId()
    const items = React.useRef<Map<string, HTMLButtonElement>>(new Map())
    const order = React.useRef<string[]>([])

    const register = React.useCallback((itemValue: string, el: HTMLButtonElement | null) => {
      if (el) {
        items.current.set(itemValue, el)
        if (!order.current.includes(itemValue)) order.current.push(itemValue)
      } else {
        items.current.delete(itemValue)
        order.current = order.current.filter((v) => v !== itemValue)
      }
    }, [])

    const focusRelative = React.useCallback(
      (from: string, delta: number) => {
        const list = order.current
        if (list.length === 0) return
        const index = list.indexOf(from)
        const next = list[(index + delta + list.length) % list.length]
        items.current.get(next)?.focus()
        onValueChange(next)
      },
      [onValueChange]
    )

    const ctx = React.useMemo(
      () => ({ value, onValueChange, name, register, focusRelative }),
      [value, onValueChange, name, register, focusRelative]
    )

    return (
      <RadioGroupContext.Provider value={ctx}>
        <div ref={ref} role="radiogroup" className={cn("flex flex-col gap-2", className)} {...props} />
      </RadioGroupContext.Provider>
    )
  }
)
RadioGroup.displayName = "RadioGroup"

export interface RadioGroupItemProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value"> {
  value: string
}

const RadioGroupItem = React.forwardRef<HTMLButtonElement, RadioGroupItemProps>(
  ({ className, value, disabled, ...props }, ref) => {
    const ctx = React.useContext(RadioGroupContext)
    const isChecked = ctx.value === value
    const localRef = React.useRef<HTMLButtonElement | null>(null)

    const setRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        localRef.current = node
        ctx.register(value, node)
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
      },
      [ctx, value, ref]
    )

    const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault()
        ctx.focusRelative(value, 1)
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault()
        ctx.focusRelative(value, -1)
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault()
        ctx.onValueChange(value)
      }
    }

    return (
      <button
        ref={setRef}
        type="button"
        role="radio"
        name={ctx.name}
        disabled={disabled}
        aria-checked={isChecked}
        tabIndex={isChecked ? 0 : -1}
        onClick={() => !disabled && ctx.onValueChange(value)}
        onKeyDown={onKeyDown}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          "transition-colors duration-[--duration-fast] ease-standard",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:border-border",
          isChecked ? "border-primary" : "border-input",
          className
        )}
        {...props}
      >
        {isChecked && <span className="block h-1.5 w-1.5 rounded-full bg-primary" />}
      </button>
    )
  }
)
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
