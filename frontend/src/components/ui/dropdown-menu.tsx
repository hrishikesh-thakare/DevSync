import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Button } from "./button"

/* ── Context ─── */
interface DropdownContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  anchorRect: DOMRect | null
  setAnchorRect: (rect: DOMRect | null) => void
}

const DropdownContext = React.createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
  anchorRect: null,
  setAnchorRect: () => {},
})

/* ── DropdownMenu ─── */
interface DropdownMenuProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function DropdownMenu({ open, onOpenChange, children }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(open ?? false)
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null)

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) onOpenChange(newOpen)
    else setIsOpen(newOpen)
  }

  const currentOpen = open !== undefined ? open : isOpen

  return (
    <DropdownContext.Provider value={{ open: currentOpen, setOpen: handleOpenChange, anchorRect, setAnchorRect }}>
      {children}
    </DropdownContext.Provider>
  )
}

/* ── DropdownMenuTrigger ─── */
interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    const { open, setOpen, setAnchorRect } = React.useContext(DropdownContext)

    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
      setAnchorRect(e.currentTarget.getBoundingClientRect())
      setOpen(!open)
    }

    if (asChild && React.isValidElement(children)) {
            return React.cloneElement(children as any, {
        onClick: (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
          handleClick(e)
          const childProps = (children as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.props
          if (childProps && childProps.onClick) childProps.onClick(e)
        },
        ref: (node: HTMLElement) => {
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLElement>).current = node
          
          const childRef = (children as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.ref
          if (typeof childRef === "function") childRef(node)
          else if (childRef) childRef.current = node
        },
        "aria-expanded": open,
        "aria-haspopup": "menu",
        ...props,
      })
    }

    return (
      <Button
        ref={ref as React.Ref<HTMLButtonElement>}
        onClick={handleClick}
        aria-expanded={open}
        aria-haspopup="menu"
        {...props}
      >
        {children}
      </Button>
    )
  }
)
DropdownMenuTrigger.displayName = "DropdownMenuTrigger"

/* ── DropdownMenuContent ─── */
interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end" | "center"
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "end", children, ...props }, ref) => {
    const { open, setOpen, anchorRect } = React.useContext(DropdownContext)

    React.useEffect(() => {
      if (!open) return
      
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false)
      }
      
      const handleClickOutside = () => {
        // Simple outside click detection
        setOpen(false)
      }
      
      document.addEventListener("keydown", handleKeyDown)
      // Small timeout to prevent immediate close on trigger click
      setTimeout(() => document.addEventListener("click", handleClickOutside), 0)
      
      return () => {
        document.removeEventListener("keydown", handleKeyDown)
        document.removeEventListener("click", handleClickOutside)
      }
    }, [open, setOpen])

    if (!open || !anchorRect) return null

    let left = anchorRect.left
    if (align === "end") left = anchorRect.right
    else if (align === "center") left = anchorRect.left + anchorRect.width / 2

    return createPortal(
      <div
        ref={ref}
        role="menu"
        onClick={(e) => e.stopPropagation()} // Prevent outside click from triggering
        className={cn(
          "fixed z-[var(--z-dropdown)] min-w-[180px] rounded-[8px] bg-card py-1 shadow-md animate-in fade-in-0 zoom-in-95 duration-100",
          className
        )}
        style={{
          top: anchorRect.bottom + 4,
          left,
          transform: align === "end" ? "translateX(-100%)" : align === "center" ? "translateX(-50%)" : undefined,
        }}
        {...props}
      >
        {children}
      </div>,
      document.body
    )
  }
)
DropdownMenuContent.displayName = "DropdownMenuContent"

/* ── DropdownMenuItem ─── */
interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  onSelect?: (e: React.MouseEvent<HTMLDivElement>) => void
  disabled?: boolean
  variant?: "default" | "destructive"
}

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, variant = "default", onSelect, disabled, children, ...props }, ref) => {
    const { setOpen } = React.useContext(DropdownContext)
    
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return
      onSelect?.(e)
      setOpen(false)
    }

    return (
      <div
        ref={ref}
        role="menuitem"
        aria-disabled={disabled}
        onClick={handleClick}
        className={cn(
          "relative flex cursor-default select-none items-center rounded-sm px-3 py-2 text-body font-normal outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          variant === "destructive"
            ? "text-[var(--danger)] hover:bg-[var(--danger-muted)] focus:bg-[var(--danger-muted)]"
            : "text-muted-foreground hover:bg-hover hover:text-foreground focus:bg-hover focus:text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
DropdownMenuItem.displayName = "DropdownMenuItem"

/* ── DropdownMenuLabel ─── */
const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-3 py-1.5 text-micro font-[510] tracking-[0.2px] text-subtle-foreground", className)}
      {...props}
    />
  )
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

/* ── DropdownMenuSeparator ─── */
const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
  )
)
DropdownMenuSeparator.displayName = "DropdownMenuSeparator"

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
}
