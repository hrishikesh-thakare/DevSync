import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { ChevronDown, Check } from "lucide-react"

/* ── Context ─── */
interface SelectContextValue {
  value: string | undefined
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  anchorRect: DOMRect | null
  setAnchorRect: (rect: DOMRect | null) => void
  
  disabled?: boolean
}

const SelectContext = React.createContext<SelectContextValue>({
  value: undefined,
  onValueChange: () => {},
  open: false,
  setOpen: () => {},
  anchorRect: null,
  setAnchorRect: () => {},
 
  disabled: false,
})

/* ── Select ─── */
interface SelectProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  disabled?: boolean
  children: React.ReactNode
}

function Select({ value, defaultValue, onValueChange, disabled, children }: SelectProps) {
  const [internalValue, setInternalValue] = React.useState(value ?? defaultValue)
  const [open, setOpen] = React.useState(false)
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null)
  

  const handleValueChange = (newValue: string) => {
    if (value === undefined) setInternalValue(newValue)
    onValueChange?.(newValue)
    setOpen(false)
  }

  const currentValue = value !== undefined ? value : internalValue

  return (
    <SelectContext.Provider value={{ value: currentValue, onValueChange: handleValueChange, open, setOpen, anchorRect, setAnchorRect, disabled }}>
      {children}
    </SelectContext.Provider>
  )
}

/* ── SelectTrigger ─── */
type SelectTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>

const SelectTrigger = React.forwardRef<HTMLButtonElement, SelectTriggerProps>(
  ({ className, disabled, children, ...props }, ref) => {
    const { open, setOpen, setAnchorRect, disabled: contextDisabled } = React.useContext(SelectContext)
    const localRef = React.useRef<HTMLButtonElement>(null)
    const isDisabled = disabled ?? contextDisabled

    // Merge refs
    const triggerRef = (node: HTMLButtonElement) => {
      localRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement>).current = node
    }

    const handleClick = () => {
      if (isDisabled) return
      if (localRef.current) {
        setAnchorRect(localRef.current.getBoundingClientRect())
        // triggerWidth logic can be handled in effect if needed, but we can just use anchorRect.width in content
      }
      setOpen(!open)
    }

    return (
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={isDisabled}
        onClick={handleClick}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-[6px] border border-input bg-muted px-3 py-2 text-body text-foreground placeholder:text-subtle-foreground outline-none transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 opacity-50 shrink-0 text-subtle-foreground" strokeWidth={1.75} />
      </button>
    )
  }
)
SelectTrigger.displayName = "SelectTrigger"

/* ── SelectValue ─── */
interface SelectValueProps extends React.HTMLAttributes<HTMLSpanElement> {
  placeholder?: string
}

const SelectValue = React.forwardRef<HTMLSpanElement, SelectValueProps>(
  ({ className, placeholder, ...props }, ref) => {
    const { value } = React.useContext(SelectContext)
    return (
      <span ref={ref} className={cn("truncate", !value && "text-subtle-foreground", className)} {...props}>
        {value ? value : placeholder}
      </span>
    )
  }
)
SelectValue.displayName = "SelectValue"

/* ── SelectContent ─── */
type SelectContentProps = React.HTMLAttributes<HTMLDivElement>

const SelectContent = React.forwardRef<HTMLDivElement, SelectContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, setOpen, anchorRect } = React.useContext(SelectContext)

    React.useEffect(() => {
      if (!open) return
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false)
      }
      
      const handleClickOutside = () => {
        setOpen(false)
      }
      
      document.addEventListener("keydown", handleKeyDown)
      setTimeout(() => document.addEventListener("click", handleClickOutside), 0)
      
      return () => {
        document.removeEventListener("keydown", handleKeyDown)
        document.removeEventListener("click", handleClickOutside)
      }
    }, [open, setOpen])

    if (!open || !anchorRect) return null

    return createPortal(
      <div
        ref={ref}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "fixed z-[var(--z-dropdown)] max-h-96 min-w-[8rem] overflow-hidden rounded-[8px] bg-card shadow-md animate-in fade-in-0 zoom-in-95 duration-100",
          className
        )}
        style={{
          top: anchorRect.bottom + 4,
          left: anchorRect.left,
          width: anchorRect.width,
        }}
        {...props}
      >
        <div className="w-full p-1 max-h-96 overflow-y-auto">
          {children}
        </div>
      </div>,
      document.body
    )
  }
)
SelectContent.displayName = "SelectContent"

/* ── SelectItem ─── */
interface SelectItemProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string
  disabled?: boolean
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  ({ className, value, disabled, children, ...props }, ref) => {
    const { value: selectedValue, onValueChange } = React.useContext(SelectContext)
    const isSelected = selectedValue === value

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) onValueChange(value)
        }}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-body text-muted-foreground outline-none hover:bg-hover hover:text-foreground focus:bg-hover focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          isSelected && "bg-[var(--primary-muted)] text-[var(--primary)] font-[510]",
          className
        )}
        {...props}
      >
        <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
          {isSelected && <Check className="h-4 w-4" strokeWidth={1.75} />}
        </span>
        {children}
      </div>
    )
  }
)
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
