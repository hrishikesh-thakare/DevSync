import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"

/* ── Select (§8 Form Controls / Dropdowns, §18 Keyboard map) ─────
   Input styling from §8 Inputs & Forms, menu from §8 Dropdowns & Popovers, and
   a full listbox keyboard contract built by hand (§2):

     - the trigger is a `combobox` wired to the listbox via `aria-controls` and
       `aria-activedescendant`,
     - Arrow keys / Home / End move the active option, Enter and Space commit,
       Escape closes, Tab closes and moves on,
     - typing jumps to the first option starting with that character,
     - closing returns focus to the trigger (§18). */

interface SelectItemMeta {
  value: string
  label: string
  disabled?: boolean
}

interface SelectContextValue {
  value: string | undefined
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  anchorRect: DOMRect | null
  setAnchorRect: (rect: DOMRect | null) => void
  disabled?: boolean
  listboxId: string
  activeValue: string | undefined
  setActiveValue: (value: string | undefined) => void
  registerItem: (item: SelectItemMeta) => void
  unregisterItem: (value: string) => void
  itemsRef: React.MutableRefObject<SelectItemMeta[]>
  triggerRef: React.MutableRefObject<HTMLButtonElement | null>
  setTrigger: (node: HTMLButtonElement | null) => void
}

const SelectContext = React.createContext<SelectContextValue | null>(null)

function useSelect(): SelectContextValue {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("Select subcomponents must be used inside <Select>")
  return ctx
}

interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}

function Select({ value, defaultValue, onValueChange, disabled, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(value ?? defaultValue)
  const [open, setOpenState] = React.useState(false)
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null)
  const [activeValue, setActiveValue] = React.useState<string | undefined>(undefined)
  const itemsRef = React.useRef<SelectItemMeta[]>([])
  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const listboxId = React.useId()

  const currentValue = value !== undefined ? value : internalValue

  const setTrigger = React.useCallback((node: HTMLButtonElement | null) => {
    triggerRef.current = node
  }, [])

  const setOpen = React.useCallback((next: boolean) => {
    setOpenState(next)
    if (!next) queueMicrotask(() => triggerRef.current?.focus())
  }, [])

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (value === undefined) setInternalValue(newValue)
      onValueChange?.(newValue)
      setOpen(false)
    },
    [value, onValueChange, setOpen]
  )

  const registerItem = React.useCallback((item: SelectItemMeta) => {
    const existing = itemsRef.current.findIndex((i) => i.value === item.value)
    if (existing >= 0) itemsRef.current[existing] = item
    else itemsRef.current.push(item)
  }, [])

  const unregisterItem = React.useCallback((itemValue: string) => {
    itemsRef.current = itemsRef.current.filter((i) => i.value !== itemValue)
  }, [])

  const ctx = React.useMemo(
    () => ({
      value: currentValue,
      onValueChange: handleValueChange,
      open,
      setOpen,
      anchorRect,
      setAnchorRect,
      disabled,
      listboxId,
      activeValue,
      setActiveValue,
      registerItem,
      unregisterItem,
      itemsRef,
      triggerRef,
      setTrigger,
    }),
    [
      currentValue, handleValueChange, open, setOpen, anchorRect, disabled,
      listboxId, activeValue, registerItem, unregisterItem, setTrigger,
    ]
  )

  return <SelectContext.Provider value={ctx}>{children}</SelectContext.Provider>
}

type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  compact?: boolean
}

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, disabled, compact = false, children, ...props }, ref) => {
    const ctx = useSelect()
    const isDisabled = disabled ?? ctx.disabled

    const setRef = (node: HTMLButtonElement | null) => {
      ctx.setTrigger(node)
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
    }

    const openMenu = () => {
      if (isDisabled) return
      if (ctx.triggerRef.current) {
        ctx.setAnchorRect(ctx.triggerRef.current.getBoundingClientRect())
      }
      ctx.setActiveValue(ctx.value ?? ctx.itemsRef.current[0]?.value)
      ctx.setOpen(true)
    }

    return (
      <button
        ref={setRef}
        type="button"
        role="combobox"
        aria-expanded={ctx.open}
        aria-haspopup="listbox"
        aria-controls={ctx.open ? ctx.listboxId : undefined}
        aria-activedescendant={
          ctx.open && ctx.activeValue ? `${ctx.listboxId}-${ctx.activeValue}` : undefined
        }
        disabled={isDisabled}
        onClick={() => (ctx.open ? ctx.setOpen(false) : openMenu())}
        onKeyDown={(e) => {
          if (ctx.open) return
          if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            openMenu()
          }
        }}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-[6px] border border-input bg-input-bg px-3",
          "text-base sm:text-ui text-foreground",
          "transition-colors duration-[--duration-fast] ease-standard",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
          "disabled:cursor-not-allowed disabled:text-disabled disabled:border-border",
          compact ? "h-[32px]" : "h-[36px]",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, ...props }, ref) => {
    const ctx = useSelect()
    // Show the option's LABEL, not its raw value — otherwise a select bound to
    // `in_progress` renders the string "in_progress" at the call site.
    const label = ctx.itemsRef.current.find((i) => i.value === ctx.value)?.label
    return (
      <span ref={ref} className={cn("truncate", !ctx.value && "text-subtle-foreground", className)} {...props}>
        {ctx.value ? (label ?? ctx.value) : placeholder}
      </span>
    )
  }
)
SelectValue.displayName = "SelectValue"

