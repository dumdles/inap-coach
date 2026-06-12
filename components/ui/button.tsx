import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-transparent bg-clip-padding text-sm font-semibold whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.97] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary/30",
        primary:
          "bg-primary text-white hover:bg-primary/90 focus-visible:ring-primary/30",
        outline:
          "border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring/30",
        secondary:
          "bg-muted text-foreground hover:bg-muted/80 focus-visible:ring-ring/30",
        ghost:
          "text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/30",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        danger:
          "bg-danger text-white hover:bg-danger/90 focus-visible:ring-danger/30",
        success:
          "bg-success text-white hover:bg-success/90 focus-visible:ring-success/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm:   "h-8 px-3 text-[12px]",
        md:   "h-10 px-4 text-[13px]",
        lg:   "h-11 px-5 text-sm",
        xl:   "h-12 px-7 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
)

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  isLoading = false,
  isSuccess = false,
  prefixIcon,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    isLoading?: boolean
    isSuccess?: boolean
    /** Icon rendered before the label — hidden when isLoading or isSuccess is active */
    prefixIcon?: React.ReactNode
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <svg
          className="animate-spin size-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {isSuccess && !isLoading && (
        <svg
          className="size-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {/* prefixIcon is suppressed with asChild — Slot.Root must receive exactly one child */}
      {!isLoading && !isSuccess && !asChild && prefixIcon}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
