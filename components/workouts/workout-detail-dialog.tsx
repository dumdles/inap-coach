"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { ClockIcon, FlameIcon, RouteIcon, HeartIcon, LayersIcon, RepeatIcon } from "lucide-react"
import { GpxMap } from "./gpx-map"

type TaggedUser = { id: string; full_name: string; rank: string }

type WorkoutDetail = {
    id: string
    name: string
    source: "manual" | "polar"
    duration_min: number | null
    calories: number | null
    distance_km: number | null
    sets: number | null
    reps: number | null
    rounds: number | null
    heart_rate_avg: number | null
    notes: string | null
    logged_at: string
    exercise_templates: { name: string; category: string; icon: string } | null
    tags: TaggedUser[]
    gpx: string | null
}

const CATEGORY_COLOR: Record<string, string> = {
    strength: "bg-primary/10 text-primary",
    cardio:   "bg-success-light text-success-dark",
    hiit:     "bg-warning-light text-warning-dark",
    other:    "bg-muted text-muted-foreground",
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
            <div className="flex items-center gap-2.5 text-muted-foreground">
                {icon}
                <span className="text-[13px]">{label}</span>
            </div>
            <span className="text-[13px] font-semibold text-foreground">{value}</span>
        </div>
    )
}

function initials(name: string) {
    return name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?"
}

export function WorkoutDetailDialog({
    workoutId, userId, open, onClose,
}: {
    workoutId: string | null
    userId: string
    open: boolean
    onClose: () => void
}) {
    const [detail, setDetail] = React.useState<WorkoutDetail | null>(null)
    const [loading, setLoading] = React.useState(false)

    React.useEffect(() => {
        if (!open || !workoutId) return
        setDetail(null)
        setLoading(true)
        fetch(`/api/workout-logs/${workoutId}?userId=${userId}`)
            .then(r => r.json())
            .then(setDetail)
            .finally(() => setLoading(false))
    }, [open, workoutId, userId])

    const cat = detail?.exercise_templates?.category ?? "other"
    const chipCls = CATEGORY_COLOR[cat] ?? CATEGORY_COLOR.other

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent className="sm:max-w-md max-h-[calc(var(--app-vh,100vh)*0.9)] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {loading ? "Loading…" : (detail?.name ?? "Workout")}
                    </DialogTitle>
                </DialogHeader>

                {loading && (
                    <div className="space-y-3 py-2">
                        {[0,1,2,3].map(i => <div key={i} className="h-10 rounded-xl bg-muted animate-pulse" />)}
                    </div>
                )}

                {!loading && detail && (
                    <div className="space-y-5">
                        {/* Category + source + date */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize", chipCls)}>
                                {detail.exercise_templates?.category ?? "other"}
                            </span>
                            <span className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                detail.source === "polar" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                            )}>
                                {detail.source}
                            </span>
                            <span className="text-[12px] text-muted-foreground ml-auto">
                                {new Date(detail.logged_at).toLocaleDateString("en-SG", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                            </span>
                        </div>

                        {/* GPS map */}
                        {detail.gpx && <GpxMap gpx={detail.gpx} />}

                        {/* Stats */}
                        <div className="bg-card border border-border rounded-2xl px-4">
                            {detail.duration_min != null && detail.duration_min > 0 && (
                                <StatRow
                                    icon={<ClockIcon className="w-4 h-4" />}
                                    label="Duration"
                                    value={`${detail.duration_min} min`}
                                />
                            )}
                            {detail.calories != null && detail.calories > 0 && (
                                <StatRow
                                    icon={<FlameIcon className="w-4 h-4" />}
                                    label="Calories"
                                    value={`${detail.calories} kcal`}
                                />
                            )}
                            {detail.distance_km != null && (
                                <StatRow
                                    icon={<RouteIcon className="w-4 h-4" />}
                                    label="Distance"
                                    value={`${detail.distance_km} km`}
                                />
                            )}
                            {detail.heart_rate_avg != null && (
                                <StatRow
                                    icon={<HeartIcon className="w-4 h-4" />}
                                    label="Avg heart rate"
                                    value={`${detail.heart_rate_avg} bpm`}
                                />
                            )}
                            {detail.sets != null && detail.reps != null && (
                                <StatRow
                                    icon={<LayersIcon className="w-4 h-4" />}
                                    label="Sets × reps"
                                    value={`${detail.sets} × ${detail.reps}`}
                                />
                            )}
                            {detail.rounds != null && (
                                <StatRow
                                    icon={<RepeatIcon className="w-4 h-4" />}
                                    label="Rounds"
                                    value={`${detail.rounds}`}
                                />
                            )}
                        </div>

                        {/* Notes */}
                        {detail.notes && (
                            <div className="bg-muted/40 border border-border rounded-2xl p-4">
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Notes</div>
                                <p className="text-[13px] text-foreground leading-relaxed">{detail.notes}</p>
                            </div>
                        )}

                        {/* Tagged friends */}
                        {detail.tags.length > 0 && (
                            <div>
                                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2.5">Tagged</div>
                                <div className="flex flex-wrap gap-2">
                                    {detail.tags.map(t => (
                                        <div key={t.id} className="flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5">
                                            <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[9px] font-bold flex-shrink-0">
                                                {initials(t.full_name)}
                                            </div>
                                            <span className="text-[12px] font-medium text-foreground">
                                                {[t.rank, t.full_name].filter(Boolean).join(" ")}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
