import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

/* ── Context ─── */
interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
})

/* ── Dialog (root) ─── */
interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open = false, onOpenChange, children }: DialogProps) {
  // If controlled
  if (onOpenChange) {
    return <DialogContext.Provider value={{ open, onOpenChange }}>{children}</DialogContext.Provider>
  }

  // Uncontrolled (fallback, though most usages should be controlled)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isOpen, setIsOpen] = React.useState(open)
  return <DialogContext.Provider value={{ open: isOpen, onOpenChange: setIsOpen }}>{children}</DialogContext.Provider>
}

/* ── DialogContent ─── */
interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(DialogContext)
    const prevFocusRef = React.useRef<HTMLElement | null>(null)
    React.useEffect(() => { if (open) prevFocusRef.current = document.activeElement as HTMLElement; else prevFocusRef.current?.focus() }, [open])

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
      <div className="fixed inset-0 z-[var(--z-toast)]">
        {/* Overlay */}
        <div
          className="fixed inset-0 bg-[var(--overlay)] transition-opacity"
          onClick={() => onOpenChange(false)}
        />
        {/* Panel Container */}
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            className={cn(
              "relative w-full max-w-lg rounded-[8px] bg-card p-6 shadow-md animate-in fade-in-0 zoom-in-95 duration-200",
              className
            )}
            {...props}
          >
            {children}
          </div>
        </div>
      </div>,
      document.body
    )
  }
)
DialogContent.displayName = "DialogContent"

/* ── DialogHeader ─── */
function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left mb-4", className)} {...props} />
}

/* ── DialogTitle ─── */
const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-heading font-[590] leading-none tracking-tight text-foreground", className)} {...props} />
  )
)
DialogTitle.displayName = "DialogTitle"

/* ── DialogDescription ─── */
const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-body font-normal text-muted-foreground", className)} {...props} />
  )
)
DialogDescription.displayName = "DialogDescription"

/* ── DialogFooter ─── */
function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4", className)} {...props} />
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
