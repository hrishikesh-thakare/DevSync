import * as React from "react"
import { cn } from "@/lib/utils"

/* ── Tabs (§8 Tabs — Underline idiom, §18 Keyboard map) ──────────
   14px weight 510 `--text-muted`; active takes `--text-primary` plus a 2px
   `--primary` bottom border, over a 1px `--border-subtle` rail.

   "Active state must not be colour alone — the underline carries it too."

   Keyboard: the tablist is one tab stop with a roving tabindex; Arrow keys move
   between tabs (wrapping), Home/End jump to the ends. Triggers and panels are
   cross-linked with `aria-controls` / `aria-labelledby`. */

interface TabsContextValue {
  value: string
  onValueChange: (value: string) => void
  baseId: string
  register: (value: string, el: HTMLButtonElement | null) => void
  order: React.MutableRefObject<string[]>
  refs: React.MutableRefObject<Map<string, HTMLButtonElement>>
}

const TabsContext = React.createContext<TabsContextValue | null>(null)

function useTabs(): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("Tabs subcomponents must be used inside <Tabs>")
  return ctx
}

interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

function Tabs({ value, defaultValue, onValueChange, className, children, ...props }: TabsProps) {
  const [internalValue, setInternalValue] = React.useState(value ?? defaultValue ?? "")
  const baseId = React.useId()
  const order = React.useRef<string[]>([])
  const refs = React.useRef<Map<string, HTMLButtonElement>>(new Map())

  const handleChange = React.useCallback(
    (newValue: string) => {
      if (value === undefined) setInternalValue(newValue)
      onValueChange?.(newValue)
    },
    [value, onValueChange]
  )

  const register = React.useCallback((tabValue: string, el: HTMLButtonElement | null) => {
    if (el) {
      refs.current.set(tabValue, el)
      if (!order.current.includes(tabValue)) order.current.push(tabValue)
    } else {
      refs.current.delete(tabValue)
      order.current = order.current.filter((v) => v !== tabValue)
    }
  }, [])

  const currentValue = value ?? internalValue

  const ctx = React.useMemo(
    () => ({ value: currentValue, onValueChange: handleChange, baseId, register, order, refs }),
    [currentValue, handleChange, baseId, register]
  )

  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("w-full", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Names the tablist for assistive tech, e.g. "Project views". */
  label?: string
}

function TabsList({ className, label, ...props }: TabsListProps) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex w-full items-center border-b border-border overflow-x-auto overflow-y-hidden",
        className
      )}
      {...props}
    />
  )
}

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, ...props }, ref) => {
    const ctx = useTabs()
    const isActive = ctx.value === value

    const setRef = React.useCallback(
      (node: HTMLButtonElement | null) => {
        ctx.register(value, node)
        if (typeof ref === "function") ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
      },
      [ctx, value, ref]
    )

    const step = (delta: number) => {
      const list = ctx.order.current
      if (list.length === 0) return
      const index = list.indexOf(value)
      const next = list[(index + delta + list.length) % list.length]
      ctx.refs.current.get(next)?.focus()
      ctx.onValueChange(next)
    }

    return (
      <button
        ref={setRef}
        role="tab"
        type="button"
        id={`${ctx.baseId}-tab-${value}`}
        aria-selected={isActive}
        aria-controls={`${ctx.baseId}-panel-${value}`}
        tabIndex={isActive ? 0 : -1}
        onClick={() => ctx.onValueChange(value)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") { e.preventDefault(); step(1) }
          else if (e.key === "ArrowLeft") { e.preventDefault(); step(-1) }
          else if (e.key === "Home") {
            e.preventDefault()
            const first = ctx.order.current[0]
            if (first) { ctx.refs.current.get(first)?.focus(); ctx.onValueChange(first) }
          } else if (e.key === "End") {
            e.preventDefault()
            const last = ctx.order.current[ctx.order.current.length - 1]
            if (last) { ctx.refs.current.get(last)?.focus(); ctx.onValueChange(last) }
          }
        }}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap px-4 py-2.5 text-ui font-[510] border-b-2",
          "transition-colors duration-[--duration-fast] ease-standard",
          "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:-outline-offset-2",
          "disabled:pointer-events-none disabled:text-disabled",
          isActive
            ? "border-primary text-foreground"
            : "border-transparent text-subtle-foreground hover:text-muted-foreground",
          className
        )}
        {...props}
      />
    )
  }
)
TabsTrigger.displayName = "TabsTrigger"

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
}

function TabsContent({ className, value, children, ...props }: TabsContentProps) {
  const ctx = useTabs()
  if (ctx.value !== value) return null

  return (
    <div
      role="tabpanel"
      id={`${ctx.baseId}-panel-${value}`}
      aria-labelledby={`${ctx.baseId}-tab-${value}`}
      tabIndex={0}
      className={cn("mt-4 outline-none", className)}
      {...props}
    >
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
