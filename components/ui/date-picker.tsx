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
}

export function DatePicker({ value, onChange, placeholder = "Pick a date", disabled, className }: DatePickerProps) {
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
                        // Identical to Input component
                        "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2",
                        "text-sm transition-colors outline-none",
                        "hover:border-gray-400",
                        "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/12",
                        "disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300",
                        // dark mode
                        "dark:bg-[#0D1F3C] dark:border-[#344563] dark:text-gray-100",
                        "dark:hover:border-[#505F79]",
                        "dark:focus-visible:border-primary dark:focus-visible:ring-primary/20",
                        "dark:disabled:bg-[#172B4D] dark:disabled:text-[#6B778C]",
                        !validSelected && "text-gray-400 dark:text-[#6B778C]",
                        className
                    )}
                >
                    {validSelected ? format(validSelected, "d MMM yyyy") : placeholder}
                    <CalendarIcon className="size-4 text-gray-400 dark:text-[#6B778C] shrink-0" />
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
                    startMonth={new Date(1940, 0)}
                    endMonth={new Date()}
                    initialFocus
                />
            </PopoverContent>
        </Popover>
    )
}
