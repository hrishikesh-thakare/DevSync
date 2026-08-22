import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useFocusTrap } from "@/hooks/useFocusTrap"

/* ── Dialog (§8 Dialogs & Modals) ────────────────────────────────
   Panel on `--bg-surface-raised` with `--shadow-elevated`, 8px radius, 480px
   default / 640px content-heavy. Scrim at `--z-overlay`, panel at `--z-modal`
   — never `--z-toast`, which §5 reserves so alerts always sit above modals.

   Focus trap, initial focus, scroll lock and focus return are all hand-built:
   no primitives library is installed, and §2 says to build that behaviour
   explicitly rather than assume it. */

interface DialogContextValue {
  open: boolean
  onOpenChange: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  onOpenChange: () => {},
  titleId: "",
  descriptionId: "",
})

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  // Hooks run unconditionally — the previous version called `useState` only on
  // the uncontrolled branch, which breaks the Rules of Hooks the moment a
  // caller switches between controlled and uncontrolled.
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

  return <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>
}

interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** §16: 480px default, 640px for content-heavy dialogs. */
  wide?: boolean
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, wide = false, children, ...props }, ref) => {
    const { open, onOpenChange, titleId, descriptionId } = React.useContext(DialogContext)
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
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center p-4 pointer-events-none">
          <div
            ref={(node) => {
              panelRef.current = node
              if (typeof ref === "function") ref(node)
              else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className={cn(
              "pointer-events-auto relative w-full rounded-[8px] bg-popover p-6 shadow-md",
              "animate-in fade-in-0 zoom-in-96 duration-[--duration-slow]",
              wide ? "max-w-[640px]" : "max-w-[480px]",
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
DialogContent.displayName = "DialogContent"

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 mb-4", className)} {...props} />
}

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, id, ...props }, ref) => {
    const { titleId } = React.useContext(DialogContext)
    return (
      <h2
        ref={ref}
        id={id ?? titleId}
        className={cn("text-h3 font-[590] text-foreground", className)}
        {...props}
      />
    )
  }
)
DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, id, ...props }, ref) => {
  const { descriptionId } = React.useContext(DialogContext)
  return (
    <p
      ref={ref}
      id={id ?? descriptionId}
      className={cn("text-ui font-normal text-muted-foreground", className)}
      {...props}
    />
  )
})
DialogDescription.displayName = "DialogDescription"

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end mt-4", className)}
      {...props}
    />
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter }
