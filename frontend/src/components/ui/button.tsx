import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = {
  ghost: "bg-transparent text-subtle-foreground hover:bg-hover hover:text-foreground border border-transparent",
  primary: "bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent",
  secondary: "bg-card text-foreground border border-input",
  destructive: "bg-destructive/15 text-destructive hover:bg-destructive/40 border border-transparent",
}

const buttonSizes = {
  default: "h-[32px] px-3",
  sm: "h-[28px] px-2",
  lg: "h-[36px] px-4",
  icon: "h-[32px] w-[32px] p-0"
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof buttonVariants
  size?: keyof typeof buttonSizes
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", size = "default", asChild = false, ...props }, ref) => {
    const classes = cn(
      "inline-flex items-center justify-center rounded-[6px] font-sans text-ui font-medium whitespace-nowrap transition-colors duration-100 ease-in-out",
      "disabled:pointer-events-none disabled:text-disabled disabled:bg-transparent",
      "outline-none focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
      buttonVariants[variant],
      buttonSizes[size],
      className
    )

    if (asChild && React.isValidElement(props.children)) {
      return React.cloneElement(props.children as any, {
        className: cn(classes, (props.children as any) /* eslint-disable-line @typescript-eslint/no-explicit-any */.props.className),
        ref: ref as any,
      })
    }

    return (
      <button
        ref={ref}
        className={classes}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
