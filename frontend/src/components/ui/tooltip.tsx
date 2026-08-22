import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/* ── Context ─── */
interface TooltipContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  anchorRect: DOMRect | null
  setAnchorRect: (rect: DOMRect | null) => void
}

const TooltipContext = React.createContext<TooltipContextValue>({
  open: false,
  setOpen: () => {},
  anchorRect: null,
  setAnchorRect: () => {},
})

/* ── Tooltip ─── */
function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null)

  return (
    <TooltipContext.Provider value={{ open, setOpen, anchorRect, setAnchorRect }}>
      {children}
    </TooltipContext.Provider>
  )
}

/* ── TooltipTrigger ─── */
interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  asChild?: boolean
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    const { setOpen, setAnchorRect } = React.useContext(TooltipContext)
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    const handleMouseEnter = (e: React.MouseEvent) => {
      timeoutRef.current = setTimeout(() => {
        setAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect())
        setOpen(true)
      }, 300)
    }

    const handleMouseLeave = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      setOpen(false)
    }

    const handleFocus = (e: React.FocusEvent) => {
      setAnchorRect((e.currentTarget as HTMLElement).getBoundingClientRect())
      setOpen(true)
    }

    const handleBlur = () => setOpen(false)

    if (asChild && React.isValidElement(children)) {
            return React.cloneElement(children as any, {
        onMouseEnter: (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
          handleMouseEnter(e)
          const cp = (children as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.props
          if (cp && cp.onMouseEnter) cp.onMouseEnter(e)
        },
        onMouseLeave: (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
          handleMouseLeave()
          const cp = (children as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.props
          if (cp && cp.onMouseLeave) cp.onMouseLeave(e)
        },
        onFocus: (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
          handleFocus(e)
          const cp = (children as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.props
          if (cp && cp.onFocus) cp.onFocus(e)
        },
        onBlur: (e: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ => {
          handleBlur()
          const cp = (children as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.props
          if (cp && cp.onBlur) cp.onBlur(e)
        },
        ref: (node: HTMLElement) => {
          // Merge refs if necessary, for now assume simple assignment
          if (typeof ref === "function") ref(node)
          else if (ref) (ref as React.MutableRefObject<HTMLElement>).current = node
          
          const childRef = (children as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.ref
          if (typeof childRef === "function") childRef(node)
          else if (childRef) { /* eslint-disable-next-line react-hooks/immutability */ childRef.current = node; }
        },
        ...props,
      })
    }

    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      >
        {children}
      </div>
    )
  }
)
TooltipTrigger.displayName = "TooltipTrigger"

/* ── TooltipContent ─── */
type TooltipContentProps = React.HTMLAttributes<HTMLDivElement>

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, anchorRect } = React.useContext(TooltipContext)

    if (!open || !anchorRect) return null

    return createPortal(
      <div
        ref={ref}
        role="tooltip"
        className={cn(
          "fixed z-[var(--z-tooltip)] rounded-[6px] bg-card px-2.5 py-1.5 text-caption font-normal text-muted-foreground ring-1 ring-border shadow-sm animate-in fade-in-0 zoom-in-95 duration-150",
          className
        )}
        style={{
          top: anchorRect.bottom + 4,
          left: anchorRect.left + anchorRect.width / 2,
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
