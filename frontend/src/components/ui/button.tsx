import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Ghost-first (§8 Buttons): the default is transparent, and colour is earned.
 * Variants are a plain object map merged with `cn()` — there is no CVA in this
 * project and none is wanted (§2).
 *
 * The destructive variant takes `--danger-on-muted` (#F58787), not the base
 * `--danger`: §8 measures #EB5757 on the red tint at 4.66:1, dropping to 3.99:1
 * on the 0.25 hover tint. The lightened value holds at 6.71:1.
 */
const buttonVariants = {
  ghost: "bg-transparent text-subtle-foreground hover:bg-hover hover:text-foreground",
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
  secondary: "bg-card text-foreground border border-input hover:bg-hover",
  destructive: "bg-danger-muted text-danger-on-muted hover:bg-danger-muted-hover",
}

const buttonSizes = {
  default: "h-[32px] px-3",
  sm: "h-[28px] px-2",
  lg: "h-[36px] px-4",
  icon: "h-[32px] w-[32px] p-0",
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants
  size?: keyof typeof buttonSizes
  asChild?: boolean
  /**
   * Swaps the leading icon for a spinner and disables the control, keeping the
   * label in place (§8 Loading: "Button submitting | 14px inline spinner
   * replacing the icon; label stays").
   */
  loading?: boolean
}

type ChildWithClassName = React.ReactElement<{ className?: string }>

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "ghost",
      size = "default",
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const classes = cn(
      "inline-flex items-center justify-center gap-1.5 rounded-[6px] font-sans text-button font-medium whitespace-nowrap",
      "transition-colors duration-[--duration-fast] ease-standard",
      "disabled:pointer-events-none disabled:text-disabled disabled:bg-transparent",
      "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
      buttonVariants[variant],
      buttonSizes[size],
      className
    )

    if (asChild && React.isValidElement(children)) {
      const child = children as ChildWithClassName
      const cloned: Record<string, unknown> = {
        className: cn(classes, child.props.className),
        ref,
      }
      return React.cloneElement(child, cloned)
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
