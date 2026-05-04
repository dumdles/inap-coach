import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> { }

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-gray-300",
        "bg-white px-3 py-2",
        "text-sm placeholder:text-gray-400",
        "transition-colors",
        "hover:border-gray-400",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/12",
        "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }