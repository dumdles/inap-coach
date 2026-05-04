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
        "text-sm text-gray-800 placeholder:text-gray-400",
        "transition-colors",
        "hover:border-gray-400",
        "focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/12",
        "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300",
        "file:border-0 file:bg-transparent file:text-sm file:font-medium",
        // dark mode
        "dark:bg-[#0D1F3C] dark:border-[#344563] dark:text-gray-100",
        "dark:placeholder:text-[#6B778C]",
        "dark:hover:border-[#505F79]",
        "dark:focus:border-primary dark:focus:ring-primary/20",
        "dark:disabled:bg-[#172B4D] dark:disabled:text-[#6B778C]",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }