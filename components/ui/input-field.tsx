// components/ui/input-field.tsx
import * as React from "react"
import { Input } from "./input"

interface InputFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
    label?: string
    error?: string
    hint?: string
    required?: boolean
    prefix?: React.ReactNode
    suffix?: React.ReactNode
}

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
    ({ label, error, hint, required, prefix, suffix, ...props }, ref) => {
        const id = props.id || `input-${Math.random()}`

        return (
            <div className="flex flex-col gap-2">
                {label && (
                    <label
                        htmlFor={id}
                        className="text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                        {label}
                        {required && <span className="text-danger ml-1">*</span>}
                    </label>
                )}

                <div className="relative flex items-center">
                    {prefix && (
                        <div className="absolute left-3 text-gray-500 dark:text-gray-400 pointer-events-none">
                            {prefix}
                        </div>
                    )}
                    <Input
                        id={id}
                        ref={ref}
                        className={`
              ${prefix ? 'pl-9' : ''}
              ${suffix ? 'pr-9' : ''}
              ${error ? 'border-danger focus:ring-danger/12' : ''}
            `}
                        {...props}
                    />
                    {suffix && (
                        <div className="absolute right-3 text-gray-500 dark:text-gray-400 pointer-events-none">
                            {suffix}
                        </div>
                    )}
                </div>

                {error && (
                    <p className="text-xs text-danger">{error}</p>
                )}

                {hint && !error && (
                    <p className="text-xs text-gray-400">{hint}</p>
                )}
            </div>
        )
    }
)

InputField.displayName = "InputField"