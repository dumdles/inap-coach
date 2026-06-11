"use client"

import * as React from "react"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
    value?: string        // "YYYY-MM-DDTHH:MM" (local, matches datetime-local)
    onChange?: (value: string) => void
    disabled?: boolean
    className?: string
    fromDate?: Date
    toDate?: Date
    error?: boolean
    minuteStep?: number
}

/**
 * In-app replacement for <input type="datetime-local"> — a DatePicker for the
 * date and a TimePicker for the time, both driven by the app's own components
 * so nothing falls back to the browser's native picker. Emits the same
 * "YYYY-MM-DDTHH:MM" string the native control produced, so callers that do
 * `new Date(value)` keep working unchanged.
 */
export function DateTimePicker({
    value, onChange, disabled, className, fromDate, toDate, error, minuteStep,
}: DateTimePickerProps) {
    const [datePart, rawTime] = value && value.includes("T") ? value.split("T") : [value ?? "", ""]
    const timePart = rawTime ? rawTime.slice(0, 5) : ""

    // Recombine date + time; default the missing half so we always emit a
    // valid datetime once a date is chosen.
    function emit(date: string, time: string) {
        if (!date) { onChange?.(""); return }
        onChange?.(`${date}T${time || "00:00"}`)
    }

    return (
        <div className={cn("flex gap-2", className)}>
            <DatePicker
                value={datePart || undefined}
                onChange={d => emit(d, timePart)}
                disabled={disabled}
                fromDate={fromDate}
                toDate={toDate}
                error={error}
                className="flex-1"
            />
            <TimePicker
                value={timePart || undefined}
                onChange={t => emit(datePart, t)}
                disabled={disabled}
                error={error}
                minuteStep={minuteStep}
                className="w-24 shrink-0"
            />
        </div>
    )
}
