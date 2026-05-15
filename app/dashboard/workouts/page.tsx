"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAuth } from "@/app/context/auth-context"
import { cn, fmt } from "@/lib/utils"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { FootprintsIcon, DumbbellIcon, FlameIcon, DrumstickIcon, SoupIcon } from "lucide-react"

type GoalMode = "bulk" | "cut" | "maintain" | "ippt"
type ExerciseSource = "manual" | "polar"

type ExerciseLog = {
    id: string
    name: string
    source: ExerciseSource
    minutes: number
    calories: number
    notes: string
}

const GOALS: Record<GoalMode, { label: string; description: string; calories: number; accent: string; chip: string }> = {
    bulk: {
        label: "Bulk",
        description: "Push muscle gain with a controlled surplus.",
        calories: 3040,
        accent: "bg-primary-light text-primary",
        chip: "bg-primary-light text-primary border-primary-light",
    },
    cut: {
        label: "Cut",
        description: "Trim fat without losing training momentum.",
        calories: 2300,
        accent: "bg-danger-light text-danger-dark",
        chip: "bg-danger-light text-danger-dark border-danger-light",
    },
    maintain: {
        label: "Maintain",
        description: "Hold body comp and keep your engine steady.",
        calories: 2680,
        accent: "bg-success-light text-success-dark",
        chip: "bg-success-light text-success-dark border-success-light",
    },
    ippt: {
        label: "IPPT",
        description: "Stay sharp and fuel the final stretch.",
        calories: 2800,
        accent: "bg-warning-light text-warning-dark",
        chip: "bg-warning-light text-warning-dark border-warning-light",
    },
}

const TREND_DATA = [
    { day: "Mon", calories: 1780 },
    { day: "Tue", calories: 2010 },
    { day: "Wed", calories: 1940 },
    { day: "Thu", calories: 2140 },
    { day: "Fri", calories: 2290 },
    { day: "Sat", calories: 2160 },
    { day: "Sun", calories: 2385 },
]

const STATIC_STATS = {
    calories: 2185,
    carbs: 142,
    fat: 61,
    steps: 7420,
}

function StatCard({
    label,
    value,
    unit,
    sub,
    tone,
    icon,
}: {
    label: string
    value: string | number
    unit: string
    sub: string
    tone: "primary" | "success" | "warning" | "danger"
    icon: React.ReactNode
}) {
    const toneClass = {
        primary: "bg-primary-light text-primary",
        success: "bg-success-light text-success-dark",
        warning: "bg-warning-light text-warning-dark",
        danger: "bg-danger-light text-danger-dark",
    }[tone]

    return (
        <Card size="sm" className="gap-0 shadow-sm hover:shadow-md transition-shadow duration-200">
            <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between gap-4 mb-4">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="font-display text-[30px] font-extrabold leading-none text-foreground">{value}</span>
                            <span className="text-xs text-muted-foreground">{unit}</span>
                        </div>
                    </div>
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl", toneClass)}>{icon}</div>
                </div>
                <p className="text-xs text-muted-foreground">{sub}</p>
            </CardContent>
        </Card>
    )
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        </div>
    )
}

function getPolarData() {
    // Placeholder for future Polar API integration
}

