"use client"

import * as React from "react"
import { format, parse, isValid } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"

interface DatePickerProps {
    value?: string        // ISO date string "YYYY-MM-DD"
    onChange?: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
    fromDate?: Date
    toDate?: Date
    error?: boolean
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", disabled, className, fromDate, toDate, error }: DatePickerProps) {
    const defaultToDate = React.useMemo(() => {
        const d = new Date()
        d.setFullYear(d.getFullYear() + 5)
        return d
    }, [])
    const [open, setOpen] = React.useState(false)

    const selected = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
    const validSelected = selected && isValid(selected) ? selected : undefined

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "h-10 w-full rounded-xl border border-border bg-background px-3",
                        "flex items-center justify-between text-[14px] text-foreground",
                        "transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
                        "hover:border-border/80",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        !validSelected && "text-muted-foreground",
                        error && "border-danger",
                        className
                    )}
                >
                    {validSelected ? format(validSelected, "d MMM yyyy") : placeholder}
                    <CalendarIcon className="size-4 text-muted-foreground shrink-0 ml-2" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                    mode="single"
                    selected={validSelected}
                    onSelect={date => {
                        onChange?.(date ? format(date, "yyyy-MM-dd") : "")
                        setOpen(false)
                    }}
                    captionLayout="dropdown"
                    defaultMonth={validSelected}
                    startMonth={fromDate ?? new Date(1940, 0)}
                    endMonth={toDate ?? defaultToDate}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
