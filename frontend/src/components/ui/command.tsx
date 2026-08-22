import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"

/* ── Command Palette ───────────────────────────────────────────── */
/* Hand-built replacement for cmdk. Matches the API surface used by
   CommandPalette.tsx and ChatEditor.tsx. */

/* ── Context ─── */
interface CommandContextValue {
  search: string
  setSearch: (v: string) => void
  activeValue: string
  setActiveValue: (v: string) => void
  onSelect: (value: string) => void
  shouldFilter: boolean
  registerItem: (value: string) => void
  unregisterItem: (value: string) => void
  items: string[]
}

const CommandContext = React.createContext<CommandContextValue>({
  search: "",
  setSearch: () => {},
  activeValue: "",
  setActiveValue: () => {},
  onSelect: () => {},
  shouldFilter: true,
  registerItem: () => {},
  unregisterItem: () => {},
  items: [],
})

/* ── Command (root) ─── */
interface CommandProps extends React.HTMLAttributes<HTMLDivElement> {
  shouldFilter?: boolean
}

function Command({ shouldFilter = true, className, children, ...props }: CommandProps) {
  const [search, setSearch] = React.useState("")
  const [activeValue, setActiveValue] = React.useState("")
  const [items, setItems] = React.useState<string[]>([])

  const registerItem = React.useCallback((value: string) => {
    setItems((prev) => (prev.includes(value) ? prev : [...prev, value]))
  }, [])

  const unregisterItem = React.useCallback((value: string) => {
    setItems((prev) => prev.filter((v) => v !== value))
  }, [])

  const onSelect = React.useCallback((_value: string) => {
    // Handled by individual items
  }, [])

  return (
    <CommandContext.Provider
      value={{ search, setSearch, activeValue, setActiveValue, onSelect, shouldFilter, registerItem, unregisterItem, items }}
    >
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-[8px] bg-card",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </CommandContext.Provider>
  )
}

/* ── CommandDialog ─── */
interface CommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
  children: React.ReactNode
}

function CommandDialog({ open, onOpenChange, className, children }: CommandDialogProps) {
  // Close on Escape
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
    <div className="fixed inset-0" style={{ zIndex: 30 }}>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-[var(--overlay)]"
        onClick={() => onOpenChange(false)}
      />
      {/* Panel */}
      <div className="fixed inset-0 flex items-start justify-center pt-[20vh]" style={{ zIndex: 40 }}>
        <div
          className={cn(
            "w-full max-w-2xl rounded-[8px] bg-card shadow-md animate-in fade-in-0 zoom-in-[0.96] duration-200",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── CommandInput ─── */
interface CommandInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: string
  onValueChange?: (value: string) => void
}

function CommandInput({ className, value, onValueChange, ...props }: CommandInputProps) {
  const ctx = React.useContext(CommandContext)
  const inputValue = value ?? ctx.search
  const handleChange = onValueChange ?? ctx.setSearch

  return (
    <div className="flex items-center border-b border-border px-3">
      <Search className="mr-2 h-4 w-4 shrink-0 text-subtle-foreground" strokeWidth={1.75} />
      <input
        className={cn(
          "flex h-11 w-full bg-transparent py-3 text-body text-foreground placeholder:text-subtle-foreground outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        value={inputValue}
        onChange={(e) => handleChange(e.target.value)}
        {...props}
      />
    </div>
  )
}

/* ── CommandList ─── */
function CommandList({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
      {...props}
    >
      {children}
    </div>
  )
}

/* ── CommandEmpty ─── */
function CommandEmpty({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "py-8 text-center text-body text-subtle-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

/* ── CommandGroup ─── */
interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  heading?: string
}

function CommandGroup({ className, heading, children, ...props }: CommandGroupProps) {
  return (
    <div
      className={cn("overflow-hidden p-1", className)}
      role="group"
      {...props}
    >
      {heading && (
        <div className="px-2 py-1.5 text-micro font-[510] text-subtle-foreground tracking-[0.2px]">
          {heading}
        </div>
      )}
      {children}
    </div>
  )
}

/* ── CommandItem ─── */
interface CommandItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string
  onSelect?: () => void
  disabled?: boolean
}

const CommandItem = React.forwardRef<HTMLDivElement, CommandItemProps>(
  ({ className, value, onSelect, disabled, children, ...props }, ref) => {
    const ctx = React.useContext(CommandContext)
    const isActive = ctx.activeValue === value

    React.useEffect(() => {
      if (value) ctx.registerItem(value)
      return () => { if (value) ctx.unregisterItem(value) }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value])

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isActive}
        aria-disabled={disabled}
        data-value={value}
        onClick={() => {
          if (!disabled) onSelect?.()
        }}
        onMouseEnter={() => {
          if (value) ctx.setActiveValue(value)
        }}
        className={cn(
          "relative flex cursor-pointer items-center gap-2 rounded-[6px] px-3 py-2 text-body text-muted-foreground transition-colors duration-100 select-none",
          isActive && "bg-hover text-foreground",
          disabled && "pointer-events-none opacity-50",
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

/* ── CommandSeparator ─── */
function CommandSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn("mx-1 my-1 h-px bg-border", className)}
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
}
