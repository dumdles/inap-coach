import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 active:scale-[0.97] active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary dark:bg-primary-dark text-white hover:bg-primary-dark focus-visible:ring-primary/30 border-primary",
        primary:
          "bg-primary dark:bg-primary-dark text-white hover:bg-primary-dark dark:hover:bg-primary-light focus-visible:ring-primary/30 ",
        outline:
          "border border-gray-300 dark:border-gray-600 text-primary dark:text-gray-300 bg-none hover:bg-primary-light hover:border-primary focus-visible:ring-primary/30",
        secondary:
          "bg-primary-light text-primary hover:bg-primary hover:text-white border border-primary-light focus-visible:ring-primary/30",
        ghost:
          "text-gray-600 hover:bg-gray-100 focus-visible:ring-primary/30",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20",
        danger:
          "bg-danger text-white hover:bg-danger-dark focus-visible:ring-danger/30",
        success:
          "bg-success text-white hover:bg-success-dark focus-visible:ring-success/30",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm:   "h-8 px-3 text-xs",
        md:   "h-10 px-4 text-sm",
        lg:   "h-11 px-5 text-base",
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
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    isLoading?: boolean
    isSuccess?: boolean
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
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
