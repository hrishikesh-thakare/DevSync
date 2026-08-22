import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { useFocusTrap } from "@/hooks/useFocusTrap"

/* ── AlertDialog ─────────────────────────────────────────────────
   Same shell as Dialog, with one behavioural difference: the scrim does NOT
   dismiss. An alertdialog interrupts to ask for a decision, so it requires an
   explicit choice rather than letting a stray click count as "cancel". */

interface AlertDialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const AlertDialogContext = React.createContext<AlertDialogContextValue>({
  open: false,
  onOpenChange: () => {},
  titleId: "",
  descriptionId: "",
})

interface AlertDialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function AlertDialog({ open, onOpenChange, children }: AlertDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(open ?? false)
  const titleId = React.useId()
  const descriptionId = React.useId()

  const isControlled = onOpenChange !== undefined
  const currentOpen = isControlled ? (open ?? false) : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (isControlled) onOpenChange?.(next)
      else setUncontrolledOpen(next)
    },
    [isControlled, onOpenChange]
  )

  const ctx = React.useMemo(
    () => ({ open: currentOpen, onOpenChange: handleOpenChange, titleId, descriptionId }),
    [currentOpen, handleOpenChange, titleId, descriptionId]
  )

  return <AlertDialogContext.Provider value={ctx}>{children}</AlertDialogContext.Provider>
}

const AlertDialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => {
    const { open, onOpenChange, titleId, descriptionId } = React.useContext(AlertDialogContext)
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
          aria-hidden="true"
        />
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 pointer-events-none">
          <div
            ref={(node) => {
              panelRef.current = node
              if (typeof ref === "function") ref(node)
              else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={cn(
              "pointer-events-auto relative w-full max-w-[480px] rounded-[8px] bg-popover p-6 shadow-md",
              "animate-in fade-in-0 zoom-in-96 duration-[--duration-slow]",
              className
            )}
            {...props}
          >
            {children}
          </div>
        </div>
      </>,
      document.body
    )
  }
)
AlertDialogContent.displayName = "AlertDialogContent"

function AlertDialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-2 mb-4", className)} {...props} />
}

const AlertDialogTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, id, ...props }, ref) => {
  const { titleId } = React.useContext(AlertDialogContext)
  return (
    <h2
      ref={ref}
      id={id ?? titleId}
      className={cn("text-h3 font-[590] text-foreground", className)}
      {...props}
    />
  )
})
AlertDialogTitle.displayName = "AlertDialogTitle"

const AlertDialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, id, ...props }, ref) => {
  const { descriptionId } = React.useContext(AlertDialogContext)
  return (
    <p
      ref={ref}
      id={id ?? descriptionId}
      className={cn("text-ui font-normal text-muted-foreground", className)}
      {...props}
    />
  )
})
AlertDialogDescription.displayName = "AlertDialogDescription"

function AlertDialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4", className)}
      {...props}
    />
  )
}

const AlertDialogCancel = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, onClick, ...props }, ref) => {
  const { onOpenChange } = React.useContext(AlertDialogContext)
  return (
    <Button
      ref={ref}
      variant="ghost"
      className={className}
      onClick={(e) => {
        onOpenChange(false)
        onClick?.(e)
      }}
      {...props}
    />
  )
})
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
