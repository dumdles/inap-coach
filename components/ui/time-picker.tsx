"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface TimePickerProps {
    value?: string        // 24h "HH:MM"
    onChange?: (value: string) => void
    placeholder?: string
    disabled?: boolean
    className?: string
    error?: boolean
    minuteStep?: number   // granularity of the minutes column (default 5)
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * In-app time picker matching the DatePicker pattern (Popover + trigger button
 * styled with theme tokens). Two scrollable columns — hours 00–23 and minutes
 * at `minuteStep` granularity — so it reads in 24h SGT like the rest of the app
 * and never falls back to the browser's native time control.
 */
export function TimePicker({
    value, onChange, placeholder = "Time", disabled, className, error, minuteStep = 5,
}: TimePickerProps) {
    const [open, setOpen] = React.useState(false)

    const valid = value && /^\d{1,2}:\d{2}$/.test(value)
    const selHour = valid ? parseInt(value!.split(":")[0], 10) : undefined
    const selMin = valid ? parseInt(value!.split(":")[1], 10) : undefined

    const hours = React.useMemo(() => Array.from({ length: 24 }, (_, i) => i), [])
    const minutes = React.useMemo(
        () => Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) => i * minuteStep),
        [minuteStep],
    )

    // Scroll the currently-selected hour/minute into view when the popover opens.
    const hourRef = React.useRef<HTMLButtonElement>(null)
    const minRef = React.useRef<HTMLButtonElement>(null)
    React.useEffect(() => {
        if (!open) return
        const id = requestAnimationFrame(() => {
            hourRef.current?.scrollIntoView({ block: "center" })
            minRef.current?.scrollIntoView({ block: "center" })
        })
        return () => cancelAnimationFrame(id)
    }, [open])

    // Emit a complete HH:MM; default the other half to 00 if only one is set.
    function emit(h: number | undefined, m: number | undefined) {
        const hh = h ?? selHour ?? 0
        const mm = m ?? selMin ?? 0
        onChange?.(`${pad(hh)}:${pad(mm)}`)
    }

    const cellCls = (active: boolean) =>
        cn(
            "w-full rounded-lg px-3 py-1.5 text-left text-[13px] tabular-nums transition-colors",
            active
                ? "bg-primary text-primary-foreground font-semibold"
                : "text-foreground hover:bg-accent",
        )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    disabled={disabled}
                    className={cn(
                        "h-10 w-full rounded-xl border border-border bg-background px-3",
                        "flex items-center justify-between text-[14px] text-foreground tabular-nums",
                        "transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40",
                        "hover:border-border/80",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        !valid && "text-muted-foreground",
                        error && "border-danger",
                        className,
                    )}
                >
                    {valid ? `${pad(selHour!)}:${pad(selMin!)}` : placeholder}
                    <ClockIcon className="size-4 text-muted-foreground shrink-0 ml-2" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
                <div className="flex gap-1">
                    <div className="h-52 w-16 overflow-y-auto scrollbar-hide space-y-0.5 pr-0.5">
                        {hours.map(h => (
                            <button
                                key={h}
                                ref={h === selHour ? hourRef : undefined}
                                type="button"
                                onClick={() => emit(h, undefined)}
                                className={cellCls(h === selHour)}
                            >
                                {pad(h)}
                            </button>
                        ))}
                    </div>
                    <div className="h-52 w-16 overflow-y-auto scrollbar-hide space-y-0.5 pl-0.5 border-l border-border">
                        {minutes.map(m => (
                            <button
                                key={m}
                                ref={m === selMin ? minRef : undefined}
                                type="button"
                                onClick={() => emit(undefined, m)}
                                className={cellCls(m === selMin)}
                            >
                                {pad(m)}
                            </button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    )
}
