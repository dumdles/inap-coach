import * as React from "react"
import { cn } from "@/lib/utils"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
    variant?: 'info' | 'success' | 'warning' | 'danger'
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
    ({ className, variant = 'info', children, ...props }, ref) => {
        const variantStyles = {
            info: 'bg-primary/10 border-primary/30 text-primary',
            success: 'bg-success-light border-success text-success-dark',
            warning: 'bg-warning-light border-warning text-warning-dark',
            danger: 'bg-danger-light border-danger text-danger-dark',
        }

        return (
            <div
                ref={ref}
                className={cn(
                    'rounded-lg border-1 p-4 text-sm',
                    variantStyles[variant],
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)

Alert.displayName = "Alert"