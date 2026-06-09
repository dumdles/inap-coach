"use client"

import * as React from "react"
import { useAuth } from "@/app/context/auth-context"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
    DumbbellIcon, FlameIcon, ClockIcon, HeartIcon, PlusIcon,
    FootprintsIcon, ZapIcon, BikeIcon, WavesIcon, TimerIcon,
    RouteIcon, ActivityIcon, ChevronRightIcon, ArrowLeftIcon,
    RefreshCwIcon, PencilIcon, Trash2Icon, TrendingUpIcon,
    ChevronLeftIcon,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { WorkoutDetailDialog } from "@/components/workouts/workout-detail-dialog"
import {
    Pagination, PaginationContent, PaginationItem,
} from "@/components/ui/pagination"
import {
    BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts"

// ── Types ──────────────────────────────────────────────────────────────────────

type TemplateFields = {
    distance?: boolean
    sets_reps?: boolean
    rounds?: boolean
}

type ExerciseTemplate = {
    id: string
    name: string
    category: "strength" | "cardio" | "hiit" | "other"
    icon: string
    polar_sport_keys: string[]
    fields: TemplateFields
    calories_per_min: number | null
}

type WorkoutLog = {
    id: string
    template_id: string | null
    source: "manual" | "polar"
    name: string
    duration_min: number | null
    calories: number | null
    distance_km: number | null
    sets: number | null
    reps: number | null
    rounds: number | null
    heart_rate_avg: number | null
    notes: string | null
    logged_at: string
    polar_exercise_id: string | null
    exercise_templates: { id: string; name: string; category: string; icon: string } | null
}

type Friend = {
    id: string
    full_name: string
    rank: string
}

type PolarExercise = {
    id: string
    sport: string
    start_time: string
    duration: string
    calories?: number
    distance?: number
    heart_rate?: { average?: number; maximum?: number }
}

// ── Constants ─────────────────────────────────────────────────────────────────

type PeriodKey = "7d" | "30d" | "90d" | "all"
const PERIODS: { key: PeriodKey; label: string }[] = [
    { key: "7d",  label: "7d" },
    { key: "30d", label: "30d" },
    { key: "90d", label: "90d" },
    { key: "all", label: "All" },
]

const CATEGORY_FILTERS = [
    { key: "all",      label: "All" },
    { key: "strength", label: "Strength" },
    { key: "cardio",   label: "Cardio" },
    { key: "hiit",     label: "HIIT" },
    { key: "other",    label: "Other" },
] as const

type CategoryKey = (typeof CATEGORY_FILTERS)[number]["key"]

const CATEGORY_COLOR: Record<string, string> = {
    strength: "bg-primary/10 text-primary",
    cardio:   "bg-success-light text-success-dark",
    hiit:     "bg-warning-light text-warning-dark",
    other:    "bg-muted text-muted-foreground",
}

// Category fill colors using CSS vars (for SVG / recharts fills)
const CATEGORY_FILL: Record<string, string> = {
    strength: "var(--color-primary)",
    cardio:   "var(--color-success-dark)",
    hiit:     "var(--color-warning-dark)",
    other:    "var(--color-muted-foreground)",
}

// Tailwind bg classes for the category breakdown bar
const CATEGORY_BG: Record<string, string> = {
    strength: "bg-primary",
    cardio:   "bg-success-dark",
    hiit:     "bg-warning-dark",
    other:    "bg-muted-foreground",
}

const ICON_MAP: Record<string, React.ReactNode> = {
    dumbbell:   <DumbbellIcon className="w-4 h-4" />,
    zap:        <ZapIcon className="w-4 h-4" />,
    route:      <RouteIcon className="w-4 h-4" />,
    timer:      <TimerIcon className="w-4 h-4" />,
    bike:       <BikeIcon className="w-4 h-4" />,
    waves:      <WavesIcon className="w-4 h-4" />,
    footprints: <FootprintsIcon className="w-4 h-4" />,
    activity:   <ActivityIcon className="w-4 h-4" />,
}

const LOGS_PER_PAGE = 10

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0
    return (parseInt(match[1] ?? "0") * 60) + parseInt(match[2] ?? "0")
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })
}

// Consistent local-time date key, avoids UTC midnight offset issues
function localDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

// Normalize legacy all-caps Polar names on display (e.g., "RUNNING" → "Running")
function displayName(log: WorkoutLog): string {
    const n = log.name
    if (log.source === "polar" && /^[A-Z_\s]+$/.test(n) && n.length < 50) {
        return n.toLowerCase().replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase())
    }
    return n
}

function durationLabel(min: number | null): string {
    if (!min || min <= 0) return "—"
    if (min < 60) return `${min}m`
    const h = Math.floor(min / 60)
    const m = min % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function initials(name: string) {
    return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"
}

// ── SectionHeader ──────────────────────────────────────────────────────────────

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</h2>
            {children}
        </div>
    )
}

// ── Activity Heatmap ───────────────────────────────────────────────────────────

