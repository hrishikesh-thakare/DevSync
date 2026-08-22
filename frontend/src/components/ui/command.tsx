import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"
import { useFocusTrap } from "@/hooks/useFocusTrap"

/* ── Command Palette (§8 Command Palette) ────────────────────────
   Hand-built — there is no cmdk in this project (§2). Panel on
   `--bg-surface-raised`, 640px max width, top 20vh, `--shadow-elevated`.

   §8: "Selection follows the keyboard, so the active item is styled by
   `aria-selected`, not `:hover`." That means the keyboard has to actually drive
   the selection, which is what the ArrowUp/ArrowDown/Home/End/Enter handling
   below provides. The input keeps DOM focus throughout and points at the active
   option via `aria-activedescendant`, so typing and navigating never fight. */

interface CommandContextValue {
  search: string
  setSearch: (v: string) => void
  activeValue: string
  setActiveValue: (v: string) => void
  listId: string
  registerItem: (value: string, onSelect?: () => void) => void
  unregisterItem: (value: string) => void
  items: { value: string; onSelect?: () => void }[]
}

const CommandContext = React.createContext<CommandContextValue | null>(null)

function useCommand(): CommandContextValue {
  const ctx = React.useContext(CommandContext)
  if (!ctx) throw new Error("Command subcomponents must be used inside <Command>")
  return ctx
}

interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  shouldFilter?: boolean
}

function Command({ className, children, ...props }: CommandProps) {
  const [search, setSearch] = React.useState("")
  // The registry lives in state, not a ref: `aria-selected` is decided during
  // render, and reading a mutable ref there would tear between what the keyboard
  // thinks is active and what is painted.
  const [items, setItems] = React.useState<{ value: string; onSelect?: () => void }[]>([])
  const [activeValue, setActiveValue] = React.useState("")
  const listId = React.useId()

  const registerItem = React.useCallback((value: string, onSelect?: () => void) => {
    setItems((prev) => {
      const at = prev.findIndex((i) => i.value === value)
      if (at >= 0) {
        if (prev[at].onSelect === onSelect) return prev
        const next = prev.slice()
        next[at] = { value, onSelect }
        return next
      }
      return [...prev, { value, onSelect }]
    })
  }, [])

  const unregisterItem = React.useCallback((value: string) => {
    setItems((prev) => (prev.some((i) => i.value === value) ? prev.filter((i) => i.value !== value) : prev))
  }, [])

  // Results change under the cursor as the query narrows, so the active item is
  // resolved during render rather than corrected afterwards in an effect —
  // which would paint one frame pointing at an item that no longer exists.
  const effectiveActive =
    items.some((i) => i.value === activeValue) ? activeValue : (items[0]?.value ?? "")

  const ctx = React.useMemo(
    () => ({
      search, setSearch, activeValue: effectiveActive, setActiveValue,
      listId, registerItem, unregisterItem, items,
    }),
    [search, effectiveActive, listId, registerItem, unregisterItem, items]
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (items.length === 0) return
    const index = items.findIndex((i) => i.value === effectiveActive)

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveValue(items[(index + 1) % items.length].value)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveValue(items[(index - 1 + items.length) % items.length].value)
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveValue(items[0].value)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveValue(items[items.length - 1].value)
    } else if (e.key === "Enter") {
      e.preventDefault()
      items[index]?.onSelect?.()
    }
  }

  return (
    <CommandContext.Provider value={ctx}>
      <div
        onKeyDown={onKeyDown}
        className={cn("flex flex-col overflow-hidden rounded-[8px] bg-popover", className)}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  )
}

interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
  children: React.ReactNode
}