type SelectContentProps = React.HTMLAttributes<HTMLDivElement>

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    const ctx = useSelect()
    const listRef = React.useRef<HTMLDivElement | null>(null)
    const typeahead = React.useRef({ query: "", at: 0 })

    const enabled = React.useCallback(
      () => ctx.itemsRef.current.filter((i) => !i.disabled),
      [ctx.itemsRef]
    )

    const move = React.useCallback(
      (delta: number) => {
        const list = enabled()
        if (list.length === 0) return
        const index = list.findIndex((i) => i.value === ctx.activeValue)
        const next = list[(index + delta + list.length) % list.length]
        ctx.setActiveValue(next.value)
        listRef.current
          ?.querySelector(`[data-value="${CSS.escape(next.value)}"]`)
          ?.scrollIntoView({ block: "nearest" })
      },
      [ctx, enabled]
    )

    React.useEffect(() => {
      if (!ctx.open) return

      const reposition = () => {
        if (ctx.triggerRef.current) ctx.setAnchorRect(ctx.triggerRef.current.getBoundingClientRect())
      }
      window.addEventListener("scroll", reposition, true)
      window.addEventListener("resize", reposition)

      const handleKeyDown = (e: KeyboardEvent) => {
        switch (e.key) {
          case "Escape":
            e.preventDefault()
            ctx.setOpen(false)
            return
          case "Tab":
            ctx.setOpen(false)
            return
          case "ArrowDown":
            e.preventDefault()
            move(1)
            return
          case "ArrowUp":
            e.preventDefault()
            move(-1)
            return
          case "Home":
            e.preventDefault()
            ctx.setActiveValue(enabled()[0]?.value)
            return
          case "End":
            e.preventDefault()
            { const l = enabled(); ctx.setActiveValue(l[l.length - 1]?.value) }
            return
          case "Enter":
          case " ":
            e.preventDefault()
            if (ctx.activeValue) ctx.onValueChange(ctx.activeValue)
            return
        }

        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          const now = Date.now()
          const state = typeahead.current
          state.query = now - state.at > 800 ? e.key : state.query + e.key
          state.at = now
          const hit = enabled().find((i) =>
            i.label.toLowerCase().startsWith(state.query.toLowerCase())
          )
          if (hit) ctx.setActiveValue(hit.value)
        }
      }

      const handlePointerDown = (e: MouseEvent) => {
        const target = e.target as Node
        if (listRef.current?.contains(target)) return
        if (ctx.triggerRef.current?.contains(target)) return
        ctx.setOpen(false)
      }

      document.addEventListener("keydown", handleKeyDown)
      document.addEventListener("mousedown", handlePointerDown)
      return () => {
        window.removeEventListener("scroll", reposition, true)
        window.removeEventListener("resize", reposition)
        document.removeEventListener("keydown", handleKeyDown)
        document.removeEventListener("mousedown", handlePointerDown)
      }
    }, [ctx, move, enabled])

    if (!ctx.open || !ctx.anchorRect) return null

    return createPortal(
      <div
        ref={(node) => {
          listRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        id={ctx.listboxId}
        role="listbox"
        className={cn(
          "fixed z-[var(--z-dropdown)] max-h-96 min-w-[8rem] overflow-hidden rounded-[8px] bg-popover shadow-md ring-1 ring-border",
          "animate-in fade-in-0 slide-in-from-top-1 duration-[--duration-base]",
          className
        )}
        style={{
          top: ctx.anchorRect.bottom + 4,
          left: ctx.anchorRect.left,
          width: ctx.anchorRect.width,
        }}
        {...props}
      >
        <div className="w-full p-1 max-h-96 overflow-y-auto">{children}</div>
      </div>,
      document.body
    )
  }
)
SelectContent.displayName = "SelectContent"

interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  disabled?: boolean
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, value, disabled, children, ...props }, ref) => {
    const ctx = useSelect()
    const isSelected = ctx.value === value
    const isActive = ctx.activeValue === value

    React.useEffect(() => {
      const label = typeof children === "string" ? children : value
      ctx.registerItem({ value, label, disabled })
      return () => ctx.unregisterItem(value)
    }, [ctx, value, disabled, children])

    return (
      <div
        ref={ref}
        id={`${ctx.listboxId}-${value}`}
        role="option"
        data-value={value}
        aria-selected={isSelected}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && ctx.onValueChange(value)}
        onMouseEnter={() => !disabled && ctx.setActiveValue(value)}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-[6px] py-1.5 pl-8 pr-2 text-ui",
          "transition-colors duration-[--duration-fast] ease-standard",
          disabled && "pointer-events-none text-disabled",
          isSelected
            ? "bg-primary-muted text-primary-on-muted font-[510]"
            : isActive
              ? "bg-hover text-foreground"
              : "text-muted-foreground",
          className
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
          {isSelected && <Check className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />}
        </span>
        {children}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