const HEATMAP_WEEKS = 17
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function cellIntensity(count: number): string {
    // In dark mode --muted === --card, so empty cells need a lighter token (border) to stay visible
    if (count === 0) return "bg-muted dark:bg-border"
    if (count === 1) return "bg-primary/30"
    if (count === 2) return "bg-primary/60"
    return "bg-primary"
}

function ActivityHeatmap({ logs }: { logs: WorkoutLog[] }) {
    const countByDate = React.useMemo(() => {
        const m = new Map<string, number>()
        for (const log of logs) {
            const key = localDateKey(new Date(log.logged_at))
            m.set(key, (m.get(key) ?? 0) + 1)
        }
        return m
    }, [logs])

    // Build HEATMAP_WEEKS columns of 7 days (Mon–Sun), ending with the current week
    const weeks = React.useMemo(() => {
        const today = new Date()
        const dow = today.getDay() // 0=Sun
        const daysFromMon = dow === 0 ? 6 : dow - 1
        const thisMonday = new Date(today)
        thisMonday.setDate(today.getDate() - daysFromMon)
        thisMonday.setHours(0, 0, 0, 0)

        const result: Date[][] = []
        for (let w = HEATMAP_WEEKS - 1; w >= 0; w--) {
            const week: Date[] = []
            for (let d = 0; d < 7; d++) {
                const date = new Date(thisMonday)
                date.setDate(thisMonday.getDate() - w * 7 + d)
                week.push(date)
            }
            result.push(week)
        }
        return result
    }, [])

    // Place a month label at the first week that starts a new month
    const monthLabels = React.useMemo(() => {
        const labels: Record<number, string> = {}
        let last = -1
        weeks.forEach((week, i) => {
            const m = week[0].getMonth()
            if (m !== last) {
                labels[i] = week[0].toLocaleDateString("en-SG", { month: "short" })
                last = m
            }
        })
        return labels
    }, [weeks])

    const todayKey = localDateKey(new Date())
    const now = new Date()

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-[13px] font-semibold text-foreground">Activity — last {HEATMAP_WEEKS} weeks</h3>
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">None</span>
                    {[0, 1, 2, 3].map(n => (
                        <div key={n} className={cn("w-2.5 h-2.5 rounded-sm", cellIntensity(n))} />
                    ))}
                    <span className="text-[10px] text-muted-foreground">High</span>
                </div>
            </div>
            <div className="overflow-x-auto">
                <div className="inline-flex flex-col gap-1 min-w-max">
                    {/* Month labels */}
                    <div className="flex gap-1 pl-7">
                        {weeks.map((_, i) => (
                            <div key={i} className="w-3 flex-shrink-0">
                                {monthLabels[i] && (
                                    <span className="text-[10px] text-muted-foreground">{monthLabels[i]}</span>
                                )}
                            </div>
                        ))}
                    </div>
                    {/* Day rows */}
                    {DAY_LABELS.map((day, di) => (
                        <div key={day} className="flex items-center gap-1">
                            <span className="text-[10px] text-muted-foreground w-6 text-right flex-shrink-0">
                                {di % 2 === 0 ? day : ""}
                            </span>
                            {weeks.map((week, wi) => {
                                const date = week[di]
                                const key = localDateKey(date)
                                const count = countByDate.get(key) ?? 0
                                const isFuture = date > now
                                return (
                                    <div
                                        key={wi}
                                        title={isFuture ? undefined : `${key}: ${count} session${count !== 1 ? "s" : ""}`}
                                        className={cn(
                                            "w-3 h-3 rounded-sm flex-shrink-0 transition-opacity",
                                            isFuture ? "opacity-0" : cellIntensity(count),
                                            key === todayKey && "ring-1 ring-primary ring-offset-1 ring-offset-background"
                                        )}
                                    />
                                )
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Weekly Volume Chart ────────────────────────────────────────────────────────

function WeeklyTrend({ logs }: { logs: WorkoutLog[] }) {
    const data = React.useMemo(() => {
        const today = new Date()
        const dow = today.getDay()
        const daysFromMon = dow === 0 ? 6 : dow - 1
        const thisMonday = new Date(today)
        thisMonday.setDate(today.getDate() - daysFromMon)
        thisMonday.setHours(0, 0, 0, 0)

        return Array.from({ length: 10 }, (_, i) => {
            const weekStart = new Date(thisMonday)
            weekStart.setDate(thisMonday.getDate() - (9 - i) * 7)
            const weekEnd = new Date(weekStart)
            weekEnd.setDate(weekStart.getDate() + 7)

            const weekLogs = logs.filter(l => {
                const d = new Date(l.logged_at)
                return d >= weekStart && d < weekEnd
            })
            return {
                label: weekStart.toLocaleDateString("en-SG", { month: "short", day: "numeric" }),
                min: weekLogs.reduce((s, l) => s + (l.duration_min ?? 0), 0),
                sessions: weekLogs.length,
            }
        })
    }, [logs])

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-1">Weekly volume</h3>
            <p className="text-[11px] text-muted-foreground mb-4">Total active minutes per week (last 10 weeks)</p>
            <ResponsiveContainer width="100%" height={130}>
                <BarChart data={data} barSize={16} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                        axisLine={false} tickLine={false}
                        interval={1}
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                        axisLine={false} tickLine={false}
                    />
                    <Tooltip
                        contentStyle={{
                            background: "var(--color-card)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 12,
                            fontSize: 12,
                            color: "var(--color-foreground)",
                        }}
                        formatter={(val, _name, entry) => {
                            const mins = typeof val === "number" ? val : 0
                            const sessions = (entry as { payload?: { sessions?: number } }).payload?.sessions ?? 0
                            return [`${mins} min · ${sessions} session${sessions !== 1 ? "s" : ""}`, "Activity"]
                        }}
                        cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    />
                    <Bar dataKey="min" radius={[4, 4, 0, 0]} fill="var(--color-primary)" opacity={0.85} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

// ── Category Breakdown ─────────────────────────────────────────────────────────

const CAT_META = [
    { key: "strength", label: "Strength" },
    { key: "cardio",   label: "Cardio" },
    { key: "hiit",     label: "HIIT" },
    { key: "other",    label: "Other" },
]

function CategoryBreakdown({ logs }: { logs: WorkoutLog[] }) {
    const stats = React.useMemo(() => {
        const m: Record<string, { count: number; min: number }> = {
            strength: { count: 0, min: 0 },
            cardio:   { count: 0, min: 0 },
            hiit:     { count: 0, min: 0 },
            other:    { count: 0, min: 0 },
        }
        for (const log of logs) {
            const cat = log.exercise_templates?.category ?? "other"
            const key = cat in m ? cat : "other"
            m[key].count++
            m[key].min += log.duration_min ?? 0
        }
        return CAT_META
            .map(c => ({ ...c, ...m[c.key] }))
            .filter(c => c.count > 0)
            .sort((a, b) => b.count - a.count)
    }, [logs])

    const total = logs.length

    if (total === 0) {
        return (
            <div className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-center min-h-[200px]">
                <p className="text-[12px] text-muted-foreground text-center">No sessions in this period</p>
            </div>
        )
    }

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-1">By type</h3>
            <p className="text-[11px] text-muted-foreground mb-4">{total} session{total !== 1 ? "s" : ""} total</p>
            {/* Proportional bar */}
            <div className="flex h-3 rounded-full overflow-hidden gap-px mb-5">
                {stats.map(s => (
                    <div
                        key={s.key}
                        className={CATEGORY_BG[s.key]}
                        style={{ width: `${(s.count / total) * 100}%` }}
                    />
                ))}
            </div>
            {/* Legend */}
            <div className="space-y-3">
                {stats.map(s => (
                    <div key={s.key} className="flex items-center gap-2.5">
                        <div className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", CATEGORY_BG[s.key])} />
                        <span className="text-[12px] text-foreground flex-1">{s.label}</span>
                        <span className="text-[12px] font-semibold text-foreground tabular-nums">{s.count}</span>
                        {s.min > 0 && (
                            <span className="text-[11px] text-muted-foreground tabular-nums w-12 text-right">
                                {durationLabel(s.min)}
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

// ── Log Modal (2-step) ─────────────────────────────────────────────────────────

function LogModal({
    open, templates, friends, editingLog, onSave, onEdit, onClose,
}: {
    open: boolean
    templates: ExerciseTemplate[]
    friends: Friend[]
    editingLog?: WorkoutLog | null
    onSave: (data: {
        templateId: string; name: string; duration_min?: number; calories?: number
        distance_km?: number; sets?: number; reps?: number; rounds?: number
        notes?: string; taggedUserIds: string[]
    }) => Promise<void>
    onEdit: (id: string, data: {
        duration_min?: number; calories?: number; distance_km?: number
        sets?: number; reps?: number; rounds?: number; heart_rate_avg?: number; notes?: string
    }) => Promise<void>
    onClose: () => void
}) {
    const isEdit = !!editingLog
    const [step, setStep] = React.useState<"pick" | "fill">(isEdit ? "fill" : "pick")
    const [selected, setSelected] = React.useState<ExerciseTemplate | null>(null)
    const [saving, setSaving] = React.useState(false)
    const [taggedIds, setTaggedIds] = React.useState<string[]>([])
    const [formErrors, setFormErrors] = React.useState<Record<string, string>>({})
    const [form, setForm] = React.useState({
        duration_min: "", calories: "", distance_km: "",
        sets: "", reps: "", rounds: "", notes: "",
    })

    React.useEffect(() => {
        if (editingLog) {
            setStep("fill")
            setForm({
                duration_min: editingLog.duration_min?.toString() ?? "",
                calories: editingLog.calories?.toString() ?? "",
                distance_km: editingLog.distance_km?.toString() ?? "",
                sets: editingLog.sets?.toString() ?? "",
                reps: editingLog.reps?.toString() ?? "",
                rounds: editingLog.rounds?.toString() ?? "",
                notes: editingLog.notes ?? "",
            })
            const tmpl = templates.find(t => t.id === editingLog.template_id) ?? null
            setSelected(tmpl)
        } else {
            setStep("pick")
            setSelected(null)
            setForm({ duration_min: "", calories: "", distance_km: "", sets: "", reps: "", rounds: "", notes: "" })
            setTaggedIds([])
        }
    }, [editingLog, templates])

    const FIELD_LIMITS: Record<string, { min: number; max: number; label: string }> = {
        duration_min: { min: 0, max: 600,  label: "Duration" },
        calories:     { min: 0, max: 5000, label: "Calories" },
        distance_km:  { min: 0, max: 200,  label: "Distance" },
        sets:         { min: 0, max: 100,  label: "Sets" },
        reps:         { min: 0, max: 1000, label: "Reps" },
        rounds:       { min: 0, max: 100,  label: "Rounds" },
    }

    function validateField(key: string, val: string): string {
        if (!val) return ""
        const limit = FIELD_LIMITS[key]
        if (!limit) return ""
        const n = parseFloat(val)
        if (isNaN(n)) return "Invalid number"
        if (n < limit.min) return `Min ${limit.min}`
        if (n > limit.max) return `Max ${limit.max}`
        return ""
    }

    function setField(key: keyof typeof form, val: string) {
        setForm(f => ({ ...f, [key]: val }))
        setFormErrors(prev => ({ ...prev, [key]: validateField(key, val) }))
    }

    function validateForm(): boolean {
        const errs: Record<string, string> = {}
        for (const key of Object.keys(FIELD_LIMITS)) {
            const e = validateField(key, form[key as keyof typeof form])
            if (e) errs[key] = e
        }
        setFormErrors(errs)
        return Object.keys(errs).length === 0
    }

    function reset() {
        setStep("pick"); setSelected(null); setTaggedIds([])
        setForm({ duration_min: "", calories: "", distance_km: "", sets: "", reps: "", rounds: "", notes: "" })
        setFormErrors({})
    }

    function handleClose() { reset(); onClose() }
    function handlePick(t: ExerciseTemplate) { setSelected(t); setStep("fill") }

    function toggleTag(id: string) {
        setTaggedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    async function handleSave() {
        if (!selected && !isEdit) return
        if (!validateForm()) return
        setSaving(true)
        const calories = form.calories
            ? parseInt(form.calories)
            : (form.duration_min && selected?.calories_per_min)
                ? Math.round(parseInt(form.duration_min) * selected.calories_per_min)
                : undefined
        if (isEdit && editingLog) {
            await onEdit(editingLog.id, {
                duration_min: form.duration_min ? parseInt(form.duration_min) : undefined,
                calories,
                distance_km: form.distance_km ? parseFloat(form.distance_km) : undefined,
                sets: form.sets ? parseInt(form.sets) : undefined,
                reps: form.reps ? parseInt(form.reps) : undefined,
                rounds: form.rounds ? parseInt(form.rounds) : undefined,
                notes: form.notes || undefined,
            })
        } else {
            await onSave({
                templateId: selected!.id,
                name: selected!.name,
                duration_min: form.duration_min ? parseInt(form.duration_min) : undefined,
                calories,
                distance_km: form.distance_km ? parseFloat(form.distance_km) : undefined,
                sets: form.sets ? parseInt(form.sets) : undefined,
                reps: form.reps ? parseInt(form.reps) : undefined,
                rounds: form.rounds ? parseInt(form.rounds) : undefined,
                notes: form.notes || undefined,
                taggedUserIds: taggedIds,
            })
        }
        setSaving(false)
        handleClose()
    }

    const inputCls = "h-10 rounded-xl border border-border bg-background px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full"

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose() }}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {step === "fill" && !isEdit && (
                            <button
                                onClick={() => setStep("pick")}
                                className="p-1 rounded-lg hover:bg-accent transition-colors -ml-1"
                            >
                                <ArrowLeftIcon className="w-4 h-4 text-muted-foreground" />
                            </button>
                        )}
                        {isEdit ? `Edit · ${editingLog?.name}` : step === "pick" ? "Choose workout type" : selected?.name}
                    </DialogTitle>
                </DialogHeader>

                {step === "pick" ? (
                    <div className="grid grid-cols-2 gap-2">
                        {templates.map(t => (
                            <button
                                key={t.id}
                                onClick={() => handlePick(t)}
                                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-all group"
                            >
                                <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0", CATEGORY_COLOR[t.category])}>
                                    {ICON_MAP[t.icon] ?? <ActivityIcon className="w-4 h-4" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-[13px] font-semibold text-foreground leading-tight">{t.name}</div>
                                    <div className="text-[11px] text-muted-foreground capitalize mt-0.5">{t.category}</div>
                                </div>
                                <ChevronRightIcon className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Duration (min)</label>
                                <input
                                    autoFocus type="number" min="0" max="600"
                                    value={form.duration_min}
                                    onChange={e => setField("duration_min", e.target.value)}
                                    placeholder="45"
                                    className={cn(inputCls, formErrors.duration_min && "border-red-500 focus:ring-red-500/40")}
                                />
                                {formErrors.duration_min && <p className="text-[11px] text-red-500 mt-1">{formErrors.duration_min}</p>}
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                                    Calories <span className="normal-case font-normal tracking-normal">{selected?.calories_per_min ? "(auto)" : ""}</span>
                                </label>
                                <input
                                    type="number" min="0" max="5000"
                                    value={form.calories}
                                    onChange={e => setField("calories", e.target.value)}
                                    placeholder={
                                        form.duration_min && selected?.calories_per_min
                                            ? String(Math.round(parseInt(form.duration_min || "0") * selected.calories_per_min))
                                            : "320"
                                    }
                                    className={cn(inputCls, formErrors.calories && "border-red-500 focus:ring-red-500/40")}
                                />
                                {formErrors.calories && <p className="text-[11px] text-red-500 mt-1">{formErrors.calories}</p>}
                            </div>
                        </div>

                        {selected?.fields.distance && (
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Distance (km)</label>
                                <input
                                    type="number" min="0" max="200" step="0.1"
                                    value={form.distance_km}
                                    onChange={e => setField("distance_km", e.target.value)}
                                    placeholder="5.0"
                                    className={cn(inputCls, formErrors.distance_km && "border-red-500 focus:ring-red-500/40")}
                                />
                                {formErrors.distance_km && <p className="text-[11px] text-red-500 mt-1">{formErrors.distance_km}</p>}
                            </div>
                        )}

                        {selected?.fields.sets_reps && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sets</label>
                                    <input
                                        type="number" min="0" max="100"
                                        value={form.sets}
                                        onChange={e => setField("sets", e.target.value)}
                                        placeholder="4"
                                        className={cn(inputCls, formErrors.sets && "border-red-500 focus:ring-red-500/40")}
                                    />
                                    {formErrors.sets && <p className="text-[11px] text-red-500 mt-1">{formErrors.sets}</p>}
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Reps</label>
                                    <input
                                        type="number" min="0" max="1000"
                                        value={form.reps}
                                        onChange={e => setField("reps", e.target.value)}
                                        placeholder="10"
                                        className={cn(inputCls, formErrors.reps && "border-red-500 focus:ring-red-500/40")}
                                    />
                                    {formErrors.reps && <p className="text-[11px] text-red-500 mt-1">{formErrors.reps}</p>}
                                </div>
                            </div>
                        )}

                        {selected?.fields.rounds && (
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Rounds</label>
                                <input
                                    type="number" min="0" max="100"
                                    value={form.rounds}
                                    onChange={e => setField("rounds", e.target.value)}
                                    placeholder="5"
                                    className={cn(inputCls, formErrors.rounds && "border-red-500 focus:ring-red-500/40")}
                                />
                                {formErrors.rounds && <p className="text-[11px] text-red-500 mt-1">{formErrors.rounds}</p>}
                            </div>
                        )}

                        <div>
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                                Notes <span className="normal-case tracking-normal font-normal">(optional)</span>
                            </label>
                            <textarea
                                rows={2}
                                value={form.notes}
                                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                                placeholder="Intensity, focus area, how it felt…"
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                            />
                        </div>

                        {friends.length > 0 && (
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                                    Tag friends <span className="normal-case tracking-normal font-normal">(optional)</span>
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {friends.map(f => {
                                        const tagged = taggedIds.includes(f.id)
                                        return (
                                            <button
                                                key={f.id}
                                                type="button"
                                                onClick={() => toggleTag(f.id)}
                                                className={cn(
                                                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium border transition-all",
                                                    tagged
                                                        ? "bg-primary/10 text-primary border-primary/30"
                                                        : "bg-card text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold flex-shrink-0",
                                                    tagged ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {initials(f.full_name)}
                                                </div>
                                                {[f.rank, f.full_name].filter(Boolean).join(" ")}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {step === "fill" && (
                    <DialogFooter>
                        <Button variant="outline" onClick={handleClose}>Cancel</Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Saving…" : isEdit ? "Save changes" : "Save session"}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function WorkoutsPage() {
    const { user, session } = useAuth()
    const [templates, setTemplates] = React.useState<ExerciseTemplate[]>([])
    const [friends, setFriends] = React.useState<Friend[]>([])
    const [logs, setLogs] = React.useState<WorkoutLog[]>([])
    const [logsLoading, setLogsLoading] = React.useState(true)
    const [polarLoading, setPolarLoading] = React.useState(false)
    const [isPolarConnected, setIsPolarConnected] = React.useState(false)
    const [isPolarConnectionChecked, setIsPolarConnectionChecked] = React.useState(false)
    const [loggerOpen, setLoggerOpen] = React.useState(false)
    const [editLog, setEditLog] = React.useState<WorkoutLog | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
    const [activeFilter, setActiveFilter] = React.useState<CategoryKey>("all")
    const [activePeriod, setActivePeriod] = React.useState<PeriodKey>("30d")
    const [detailId, setDetailId] = React.useState<string | null>(null)
    const [historyPage, setHistoryPage] = React.useState(1)

    // Load templates + friends once
    React.useEffect(() => {
        supabase
            .from("exercise_templates")
            .select("*")
            .order("sort_order")
            .then(({ data }) => setTemplates((data as ExerciseTemplate[]) ?? []))
    }, [])

    React.useEffect(() => {
        if (!user?.id) return
        supabase
            .from("friendships")
            .select("requester_id, addressee_id")
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
            .eq("status", "accepted")
            .then(async ({ data: rows }) => {
                if (!rows?.length) return
                const ids = rows.map(r => r.requester_id === user.id ? r.addressee_id : r.requester_id)
                const { data: users } = await supabase
                    .from("users")
                    .select("id, full_name, rank")
                    .in("id", ids)
                setFriends((users as Friend[]) ?? [])
            })
    }, [user?.id])

    React.useEffect(() => {
        if (!user?.id) return
        let cancelled = false
        fetch(`/api/auth/polar/status?userId=${user.id}`)
            .then(r => r.json())
            .then((data: { connected?: boolean }) => {
                if (cancelled) return
                setIsPolarConnected(Boolean(data.connected))
                setIsPolarConnectionChecked(true)
            })
            .catch(() => {
                if (cancelled) return
                setIsPolarConnected(false)
                setIsPolarConnectionChecked(true)
            })
        return () => { cancelled = true }
    }, [user?.id])

    // Load all logs — filtering is done client-side so charts always have full data
    const fetchLogs = React.useCallback(async () => {
        if (!user?.id) return
        setLogsLoading(true)
        const data = await fetch(`/api/workout-logs?userId=${user.id}`).then(r => r.json())
        setLogs(Array.isArray(data) ? data : [])
        setLogsLoading(false)
    }, [user?.id])

    React.useEffect(() => { fetchLogs() }, [fetchLogs])

    // Reset to page 1 when filter/period changes
    React.useEffect(() => { setHistoryPage(1) }, [activeFilter, activePeriod, logs])

    const syncPolar = React.useCallback(async (force = false) => {
        if (!user?.id) return
        const storageKey = `polar_last_sync_${user.id}`
        const lastSync = localStorage.getItem(storageKey)
        const oneDayMs = 24 * 60 * 60 * 1000
        if (!force && lastSync && Date.now() - parseInt(lastSync) < oneDayMs) return

        setPolarLoading(true)
        try {
            // The server route handles the upsert directly — no need to re-POST each exercise
            const res = await fetch(`/api/polar/exercises?userId=${user.id}`)
            const data = await res.json()
            if (!data.error) {
                setIsPolarConnected(true)
                localStorage.setItem(storageKey, Date.now().toString())
            }
        } catch {
            // Non-fatal — still refresh the list in case prior syncs added data
        } finally {
            await fetchLogs()
            setPolarLoading(false)
        }
    }, [user?.id, fetchLogs])

    React.useEffect(() => { syncPolar() }, [syncPolar])

    async function handleSave(data: {
        templateId: string; name: string; duration_min?: number; calories?: number
        distance_km?: number; sets?: number; reps?: number; rounds?: number; notes?: string
        taggedUserIds: string[]
    }) {
        const { data: profile } = await supabase
            .from("users").select("full_name, rank").eq("id", user!.id).single()
        const taggerName = [profile?.rank, profile?.full_name].filter(Boolean).join(" ") || "Someone"
        await fetch("/api/workout-logs", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
            body: JSON.stringify({ userId: user?.id, taggerName, ...data }),
        })
        await fetchLogs()
    }

    async function handleEdit(id: string, data: Record<string, unknown>) {
        await fetch(`/api/workout-logs?id=${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}` },
            body: JSON.stringify(data),
        })
        await fetchLogs()
    }

    async function handleDelete(id: string) {
        await fetch(`/api/workout-logs?id=${id}`, { method: "DELETE", headers: { "Authorization": `Bearer ${session?.access_token}` } })
        setLogs(prev => prev.filter(l => l.id !== id))
        setConfirmDeleteId(null)
    }

    // Period-filtered logs (for charts) — category filter NOT applied so breakdown shows all types
    const periodLogs = React.useMemo(() => {
        if (activePeriod === "all") return logs
        const days = { "7d": 7, "30d": 30, "90d": 90 }[activePeriod]
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        return logs.filter(l => new Date(l.logged_at) >= cutoff)
    }, [logs, activePeriod])

    // Fully filtered logs (for stats + session list)
    const filteredLogs = React.useMemo(() => {
        if (activeFilter === "all") return periodLogs
        return periodLogs.filter(l => (l.exercise_templates?.category ?? "other") === activeFilter)
    }, [periodLogs, activeFilter])

    // Stats for the selected period + category
    const totalSessions = filteredLogs.length
    const totalMinutes  = filteredLogs.reduce((s, l) => s + (l.duration_min ?? 0), 0)
    const totalCalories = filteredLogs.reduce((s, l) => s + (l.calories ?? 0), 0)
    const avgMinutes    = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0

    // Pagination for session list
    const totalPages = Math.max(1, Math.ceil(filteredLogs.length / LOGS_PER_PAGE))
    const pagedLogs  = filteredLogs.slice((historyPage - 1) * LOGS_PER_PAGE, historyPage * LOGS_PER_PAGE)

    const periodLabel = activePeriod === "all" ? "all time" : `last ${activePeriod}`

    return (
        <div className="px-4 sm:px-6 lg:px-10 pt-8 pb-12 max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-extrabold text-foreground mb-0.5">Workouts</h1>
                    <p className="text-sm text-muted-foreground">Exercise logs from Polar and manual entries.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => syncPolar(true)}
                        disabled={polarLoading}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                    >
                        <RefreshCwIcon className={cn("w-3.5 h-3.5", polarLoading && "animate-spin")} />
                        Refresh
                    </button>
                    <button
                        onClick={() => setLoggerOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Log exercise
                    </button>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    {
                        label: "Sessions",
                        value: totalSessions,
                        unit: "",
                        sub: periodLabel,
                        tone: "primary",
                        icon: <DumbbellIcon className="w-3.5 h-3.5" />,
                    },
                    {
                        label: "Active time",
                        value: totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`,
                        unit: "",
                        sub: "total duration",
                        tone: "warning",
                        icon: <ClockIcon className="w-3.5 h-3.5" />,
                    },
                    {
                        label: "Calories",
                        value: totalCalories > 0 ? totalCalories.toLocaleString() : "—",
                        unit: totalCalories > 0 ? "kcal" : "",
                        sub: "burned",
                        tone: "danger",
                        icon: <FlameIcon className="w-3.5 h-3.5" />,
                    },
                    {
                        label: "Avg session",
                        value: avgMinutes > 0 ? `${avgMinutes}m` : "—",
                        unit: "",
                        sub: "per session",
                        tone: "success",
                        icon: <TrendingUpIcon className="w-3.5 h-3.5" />,
                    },
                ].map(c => {
                    const toneClass = {
                        primary: "bg-primary/10 text-primary",
                        success: "bg-success-light text-success-dark",
                        warning: "bg-warning-light text-warning-dark",
                        danger:  "bg-danger-light text-danger-dark",
                    }[c.tone] ?? ""
                    return (
                        <div key={c.label} className="bg-card border border-border rounded-2xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0", toneClass)}>
                                    {c.icon}
                                </div>
                                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground leading-tight">{c.label}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-[22px] font-bold tracking-tight text-foreground truncate">{c.value}</span>
                                {c.unit && <span className="text-[11px] text-muted-foreground">{c.unit}</span>}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.sub}</p>
                        </div>
                    )
                })}
            </div>

            {/* Activity heatmap — always shows all logs regardless of filters */}
            <ActivityHeatmap logs={logs} />

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <WeeklyTrend logs={periodLogs} />
                <CategoryBreakdown logs={periodLogs} />
            </div>

            {/* Polar connect banner */}
            {isPolarConnectionChecked && !isPolarConnected && !polarLoading && (
                <div className="bg-card border border-dashed border-border rounded-2xl p-5 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <FootprintsIcon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-foreground">Connect your Polar watch</div>
                        <p className="text-[12px] text-muted-foreground mt-0.5">Sync exercises automatically from Polar Flow.</p>
                    </div>
                    <button
                        onClick={() => { if (user?.id) window.location.href = `/api/auth/polar?userId=${user.id}` }}
                        disabled={!user?.id}
                        className="rounded-full border border-border bg-background px-4 py-1.5 text-[12px] font-semibold text-foreground hover:bg-accent transition-colors flex-shrink-0 disabled:opacity-50"
                    >
                        Connect
                    </button>
                </div>
            )}

            {/* Polar syncing indicator */}
            {polarLoading && (
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                    <span className="text-[13px] text-muted-foreground">Syncing from Polar…</span>
                </div>
            )}

            {/* Period + category filters */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Period toggle */}
                <div className="flex items-center gap-1 bg-muted dark:bg-background rounded-full p-1">
                    {PERIODS.map(p => (
                        <button
                            key={p.key}
                            onClick={() => setActivePeriod(p.key)}
                            className={cn(
                                "rounded-full px-3 py-1 text-[12px] font-semibold transition-all",
                                activePeriod === p.key
                                    ? "bg-card text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <div className="w-px h-5 bg-border mx-1" />
                {/* Category chips */}
                {CATEGORY_FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setActiveFilter(f.key)}
                        className={cn(
                            "rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all",
                            activeFilter === f.key
                                ? "bg-primary text-white"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {/* Session list */}
            <div>
                <SectionHeader title="Sessions">
                    {filteredLogs.length > 0 && (
                        <span className="text-[12px] text-muted-foreground">
                            {filteredLogs.length} session{filteredLogs.length !== 1 ? "s" : ""}
                        </span>
                    )}
                </SectionHeader>
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    {logsLoading ? (
                        <div className="px-5 py-8 space-y-3">
                            {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                                <DumbbellIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-[13px] font-semibold text-foreground">No sessions found</div>
                                <p className="text-[12px] text-muted-foreground mt-0.5">
                                    {logs.length > 0 ? "Try a different period or category." : "Connect Polar or log a session manually."}
                                </p>
                            </div>
                            {logs.length === 0 && (
                                <button
                                    onClick={() => setLoggerOpen(true)}
                                    className="rounded-full bg-primary px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-primary/90 transition-colors"
                                >
                                    Log your first session
                                </button>
                            )}
                        </div>
                    ) : (
                        pagedLogs.map(log => {
                            const cat = log.exercise_templates?.category ?? "other"
                            const chipCls = CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.other
                            const isConfirming = confirmDeleteId === log.id
                            return (
                                <div key={log.id} className="border-b border-border last:border-0">
                                    {isConfirming ? (
                                        <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                                            <span className="text-[12px] text-muted-foreground">
                                                Delete <span className="font-semibold text-foreground">{displayName(log)}</span>?
                                            </span>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button
                                                    onClick={() => setConfirmDeleteId(null)}
                                                    className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(log.id)}
                                                    className="text-[12px] font-semibold text-white bg-danger rounded-lg px-3 py-1 hover:bg-danger/90 transition-colors"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div
                                            className="px-5 py-3.5 group cursor-pointer hover:bg-muted/30 transition-colors"
                                            onClick={() => setDetailId(log.id)}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[13px] font-semibold text-foreground">{displayName(log)}</span>
                                                        <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", chipCls)}>
                                                            {log.exercise_templates?.category ?? "other"}
                                                        </span>
                                                        <span className={cn(
                                                            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                                            log.source === "polar" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {log.source}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                        <span className="text-[11px] text-muted-foreground">{formatDate(log.logged_at)}</span>
                                                        {log.duration_min != null && log.duration_min > 0 && (
                                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                <ClockIcon className="w-3 h-3" />{log.duration_min} min
                                                            </span>
                                                        )}
                                                        {log.distance_km != null && (
                                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                <RouteIcon className="w-3 h-3" />{log.distance_km} km
                                                            </span>
                                                        )}
                                                        {log.sets != null && log.reps != null && (
                                                            <span className="text-[11px] text-muted-foreground">{log.sets}×{log.reps}</span>
                                                        )}
                                                        {log.rounds != null && (
                                                            <span className="text-[11px] text-muted-foreground">{log.rounds} rounds</span>
                                                        )}
                                                        {log.heart_rate_avg != null && (
                                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                <HeartIcon className="w-3 h-3" />{log.heart_rate_avg} bpm
                                                            </span>
                                                        )}
                                                    </div>
                                                    {log.notes && (
                                                        <p className="mt-1 text-[11px] text-muted-foreground italic">{log.notes}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    {log.calories != null && log.calories > 0 && (
                                                        <div className="text-right mr-2">
                                                            <span className="text-[14px] font-bold text-foreground tabular-nums">{log.calories}</span>
                                                            <span className="text-[11px] text-muted-foreground ml-1">kcal</span>
                                                        </div>
                                                    )}
                                                    {log.source === "manual" && (
                                                        <button
                                                            onClick={e => { e.stopPropagation(); setEditLog(log); setLoggerOpen(true) }}
                                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Edit"
                                                        >
                                                            <PencilIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(log.id) }}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Delete"
                                                    >
                                                        <Trash2Icon className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })
                    )}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <Pagination className="mt-3">
                        <PaginationContent>
                            <PaginationItem>
                                <button
                                    onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                    disabled={historyPage === 1}
                                    className="flex h-9 items-center gap-1 px-3 rounded-md text-[13px] font-medium text-foreground hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-40"
                                >
                                    <ChevronLeftIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline">Previous</span>
                                </button>
                            </PaginationItem>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <PaginationItem key={page}>
                                    <button
                                        onClick={() => setHistoryPage(page)}
                                        className={cn(
                                            "flex h-9 w-9 items-center justify-center rounded-md text-[13px] font-medium transition-colors",
                                            page === historyPage
                                                ? "bg-primary text-white"
                                                : "hover:bg-accent text-foreground"
                                        )}
                                    >
                                        {page}
                                    </button>
                                </PaginationItem>
                            ))}
                            <PaginationItem>
                                <button
                                    onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                    disabled={historyPage === totalPages}
                                    className="flex h-9 items-center gap-1 px-3 rounded-md text-[13px] font-medium text-foreground hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-40"
                                >
                                    <span className="hidden sm:inline">Next</span>
                                    <ChevronRightIcon className="w-4 h-4" />
                                </button>
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                )}
            </div>

            <LogModal
                open={loggerOpen}
                templates={templates}
                friends={friends}
                editingLog={editLog}
                onSave={handleSave}
                onEdit={handleEdit}
                onClose={() => { setLoggerOpen(false); setEditLog(null) }}
            />

            <WorkoutDetailDialog
                workoutId={detailId}
                userId={user?.id ?? ""}
                open={!!detailId}
                onClose={() => setDetailId(null)}
            />
        </div>
    )
}