export default function WorkoutsPage() {
    const { user } = useAuth()
    const [goal, setGoal] = React.useState<GoalMode>("maintain")
    const [loggerOpen, setLoggerOpen] = React.useState(false)
    const [exerciseForm, setExerciseForm] = React.useState({
        name: "",
        source: "manual" as ExerciseSource,
        minutes: "",
        calories: "",
        notes: "",
    })
    const [logs, setLogs] = React.useState<ExerciseLog[]>([
        { id: "1", name: "Morning tempo run", source: "polar", minutes: 32, calories: 410, notes: "Polar sync" },
        { id: "2", name: "Pull day strength", source: "manual", minutes: 54, calories: 330, notes: "Tracked manually" },
        { id: "3", name: "Evening walk", source: "polar", minutes: 26, calories: 155, notes: "Low intensity" },
    ])

    const goalMeta = GOALS[goal]
    const caloriesRemaining = Math.max(goalMeta.calories - STATIC_STATS.calories, 0)
    const calorieProgress = Math.min(100, Math.round((STATIC_STATS.calories / goalMeta.calories) * 100))
    const stepProgress = Math.min(100, Math.round((STATIC_STATS.steps / 10000) * 100))

    const handleSaveLog = () => {
        if (!exerciseForm.name.trim()) return

        setLogs(current => [
            {
                id: crypto.randomUUID(),
                name: exerciseForm.name.trim(),
                source: exerciseForm.source,
                minutes: Number.parseInt(exerciseForm.minutes, 10) || 0,
                calories: Number.parseInt(exerciseForm.calories, 10) || 0,
                notes: exerciseForm.notes.trim(),
            },
            ...current,
        ])
        setExerciseForm({ name: "", source: "manual", minutes: "", calories: "", notes: "" })
        setLoggerOpen(false)
    }

    return (
        <div className="min-h-screen px-4 sm:px-8 pt-8 pb-12">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard
                        label="Calories burned"
                        value={fmt(STATIC_STATS.calories, 0)}
                        unit="kcal"
                        sub={`${caloriesRemaining} kcal left to target · ${calorieProgress}% complete`}
                        tone="primary"
                        icon={<FlameIcon />}
                    />
                    <StatCard
                        label="Carbs tracked"
                        value={fmt(STATIC_STATS.carbs, 0)}
                        unit="g"
                        sub="Static mock data for design review."
                        tone="warning"
                        icon={<SoupIcon />}
                    />
                    <StatCard
                        label="Fat tracked"
                        value={fmt(STATIC_STATS.fat, 0)}
                        unit="g"
                        sub="Useful for recovery and energy balance."
                        tone="success"
                        icon={<DrumstickIcon />}
                    />
                    <StatCard
                        label="Training sessions"
                        value={logs.length}
                        unit="entries"
                        sub="Polar + manual logs blended in one view."
                        tone="danger"
                        icon={<DumbbellIcon />}
                    />
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
                    <Card>
                        <CardHeader className="border-b border-border pb-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                                <SectionHeading
                                    title="Today at a glance"
                                    subtitle="A clean summary panel for calorie burn, steps, and weekly movement trends."
                                />
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            if (!user?.id) return
                                            const params = new URLSearchParams({ userId: user.id })
                                            window.location.href = `/api/auth/polar?${params.toString()}`
                                        }}
                                        disabled={!user?.id}
                                    >
                                        <FootprintsIcon className="size-4" />
                                        Connect to Polar
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="pt-6 space-y-6">
                            <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                                <div className="rounded-3xl border border-border bg-muted/30 p-4">
                                    <div className="flex items-center justify-between gap-3 mb-4">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Calories over 7 days</div>
                                            <div className="mt-1 text-sm text-muted-foreground">Static trend data for the visual direction.</div>
                                        </div>
                                        <Badge variant="outline" className="border-border bg-card text-muted-foreground">7 day trend</Badge>
                                    </div>

                                    <ChartContainer className="h-[260px] w-full" config={{ calories: { label: "Calories", color: "var(--primary)" } }}>
                                        <LineChart data={TREND_DATA} margin={{ left: 6, right: 16, top: 10, bottom: 4 }}>
                                            <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                            <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} />
                                            <YAxis tickLine={false} axisLine={false} tickMargin={10} width={42} />
                                            <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
                                            <Line type="monotone" dataKey="calories" stroke="var(--color-calories)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        </LineChart>
                                    </ChartContainer>
                                </div>

                                <div className="space-y-4">
                                    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                                        <div className="flex items-center justify-between gap-3 mb-3">
                                            <div>
                                                <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Step tracker</div>
                                                <div className="mt-1 text-sm font-medium text-foreground">{STATIC_STATS.steps} / 10,000 steps</div>
                                            </div>
                                            <Badge variant="outline" className="border-border bg-card text-muted-foreground">{stepProgress}%</Badge>
                                        </div>
                                        <Progress value={stepProgress} className="h-2.5" />
                                        <p className="mt-3 text-xs text-muted-foreground">
                                            {10000 - STATIC_STATS.steps > 0 ? `${10000 - STATIC_STATS.steps} steps to go. Keep moving.` : "You’ve hit today’s step target."}
                                        </p>
                                    </div>

                                    <div className="rounded-3xl border border-border bg-card p-4 shadow-sm space-y-3">
                                        <div>
                                            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Goal snapshot</div>
                                            <div className="mt-1 text-sm font-medium text-foreground">{GOALS[goal].label} mode</div>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{GOALS[goal].description}</p>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge variant="outline" className="border-border bg-card text-muted-foreground">{fmt(calorieProgress, 0)}% calories</Badge>
                                            <Badge variant="outline" className="border-border bg-card text-muted-foreground">{logs.length} exercises</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                                <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Calories progress</div>
                                    <div className="mt-2 text-sm font-semibold text-foreground">{calorieProgress}% of goal</div>
                                    <Progress value={calorieProgress} className="mt-4 h-2.5" />
                                </div>

                                <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Goal mode</div>
                                    <div className="mt-2 text-sm font-semibold text-foreground">{GOALS[goal].label}</div>
                                    <p className="mt-1 text-xs text-muted-foreground">Primary focus for the current training phase.</p>
                                </div>

                                <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Design notes</div>
                                    <div className="mt-2 text-sm font-semibold text-foreground">Static mock</div>
                                    <p className="mt-1 text-xs text-muted-foreground">API calls are intentionally commented out for now.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader className="border-b border-border pb-5">
                                <CardTitle>Exercise logger</CardTitle>
                                <CardDescription>Manual entries stay local in this prototype.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-5">
                                <Button className="w-full" onClick={() => setLoggerOpen(true)}>Open logger</Button>
                                <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
                                    Add strength, mobility, cardio, or mixed sessions without waiting for Polar sync.
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="border-b border-border pb-5">
                                <CardTitle>Recent logs</CardTitle>
                                <CardDescription>Example data to show the layout and hierarchy.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-3">
                                {logs.map(log => (
                                    <div key={log.id} className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div className="text-sm font-semibold text-foreground truncate">{log.name}</div>
                                                <Badge variant="outline" className={cn("border", log.source === "polar" ? "bg-primary-light text-primary border-primary-light" : "bg-secondary text-foreground border-border")}>{log.source}</Badge>
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">{log.minutes} min</div>
                                            {log.notes && <div className="mt-1 text-xs text-muted-foreground">{log.notes}</div>}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-sm font-semibold text-foreground">{fmt(log.calories, 0)} kcal</div>
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    </div>
                </section>
            </div>

            <Dialog open={loggerOpen} onOpenChange={setLoggerOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Log exercise</DialogTitle>
                        <DialogDescription>Prototype logger with static styling and local state only.</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium text-foreground">Exercise name</label>
                            <Input
                                value={exerciseForm.name}
                                onChange={event => setExerciseForm(current => ({ ...current, name: event.target.value }))}
                                placeholder="Upper body strength"
                            />
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 sm:items-start">
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-foreground">Source</label>
                                <Select value={exerciseForm.source} onValueChange={value => setExerciseForm(current => ({ ...current, source: value as ExerciseSource }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select source" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manual">Manual</SelectItem>
                                        <SelectItem value="polar">Polar</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <label className="text-sm font-medium text-foreground">Duration (min)</label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={exerciseForm.minutes}
                                    onChange={event => setExerciseForm(current => ({ ...current, minutes: event.target.value }))}
                                    placeholder="45"
                                />
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium text-foreground">Calories</label>
                            <Input
                                type="number"
                                min="0"
                                value={exerciseForm.calories}
                                onChange={event => setExerciseForm(current => ({ ...current, calories: event.target.value }))}
                                placeholder="320"
                            />
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium text-foreground">Notes</label>
                            <textarea
                                rows={4}
                                value={exerciseForm.notes}
                                onChange={event => setExerciseForm(current => ({ ...current, notes: event.target.value }))}
                                placeholder="Optional note about intensity, tempo, or session focus"
                                className="flex min-h-24 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 transition-colors hover:border-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/12 dark:bg-[#0D1F3C] dark:border-[#344563] dark:text-gray-100 dark:placeholder:text-[#6B778C] dark:hover:border-[#505F79] dark:focus:border-primary dark:focus:ring-primary/20"
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLoggerOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveLog} disabled={!exerciseForm.name.trim()}>Save log</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
