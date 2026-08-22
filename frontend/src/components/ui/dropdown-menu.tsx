import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Button } from "./button"

/* ── DropdownMenu (§8 Dropdowns & Popovers, §18 Keyboard map) ────
   `--bg-surface-raised`, ring shadow, `--shadow-elevated`, 8px radius, items at
   8px 12px.

   Keyboard behaviour is written by hand (§2): Arrow keys move a roving focus
   between items, Home/End jump to the ends, Enter/Space activate, Escape and
   Tab close — and closing returns focus to the trigger, which is §18's
   "Closing any Dialog/Drawer/Dropdown returns focus to the triggering
   element." */

interface DropdownContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  anchorRect: DOMRect | null
  setAnchorRect: (rect: DOMRect | null) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
}

const DropdownContext = React.createContext<DropdownContextValue>({
  open: false,
  setOpen: () => {},
  anchorRect: null,
  setAnchorRect: () => {},
  triggerRef: { current: null },
})

interface DropdownMenuProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function DropdownMenu({ open, onOpenChange, children }: DropdownMenuProps) {
  const [isOpen, setIsOpen] = React.useState(open ?? false)
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null)
  const triggerRef = React.useRef<HTMLElement | null>(null)

  const currentOpen = open !== undefined ? open : isOpen

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (onOpenChange) onOpenChange(next)
      else setIsOpen(next)
      // Focus return: the trigger is what opened this, so it is what should be
      // focused when it closes.
      if (!next) queueMicrotask(() => triggerRef.current?.focus?.())
    },
    [onOpenChange]
  )

  const ctx = React.useMemo(
    () => ({ open: currentOpen, setOpen, anchorRect, setAnchorRect, triggerRef }),
    [currentOpen, setOpen, anchorRect]
  )

  return <DropdownContext.Provider value={ctx}>{children}</DropdownContext.Provider>
}

interface DropdownMenuTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

type TriggerChild = React.ReactElement<Record<string, unknown>> & {
  props: {
    onClick?: (e: React.MouseEvent<HTMLElement>) => void
    onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void
  }
}