function CommandDialog({ open, onOpenChange, className, children }: CommandDialogProps) {
  const panelRef = useFocusTrap<HTMLDivElement>(open)

  React.useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [open, onOpenChange])

  if (!open) return null

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[var(--z-overlay)] bg-overlay animate-in fade-in-0 duration-[--duration-base]"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-[20vh] px-4 pointer-events-none">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className={cn(
            "pointer-events-auto w-full max-w-[640px] rounded-[8px] bg-popover shadow-md ring-1 ring-border",
            "animate-in fade-in-0 zoom-in-96 duration-[--duration-slow]",
            className
          )}
        >
          {children}
        </div>
      </div>
    </>,
    document.body
  )
}

interface CommandInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string
  onValueChange?: (value: string) => void
}

function CommandInput({ className, value, onValueChange, ...props }: CommandInputProps) {
  const ctx = useCommand()
  const inputValue = value ?? ctx.search
  const handleChange = onValueChange ?? ctx.setSearch

  return (
    <div className="flex items-center border-b border-border px-3">
      <Search className="mr-2 h-4 w-4 shrink-0 text-subtle-foreground" strokeWidth={1.75} aria-hidden="true" />
      <input
        autoFocus
        role="combobox"
        aria-expanded="true"
        aria-controls={ctx.listId}
        aria-activedescendant={ctx.activeValue ? `${ctx.listId}-${ctx.activeValue}` : undefined}
        aria-autocomplete="list"
        className={cn(
          "flex h-11 w-full bg-transparent py-3 text-body text-foreground outline-none",
          "placeholder:text-subtle-foreground disabled:cursor-not-allowed disabled:text-disabled",
          className
        )}
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        {...props}
      />
    </div>
  )
}

function CommandList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useCommand()
  return (
    <div
      id={ctx.listId}
      role="listbox"
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
      {...props}
    >
      {children}
    </div>
  )
}

/** §8: 14px `--text-muted`, centred, 32px vertical padding. */
function CommandEmpty({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("py-8 text-center text-ui text-subtle-foreground", className)} {...props}>
      {children}
    </div>
  )
}

interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: string
}

function CommandGroup({ className, heading, children, ...props }: CommandGroupProps) {
  const headingId = React.useId()
  return (
    <div
      className={cn("overflow-hidden p-1", className)}
      role="group"
      aria-labelledby={heading ? headingId : undefined}
      {...props}
    >
      {heading && (
        <div id={headingId} className="px-2 py-1.5 text-micro font-[510] text-subtle-foreground">
          {heading}
        </div>
      )}
      {children}
    </div>
  )
}

interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onSelect?: () => void
  disabled?: boolean
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, value, onSelect, disabled, children, ...props }, ref) => {
    const ctx = useCommand()
    const isActive = ctx.activeValue === value
    const nodeRef = React.useRef<HTMLDivElement | null>(null)

    React.useEffect(() => {
      if (!value || disabled) return
      ctx.registerItem(value, onSelect)
      return () => ctx.unregisterItem(value)
    }, [ctx, value, disabled, onSelect])

    // Keep the keyboard-selected row in view.
    React.useEffect(() => {
      if (isActive) nodeRef.current?.scrollIntoView({ block: "nearest" })
    }, [isActive])

    return (
      <div
        ref={(node) => {
          nodeRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        id={value ? `${ctx.listId}-${value}` : undefined}
        role="option"
        aria-selected={isActive}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onSelect?.()}
        onMouseMove={() => value && !disabled && ctx.setActiveValue(value)}
        className={cn(
          "relative flex cursor-pointer select-none items-center gap-2 rounded-[6px] px-3 py-2 text-ui",
          "transition-colors duration-[--duration-fast] ease-standard",
          disabled ? "pointer-events-none text-disabled" : "text-muted-foreground",
          isActive && !disabled && "bg-hover text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
CommandItem.displayName = "CommandItem"

function CommandSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="none" className={cn("mx-1 my-1 h-px bg-border", className)} {...props} />
}

/** §8: 11px `--font-mono`, `--bg-inset`, `--text-muted`, 4px radius, 2px 6px. */
function CommandShortcut({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "ml-auto rounded-[4px] bg-muted px-1.5 py-0.5 font-mono text-micro text-subtle-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
}
