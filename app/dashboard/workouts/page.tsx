"use client"

import * as React from "react"
import { useAuth } from "@/app/context/auth-context"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import {
    DumbbellIcon, FlameIcon, ClockIcon, HeartIcon, PlusIcon,
    FootprintsIcon, ZapIcon, BikeIcon, WavesIcon, TimerIcon,
    RouteIcon, ActivityIcon, ChevronRightIcon, ArrowLeftIcon,
    RefreshCwIcon, PencilIcon, Trash2Icon,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { WorkoutDetailDialog } from "@/components/workouts/workout-detail-dialog"

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDuration(iso: string): number {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0
    return (parseInt(match[1] ?? "0") * 60) + parseInt(match[2] ?? "0")
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short" })
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

const CATEGORY_COLOR: Record<string, string> = {
    strength: "bg-primary/10 text-primary",
    cardio:   "bg-success-light text-success-dark",
    hiit:     "bg-warning-light text-warning-dark",
    other:    "bg-muted text-muted-foreground",
}

// ── Log Modal (2-step) ─────────────────────────────────────────────────────────

function initials(name: string) {
    return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"
}

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
    const [form, setForm] = React.useState({
        duration_min: "", calories: "", distance_km: "",
        sets: "", reps: "", rounds: "", notes: "",
    })

    // When editingLog changes, pre-fill the form
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

    function reset() {
        setStep("pick"); setSelected(null); setTaggedIds([])
        setForm({ duration_min: "", calories: "", distance_km: "", sets: "", reps: "", rounds: "", notes: "" })
    }

    function handleClose() { reset(); onClose() }

    function handlePick(t: ExerciseTemplate) { setSelected(t); setStep("fill") }

    function toggleTag(id: string) {
        setTaggedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    async function handleSave() {
        if (!selected && !isEdit) return
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
                                    autoFocus type="number" min="0"
                                    value={form.duration_min}
                                    onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}
                                    placeholder="45"
                                    className={inputCls}
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                                    Calories <span className="normal-case font-normal tracking-normal">{selected?.calories_per_min ? "(auto)" : ""}</span>
                                </label>
                                <input
                                    type="number" min="0"
                                    value={form.calories}
                                    onChange={e => setForm(f => ({ ...f, calories: e.target.value }))}
                                    placeholder={
                                        form.duration_min && selected?.calories_per_min
                                            ? String(Math.round(parseInt(form.duration_min || "0") * selected.calories_per_min))
                                            : "320"
                                    }
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {selected?.fields.distance && (
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Distance (km)</label>
                                <input
                                    type="number" min="0" step="0.1"
                                    value={form.distance_km}
                                    onChange={e => setForm(f => ({ ...f, distance_km: e.target.value }))}
                                    placeholder="5.0"
                                    className={inputCls}
                                />
                            </div>
                        )}

                        {selected?.fields.sets_reps && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sets</label>
                                    <input
                                        type="number" min="0"
                                        value={form.sets}
                                        onChange={e => setForm(f => ({ ...f, sets: e.target.value }))}
                                        placeholder="4"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Reps</label>
                                    <input
                                        type="number" min="0"
                                        value={form.reps}
                                        onChange={e => setForm(f => ({ ...f, reps: e.target.value }))}
                                        placeholder="10"
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        )}

                        {selected?.fields.rounds && (
                            <div>
                                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Rounds</label>
                                <input
                                    type="number" min="0"
                                    value={form.rounds}
                                    onChange={e => setForm(f => ({ ...f, rounds: e.target.value }))}
                                    placeholder="5"
                                    className={inputCls}
                                />
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

                        {/* Tag friends */}
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

const CATEGORY_FILTERS = [
    { key: "all",      label: "All" },
    { key: "strength", label: "Strength" },
    { key: "cardio",   label: "Cardio" },
    { key: "hiit",     label: "HIIT" },
    { key: "other",    label: "Other" },
] as const

type CategoryKey = (typeof CATEGORY_FILTERS)[number]["key"]

export default function WorkoutsPage() {
    const { user } = useAuth()
    const [templates, setTemplates] = React.useState<ExerciseTemplate[]>([])
    const [friends, setFriends] = React.useState<Friend[]>([])
    const [logs, setLogs] = React.useState<WorkoutLog[]>([])
    const [logsLoading, setLogsLoading] = React.useState(true)
    const [polarLoading, setPolarLoading] = React.useState(false)
    const [isPolarConnected, setIsPolarConnected] = React.useState(false)
    const [loggerOpen, setLoggerOpen] = React.useState(false)
    const [editLog, setEditLog] = React.useState<WorkoutLog | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null)
    const [activeFilter, setActiveFilter] = React.useState<CategoryKey>("all")
    const [detailId, setDetailId] = React.useState<string | null>(null)

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

    // Load workout logs
    const fetchLogs = React.useCallback(async () => {
        if (!user?.id) return
        setLogsLoading(true)
        const params = new URLSearchParams({ userId: user.id })
        if (activeFilter !== "all") params.set("category", activeFilter)
        const data = await fetch(`/api/workout-logs?${params}`).then(r => r.json())
        setLogs(Array.isArray(data) ? data : [])
        setLogsLoading(false)
    }, [user?.id, activeFilter])

    React.useEffect(() => { fetchLogs() }, [fetchLogs])

    const syncPolar = React.useCallback(async (force = false) => {
        if (!user?.id || templates.length === 0) return
        const storageKey = `polar_last_sync_${user.id}`
        const lastSync = localStorage.getItem(storageKey)
        const oneDayMs = 24 * 60 * 60 * 1000
        if (!force && lastSync && Date.now() - parseInt(lastSync) < oneDayMs) return

        setPolarLoading(true)
        fetch(`/api/polar/exercises?userId=${user.id}`)
            .then(r => r.json())
            .then(async (data: { exercises?: PolarExercise[]; error?: string }) => {
                if (data.error || !data.exercises?.length) return
                setIsPolarConnected(true)
                const inserts = data.exercises.map(ex => {
                    const template = templates.find(t =>
                        t.polar_sport_keys.some(k => k === ex.sport)
                    ) ?? templates.find(t => t.category === "other")!
                    return {
                        userId: user.id!,
                        templateId: template.id,
                        source: "polar" as const,
                        name: template.name,
                        duration_min: parseDuration(ex.duration ?? ""),
                        calories: ex.calories,
                        distance_km: ex.distance ? +(ex.distance / 1000).toFixed(2) : undefined,
                        heart_rate_avg: ex.heart_rate?.average,
                        polar_exercise_id: ex.id,
                        logged_at: ex.start_time,
                    }
                })
                await Promise.all(inserts.map(i =>
                    fetch("/api/workout-logs", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(i),
                    })
                ))
                localStorage.setItem(storageKey, Date.now().toString())
                await fetchLogs()
            })
            .finally(() => setPolarLoading(false))
    }, [user?.id, templates, fetchLogs])

    // Auto-sync on load if >24h since last sync
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user?.id, taggerName, ...data }),
        })
        await fetchLogs()
    }

    async function handleEdit(id: string, data: Record<string, unknown>) {
        await fetch(`/api/workout-logs?id=${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        })
        await fetchLogs()
    }

    async function handleDelete(id: string) {
        await fetch(`/api/workout-logs?id=${id}`, { method: "DELETE" })
        setLogs(prev => prev.filter(l => l.id !== id))
        setConfirmDeleteId(null)
    }

    const totalCalories = logs.reduce((s, l) => s + (l.calories ?? 0), 0)
    const totalMinutes = logs.reduce((s, l) => s + (l.duration_min ?? 0), 0)
    const polarCount = logs.filter(l => l.source === "polar").length
    const manualCount = logs.filter(l => l.source === "manual").length

    return (
        <div className="px-4 sm:px-8 pt-8 pb-12 max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="font-display text-3xl font-extrabold text-foreground mb-0.5">Workouts</h1>
                    <p className="text-sm text-muted-foreground">Exercise logs from Polar and manual entries.</p>
                </div>
                <div className="flex items-center gap-2">
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
            <div className="grid grid-cols-2 gap-3">
                {[
                    { label: "Calories burned", value: totalCalories > 0 ? totalCalories.toLocaleString() : "—", unit: "kcal", sub: logs.length > 0 ? `${logs.length} session${logs.length !== 1 ? "s" : ""}` : "No sessions yet", tone: "primary", icon: <FlameIcon className="w-4 h-4" /> },
                    { label: "Time active", value: totalMinutes > 0 ? totalMinutes : "—", unit: "min", sub: totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m total` : "Keep moving", tone: "warning", icon: <ClockIcon className="w-4 h-4" /> },
                    { label: "Polar sessions", value: polarCount, unit: "synced", sub: isPolarConnected ? "Connected to Polar Flow" : "Connect Polar to sync", tone: "success", icon: <FootprintsIcon className="w-4 h-4" /> },
                    { label: "Manual entries", value: manualCount, unit: "logged", sub: "Sessions added by hand", tone: "danger", icon: <DumbbellIcon className="w-4 h-4" /> },
                ].map(c => {
                    const toneClass = {
                        primary: "bg-primary/10 text-primary",
                        success: "bg-success-light text-success-dark",
                        warning: "bg-warning-light text-warning-dark",
                        danger:  "bg-danger-light text-danger-dark",
                    }[c.tone as string] ?? ""
                    return (
                        <div key={c.label} className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0", toneClass)}>{c.icon}</div>
                                <div className="flex-1 text-right">
                                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{c.label}</div>
                                    <div className="mt-0.5 flex items-baseline gap-1 justify-end">
                                        <span className="font-display text-2xl font-extrabold text-foreground">{c.value}</span>
                                        <span className="text-[11px] text-muted-foreground">{c.unit}</span>
                                    </div>
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">{c.sub}</p>
                        </div>
                    )
                })}
            </div>

            {/* Polar connect banner */}
            {!isPolarConnected && !polarLoading && (
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

            {/* Polar syncing */}
            {polarLoading && (
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                    <span className="text-[13px] text-muted-foreground">Syncing from Polar…</span>
                </div>
            )}

            {/* Filter chips */}
            <div className="flex items-center gap-2 flex-wrap">
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
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-foreground">Sessions</span>
                    {logs.length > 0 && (
                        <span className="text-[12px] text-muted-foreground">{logs.length} total</span>
                    )}
                </div>

                {logsLoading ? (
                    <div className="px-5 py-8 space-y-3">
                        {[0, 1, 2].map(i => (
                            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
                        ))}
                    </div>
                ) : logs.length === 0 ? (
                    <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                            <DumbbellIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <div className="text-[13px] font-semibold text-foreground">No sessions yet</div>
                            <p className="text-[12px] text-muted-foreground mt-0.5">Connect Polar or log a session manually.</p>
                        </div>
                        <button
                            onClick={() => setLoggerOpen(true)}
                            className="rounded-full bg-primary px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-primary/90 transition-colors"
                        >
                            Log your first session
                        </button>
                    </div>
                ) : (
                    logs.map(log => {
                        const cat = log.exercise_templates?.category ?? "other"
                        const chipCls = CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.other
                        const isConfirming = confirmDeleteId === log.id
                        return (
                            <div key={log.id} className="border-b border-border last:border-0">
                                {isConfirming ? (
                                    <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                                        <span className="text-[12px] text-muted-foreground">
                                            Delete <span className="font-semibold text-foreground">{log.name}</span>?
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
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[13px] font-semibold text-foreground">{log.name}</span>
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
                                                <button
                                                    onClick={e => { e.stopPropagation(); setEditLog(log); setLoggerOpen(true) }}
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                                                    title="Edit"
                                                >
                                                    <PencilIcon className="w-3.5 h-3.5" />
                                                </button>
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