const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    const { open, setOpen, setAnchorRect, triggerRef } = React.useContext(DropdownContext)

    const captureRef = (node: HTMLElement | null) => {
      triggerRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node
    }

    const handleClick = (e: React.MouseEvent<HTMLElement>) => {
      setAnchorRect(e.currentTarget.getBoundingClientRect())
      setOpen(!open)
    }

    // ArrowDown opens the menu from the keyboard, matching the WAI-ARIA menu
    // button pattern.
    const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
      if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
        e.preventDefault()
        setAnchorRect(e.currentTarget.getBoundingClientRect())
        setOpen(true)
      }
    }

    if (asChild && React.isValidElement(children)) {
      const child = children as TriggerChild
      const cloned: Record<string, unknown> = {
        ...props,
        onClick: (e: React.MouseEvent<HTMLElement>) => {
          handleClick(e)
          child.props.onClick?.(e)
        },
        onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
          handleKeyDown(e)
          child.props.onKeyDown?.(e)
        },
        ref: captureRef,
        "aria-expanded": open,
        "aria-haspopup": "menu",
      }
      return React.cloneElement(child, cloned)
    }

    return (
      <Button
        ref={captureRef as React.Ref<HTMLButtonElement>}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
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

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end" | "center"
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "end", children, ...props }, ref) => {
    const { open, setOpen, anchorRect, setAnchorRect, triggerRef } =
      React.useContext(DropdownContext)
    const menuRef = React.useRef<HTMLDivElement | null>(null)

    const items = React.useCallback(
      () =>
        menuRef.current
          ? Array.from(
              menuRef.current.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')
            )
          : [],
      []
    )

    // Move focus onto the first item when the menu opens.
    React.useEffect(() => {
      if (!open) return
      const first = items()[0]
      first?.focus()
    }, [open, items])

    // Keep the panel anchored while the page moves underneath it.
    React.useEffect(() => {
      if (!open) return
      const reposition = () => {
        if (triggerRef.current) setAnchorRect(triggerRef.current.getBoundingClientRect())
      }
      window.addEventListener("scroll", reposition, true)
      window.addEventListener("resize", reposition)
      return () => {
        window.removeEventListener("scroll", reposition, true)
        window.removeEventListener("resize", reposition)
      }
    }, [open, setAnchorRect, triggerRef])

    React.useEffect(() => {
      if (!open) return

      const handleKeyDown = (e: KeyboardEvent) => {
        const list = items()
        const index = list.indexOf(document.activeElement as HTMLElement)

        switch (e.key) {
          case "Escape":
            e.preventDefault()
            setOpen(false)
            break
          case "Tab":
            setOpen(false)
            break
          case "ArrowDown":
            e.preventDefault()
            list[(index + 1) % list.length]?.focus()
            break
          case "ArrowUp":
            e.preventDefault()
            list[(index - 1 + list.length) % list.length]?.focus()
            break
          case "Home":
            e.preventDefault()
            list[0]?.focus()
            break
          case "End":
            e.preventDefault()
            list[list.length - 1]?.focus()
            break
        }
      }

      const handlePointerDown = (e: MouseEvent) => {
        const target = e.target as Node
        if (menuRef.current?.contains(target)) return
        if (triggerRef.current?.contains(target)) return
        setOpen(false)
      }

      document.addEventListener("keydown", handleKeyDown)
      // `mousedown` rather than `click`, so the menu closes before the click
      // lands and there is no need for a setTimeout to dodge the opening click.
      document.addEventListener("mousedown", handlePointerDown)

      return () => {
        document.removeEventListener("keydown", handleKeyDown)
        document.removeEventListener("mousedown", handlePointerDown)
      }
    }, [open, setOpen, items, triggerRef])

    if (!open || !anchorRect) return null

    let left = anchorRect.left
    if (align === "end") left = anchorRect.right
    else if (align === "center") left = anchorRect.left + anchorRect.width / 2

    return createPortal(
      <div
        ref={(node) => {
          menuRef.current = node
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
        }}
        role="menu"
        className={cn(
          "fixed z-[var(--z-dropdown)] min-w-[180px] rounded-[8px] bg-popover py-1 shadow-md ring-1 ring-border",
          "animate-in fade-in-0 slide-in-from-top-1 duration-[--duration-base]",
          className
        )}
        style={{
          top: anchorRect.bottom + 4,
          left,
          transform:
            align === "end" ? "translateX(-100%)" : align === "center" ? "translateX(-50%)" : undefined,
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

interface DropdownMenuItemProps extends React.HTMLAttributes<HTMLDivElement> {
  onSelect?: (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => void
  disabled?: boolean
  variant?: "default" | "destructive"
  /** Renders the §8 "Item active" state: `--primary-muted` + `--text-primary`. */
  active?: boolean
}

const DropdownMenuItem = React.forwardRef<HTMLDivElement, DropdownMenuItemProps>(
  ({ className, variant = "default", active = false, onSelect, disabled, children, ...props }, ref) => {
    const { setOpen } = React.useContext(DropdownContext)

    const activate = (e: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      onSelect?.(e)
      setOpen(false)
    }

    return (
      <div
        ref={ref}
        role="menuitem"
        tabIndex={-1}
        aria-disabled={disabled || undefined}
        onClick={activate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            activate(e)
          }
        }}
        className={cn(
          "relative flex cursor-default select-none items-center gap-2 rounded-[6px] mx-1 px-3 py-2 text-ui font-normal",
          "outline-none transition-colors duration-[--duration-fast] ease-standard",
          "focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:-outline-offset-2",
          disabled && "pointer-events-none text-disabled",
          variant === "destructive"
            ? "text-danger-on-muted hover:bg-danger-muted focus:bg-danger-muted"
            : active
              ? "bg-primary-muted text-foreground"
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

/** Eyebrow-style group heading — §8 Sidebar / Command Palette: 11px, 510, +0.2px. */
const DropdownMenuLabel = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-3 py-1.5 text-micro font-[510] text-subtle-foreground", className)}
      {...props}
    />
  )
)
DropdownMenuLabel.displayName = "DropdownMenuLabel"

const DropdownMenuSeparator = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} role="none" className={cn("my-1 h-px bg-border", className)} {...props} />
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
