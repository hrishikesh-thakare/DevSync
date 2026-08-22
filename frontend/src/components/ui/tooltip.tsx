import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/* ── Tooltip (§8 Tooltips) ───────────────────────────────────────
   `--bg-surface-raised`, ring shadow, 6px radius, 6px 10px padding, 12px
   `--text-secondary`.

   §15: a tooltip is NOT a substitute for `aria-label` on an icon-only button.
   It supplements — so the trigger gets `aria-describedby`, and the content is
   removed from the tree entirely when closed. Escape dismisses it (WCAG 1.4.13)
   and the panel flips above the trigger when it would overflow the viewport. */

interface TooltipContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  anchorRect: DOMRect | null
  setAnchorRect: (rect: DOMRect | null) => void
  contentId: string
}

const TooltipContext = React.createContext<TooltipContextValue>({
  open: false,
  setOpen: () => {},
  anchorRect: null,
  setAnchorRect: () => {},
  contentId: "",
})

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null)
  const contentId = React.useId()

  const ctx = React.useMemo(
    () => ({ open, setOpen, anchorRect, setAnchorRect, contentId }),
    [open, anchorRect, contentId]
  )

  return <TooltipContext.Provider value={ctx}>{children}</TooltipContext.Provider>
}

interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
  asChild?: boolean
}

type TriggerChild = React.ReactElement<Record<string, unknown>> & {
  props: {
    onMouseEnter?: (e: React.MouseEvent) => void
    onMouseLeave?: (e: React.MouseEvent) => void
    onFocus?: (e: React.FocusEvent) => void
    onBlur?: (e: React.FocusEvent) => void
  }
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    const { open, setOpen, setAnchorRect, contentId } = React.useContext(TooltipContext)
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(() => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }, [])

    const show = (el: HTMLElement, delay: number) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      const rect = el.getBoundingClientRect()
      timeoutRef.current = setTimeout(() => {
        setAnchorRect(rect)
        setOpen(true)
      }, delay)
    }

    const hide = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setOpen(false)
    }

    // Escape dismisses without moving focus — WCAG 1.4.13 Content on Hover.
    React.useEffect(() => {
      if (!open) return
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false)
      }
      document.addEventListener("keydown", onKey)
      return () => document.removeEventListener("keydown", onKey)
    }, [open, setOpen])

    const handlers = {
      onMouseEnter: (e: React.MouseEvent) => show(e.currentTarget as HTMLElement, 300),
      onMouseLeave: hide,
      onFocus: (e: React.FocusEvent) => show(e.currentTarget as HTMLElement, 0),
      onBlur: hide,
    }

    if (asChild && React.isValidElement(children)) {
      const child = children as TriggerChild
      const cloned: Record<string, unknown> = {
        ...props,
        onMouseEnter: (e: React.MouseEvent) => {
          handlers.onMouseEnter(e)
          child.props.onMouseEnter?.(e)
        },
        onMouseLeave: (e: React.MouseEvent) => {
          handlers.onMouseLeave()
          child.props.onMouseLeave?.(e)
        },
        onFocus: (e: React.FocusEvent) => {
          handlers.onFocus(e)
          child.props.onFocus?.(e)
        },
        onBlur: (e: React.FocusEvent) => {
          handlers.onBlur()
          child.props.onBlur?.(e)
        },
        ref,
        "aria-describedby": open ? contentId : undefined,
      }
      return React.cloneElement(child, cloned)
    }

    return (
      <span
        ref={ref as React.Ref<HTMLSpanElement>}
        className="inline-flex"
        aria-describedby={open ? contentId : undefined}
        {...handlers}
        {...props}
      >
        {children}
      </span>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

type TooltipContentProps = React.HTMLAttributes<HTMLDivElement>

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, anchorRect, contentId } = React.useContext(TooltipContext)

    if (!open || !anchorRect) return null

    // Flip above the trigger when there is not enough room below.
    const flip = anchorRect.bottom + 44 > window.innerHeight

    return createPortal(
      <div
        ref={ref}
        id={contentId}
        role="tooltip"
        className={cn(
          "pointer-events-none fixed z-[var(--z-tooltip)] max-w-[280px] rounded-[6px] bg-popover px-2.5 py-1.5",
          "text-caption font-normal text-muted-foreground ring-1 ring-border shadow-sm",
          "animate-in fade-in-0 duration-[--duration-fast]",
          className
        )}
        style={{
          top: flip ? undefined : anchorRect.bottom + 4,
          bottom: flip ? window.innerHeight - anchorRect.top + 4 : undefined,
          left: Math.min(
            Math.max(8, anchorRect.left + anchorRect.width / 2),
            window.innerWidth - 8
          ),
          transform: "translateX(-50%)",
        }}
        {...props}
      >
        {children}
      </div>,
      document.body
    )
  }
)
TooltipContent.displayName = "TooltipContent"

export { Tooltip, TooltipTrigger, TooltipContent }
