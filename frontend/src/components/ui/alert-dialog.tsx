import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Button } from "./button"

/* ── Context ─── */
interface AlertDialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AlertDialogContext = React.createContext<AlertDialogContextValue>({
  open: false,
  onOpenChange: () => {},
})

/* ── AlertDialog (root) ─── */
interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function AlertDialog({ open = false, onOpenChange, children }: AlertDialogProps) {
  if (onOpenChange) {
    return <AlertDialogContext.Provider value={{ open, onOpenChange }}>{children}</AlertDialogContext.Provider>
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isOpen, setIsOpen] = React.useState(open)
  return <AlertDialogContext.Provider value={{ open: isOpen, onOpenChange: setIsOpen }}>{children}</AlertDialogContext.Provider>
}

/* ── AlertDialogContent ─── */
const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange } = React.useContext(AlertDialogContext)
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
        <div
          className="fixed inset-0 bg-[var(--overlay)] transition-opacity"
          onClick={() => onOpenChange(false)}
        />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <div
            ref={ref}
            role="alertdialog"
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
AlertDialogContent.displayName = "AlertDialogContent"

/* ── AlertDialogHeader ─── */
function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col space-y-2 text-center sm:text-left mb-4", className)} {...props} />
}

/* ── AlertDialogTitle ─── */
const AlertDialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn("text-heading font-[590] text-foreground", className)} {...props} />
  )
)
AlertDialogTitle.displayName = "AlertDialogTitle"

/* ── AlertDialogDescription ─── */
const AlertDialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-body font-normal text-muted-foreground", className)} {...props} />
  )
)
AlertDialogDescription.displayName = "AlertDialogDescription"

/* ── AlertDialogFooter ─── */
function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4", className)} {...props} />
}

/* ── AlertDialogCancel ─── */
const AlertDialogCancel = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, onClick, ...props }, ref) => {
    const { onOpenChange } = React.useContext(AlertDialogContext)
    return (
      <Button
        ref={ref}
        variant="ghost"
        className={cn("mt-2 sm:mt-0", className)}
        onClick={(e) => {
          onOpenChange(false)
          onClick?.(e)
        }}
        {...props}
      />
    )
  }
)
AlertDialogCancel.displayName = "AlertDialogCancel"

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
}
