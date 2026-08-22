import { createPortal } from "react-dom"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useToastStore, type Toast } from "@/store/toastStore"

/* ── Toaster (§8 Toasts) ─────────────────────────────────────────
   Bottom-right at 16px inset, `--bg-surface-raised`, ring shadow,
   `--shadow-elevated`, 8px radius, 3px status bar in the ramp colour.

   Live regions are not optional here: toasts announce asynchronous results, so
   §8 asks for `role="status"` on success/info and `role="alert"` on errors. The
   two are kept in SEPARATE containers because a `role="alert"` nested inside an
   `aria-live="polite"` region is announced politely — the outer region wins.

   §5 reserves `--z-toast` (9999) so an alert always sits above modals, overlays
   and tooltips. It is referenced as a token, never as a bare number. */

const rampBar: Record<Toast["type"], string> = {
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-danger",
  info: "bg-primary",
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 w-[356px] max-w-[calc(100vw-2rem)] overflow-hidden",
        "rounded-[8px] bg-popover p-4 pl-5 ring-1 ring-border shadow-md",
        "animate-in fade-in-0 slide-in-from-bottom-1 duration-[--duration-base]"
      )}
    >
      <span
        className={cn("absolute left-0 top-2 bottom-2 w-[3px] rounded-full", rampBar[toast.type])}
        aria-hidden="true"
      />

      <div className="flex-1 min-w-0">
        <p className="text-ui font-[510] text-foreground">{toast.message}</p>
        {toast.description && (
          <p className="mt-1 text-button font-normal text-muted-foreground">{toast.description}</p>
        )}
      </div>

      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 rounded-[4px] text-subtle-foreground transition-colors duration-[--duration-fast] ease-standard hover:text-foreground focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
        aria-label={`Dismiss: ${toast.message}`}
      >
        <X className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  )
}

function Toaster() {
  const toasts = useToastStore((s) => s.toasts)

  const alerts = toasts.filter((t) => t.type === "error")
  const statuses = toasts.filter((t) => t.type !== "error")

  if (toasts.length === 0) return null

  // Each region is rendered only when it has something in it. An always-present
  // empty `role="alert"` would be a second alert on every page in the app,
  // which makes any "is an error showing?" query ambiguous for both assistive
  // tech and tests.
  return createPortal(
    <div className="fixed bottom-4 right-4 z-[var(--z-toast)] flex flex-col gap-2">
      {alerts.length > 0 && (
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          {alerts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      )}
      {statuses.length > 0 && (
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          {statuses.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}

export { Toaster }
