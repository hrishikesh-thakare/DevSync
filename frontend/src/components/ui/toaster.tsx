
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"
import { useToastStore, type Toast } from "@/store/toastStore"

/* ── Toaster ───────────────────────────────────────────────────── */
/* Hand-built replacement for Sonner. Reads from useToastStore and
   renders toasts in the bottom-right corner per §8. */

const rampColors: Record<string, string> = {
  success: "bg-[var(--success)]",
  error: "bg-[var(--danger)]",
  info: "bg-[var(--primary)]",
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={cn(
        "relative flex items-start gap-3 w-[356px] rounded-[8px] bg-card p-4 ring-1 ring-border shadow-sm transition-colors duration-[180ms] ease-[cubic-bezier(0.4,0,0.2,1)]",
        "shadow-md"
      )}
    >
      {/* Status accent bar */}
      <span
        className={cn(
          "absolute left-0 top-2 bottom-2 w-[3px] rounded-full",
          rampColors[toast.type] || rampColors.info
        )}
      />

      <div className="flex-1 min-w-0 pl-2">
        <p className="text-body font-[510] text-foreground leading-[1.5]">
          {toast.message}
        </p>
      </div>

      <button
        onClick={() => removeToast(toast.id)}
        className="shrink-0 text-subtle-foreground hover:text-foreground transition-colors duration-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}

interface ToasterProps {
  richColors?: boolean
  closeButton?: boolean
  position?: string
}

function Toaster(_props: ToasterProps) {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return createPortal(
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="fixed bottom-4 right-4 flex flex-col gap-2"
      style={{ zIndex: 9999 }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  )
}

export { Toaster }
