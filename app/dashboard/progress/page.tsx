'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

type WeightLog = {
    id: string
    weight_kg: number
    body_fat_pct: number | null
    polar_steps: number | null
    polar_calories_burned: number | null
    logged_at: string
}
type UserProfile = {
    weight_kg: number | null
    target_weight_kg: number | null
    weight_goal_date: string | null
    goal_mode: string | null
    height_cm: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function bmi(weight: number, height: number) {
    const h = height / 100
    return weight / (h * h)
}

function trendLine(logs: WeightLog[]): { slope: number; intercept: number } | null {
    if (logs.length < 2) return null
    const n = logs.length
    const xs = logs.map((_, i) => i)
    const ys = logs.map(l => l.weight_kg)
    const sumX = xs.reduce((a, b) => a + b, 0)
    const sumY = ys.reduce((a, b) => a + b, 0)
    const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
    const sumX2 = xs.reduce((acc, x) => acc + x * x, 0)
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    const intercept = (sumY - slope * sumX) / n
    return { slope, intercept }
}

function daysUntilTarget(currentWeight: number, targetWeight: number, weeklyRateKg: number): number | null {
    if (weeklyRateKg === 0) return null
    const diff = Math.abs(targetWeight - currentWeight)
    return Math.round((diff / weeklyRateKg) * 7)
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
    return (
        <div className={cn(
            'rounded-2xl p-4 flex flex-col gap-1 border',
            accent ? 'bg-primary/10 border-primary/20' : 'bg-card border-border',
        )}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className={cn('font-display text-2xl font-extrabold', accent ? 'text-primary' : 'text-foreground')}>{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        </div>
    )
}

function LogWeightModal({ open, currentWeight, currentBodyFat, logId, onLog, onClose }: {
    open: boolean
    currentWeight: number | null
    currentBodyFat: number | null
    logId?: string
    onLog: (w: number, bf: number | null) => Promise<void>
    onClose: () => void
}) {
    const [weight, setWeight] = useState(currentWeight?.toString() ?? '')
    const [bodyFat, setBodyFat] = useState(currentBodyFat?.toString() ?? '')
    const [saving, setSaving] = useState(false)
    const isEdit = !!logId

    const inputCls = 'h-11 rounded-xl border border-border bg-background px-4 text-[15px] font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full'

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                    <DialogTitle>{isEdit ? 'Edit check-in' : "Log today's check-in"}</DialogTitle>
                </DialogHeader>
                <p className="text-[13px] text-muted-foreground -mt-2">Body fat % is optional — log it if you have a reading.</p>
                <div className="space-y-3">
                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Weight</label>
                        <div className="flex items-center gap-2">
                            <input autoFocus type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="72.5" className={inputCls} />
                            <span className="text-[13px] text-muted-foreground font-medium flex-shrink-0">kg</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Body fat % <span className="normal-case tracking-normal font-normal">(optional)</span></label>
                        <div className="flex items-center gap-2">
                            <input type="number" step="0.1" min="1" max="60" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="e.g. 18.5" className={inputCls} />
                            <span className="text-[13px] text-muted-foreground font-medium flex-shrink-0">%</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={async () => {
                            const w = parseFloat(weight)
                            if (!w || w <= 0) return
                            setSaving(true)
                            await onLog(w, bodyFat ? parseFloat(bodyFat) : null)
                            setSaving(false)
                            onClose()
                        }}
                        disabled={saving || !parseFloat(weight)}
                    >
                        {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save check-in'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── Sparkline chart ────────────────────────────────────────────────────────────
function WeightChart({ logs, targetWeight }: { logs: WeightLog[]; targetWeight: number | null }) {
    if (logs.length === 0) return null
    const W = 600; const H = 160; const PAD = { t: 16, r: 16, b: 32, l: 48 }
    const weights = logs.map(l => l.weight_kg)
    const allWeights = targetWeight ? [...weights, targetWeight] : weights
    const minW = Math.min(...allWeights) - 1
    const maxW = Math.max(...allWeights) + 1
    const toX = (i: number) => PAD.l + (i / Math.max(logs.length - 1, 1)) * (W - PAD.l - PAD.r)
    const toY = (w: number) => PAD.t + (1 - (w - minW) / (maxW - minW)) * (H - PAD.t - PAD.b)

    const points = logs.map((l, i) => `${toX(i)},${toY(l.weight_kg)}`).join(' ')
    const area = `M ${toX(0)},${toY(logs[0].weight_kg)} ` +
        logs.map((l, i) => `L ${toX(i)},${toY(l.weight_kg)}`).join(' ') +
        ` L ${toX(logs.length - 1)},${H - PAD.b} L ${toX(0)},${H - PAD.b} Z`

    const trend = trendLine(logs)
    const trendPoints = trend
        ? `${toX(0)},${toY(trend.intercept)} ${toX(logs.length - 1)},${toY(trend.slope * (logs.length - 1) + trend.intercept)}`
        : null

    // Y axis labels
    const yLabels = [minW + 1, (minW + maxW) / 2, maxW - 1].map(w => ({ w: w.toFixed(1), y: toY(w) }))
    // X axis: first and last date
    const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })

    return (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
            <defs>
                <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Y grid lines */}
            {yLabels.map(({ w, y }) => (
                <g key={w}>
                    <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray="4 4" />
                    <text x={PAD.l - 6} y={y + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">{w}</text>
                </g>
            ))}
            {/* Area fill */}
            <path d={area} fill="url(#wg)" />
            {/* Line */}
            <polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {/* Trend line */}
            {trendPoints && (
                <polyline points={trendPoints} fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeDasharray="6 4" opacity="0.5" />
            )}
            {/* Target line */}
            {targetWeight && (
                <>
                    <line x1={PAD.l} y1={toY(targetWeight)} x2={W - PAD.r} y2={toY(targetWeight)}
                        stroke="var(--success)" strokeWidth="1.5" strokeDasharray="5 3" />
                    <text x={W - PAD.r + 4} y={toY(targetWeight) + 4} fontSize="10" fill="var(--success)">Target</text>
                </>
            )}
            {/* Data points */}
            {logs.map((l, i) => (
                <circle key={l.id} cx={toX(i)} cy={toY(l.weight_kg)} r="3.5" fill="var(--primary)" />
            ))}
            {/* X axis labels */}
            <text x={toX(0)} y={H - PAD.b + 14} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                {fmtDate(logs[0].logged_at)}
            </text>
            {logs.length > 1 && (
                <text x={toX(logs.length - 1)} y={H - PAD.b + 14} textAnchor="middle" fontSize="10" fill="var(--muted-foreground)">
                    {fmtDate(logs[logs.length - 1].logged_at)}
                </text>
            )}
        </svg>
    )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ProgressPage() {
    const { user, session } = useAuth()
    const router = useRouter()
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [weightLogs, setWeightLogs] = useState<WeightLog[]>([])
    const [loading, setLoading] = useState(true)
    const [showLogModal, setShowLogModal] = useState(false)
    const [editLog, setEditLog] = useState<WeightLog | null>(null)
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
    const [range, setRange] = useState<30 | 60 | 90>(90)

    const fetchData = useCallback(async () => {
        if (!user) return
        const [{ data: prof }, logsRes] = await Promise.all([
            supabase.from('users').select('weight_kg, target_weight_kg, weight_goal_date, goal_mode, height_cm').eq('id', user.id).single(),
            fetch(`/api/weight-logs?userId=${user.id}&days=${range}`).then(r => r.json()),
        ])
        setProfile(prof)
        setWeightLogs(Array.isArray(logsRes) ? logsRes : [])
        setLoading(false)
    }, [user, range])

    useEffect(() => { fetchData() }, [fetchData])

    const logWeight = async (weight_kg: number, body_fat_pct: number | null) => {
        await fetch('/api/weight-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ userId: user?.id, weight_kg, body_fat_pct }),
        })
        await supabase.from('users').update({ weight_kg }).eq('id', user!.id)
        fetchData()
    }

    const editWeight = async (weight_kg: number, body_fat_pct: number | null) => {
        if (!editLog) return
        await fetch(`/api/weight-logs?id=${editLog.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
            body: JSON.stringify({ weight_kg, body_fat_pct }),
        })
        fetchData()
    }

    const deleteWeight = async (id: string) => {
        await fetch(`/api/weight-logs?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
        setWeightLogs(prev => prev.filter(l => l.id !== id))
        setDeleteConfirmId(null)
    }

    const hasGoal = profile?.target_weight_kg != null
    const latestLog = weightLogs.length > 0 ? weightLogs[weightLogs.length - 1] : null
    const currentWeight = latestLog?.weight_kg ?? profile?.weight_kg ?? null
    const latestBodyFat = latestLog?.body_fat_pct ?? null
    // Latest Polar data (most recent log that has it)
    const latestPolar = [...weightLogs].reverse().find(l => l.polar_steps != null || l.polar_calories_burned != null) ?? null

    // Computed stats
    const startWeight = weightLogs.length > 0 ? weightLogs[0].weight_kg : null
    const totalChange = currentWeight != null && startWeight != null ? currentWeight - startWeight : null

    // Weekly rate from trend
    const trend = weightLogs.length >= 2 ? trendLine(weightLogs) : null
    // slope is kg per index; indices are daily logs so this is per-log not per-day
    // compute actual days per log
    const avgDaysBetweenLogs = weightLogs.length >= 2
        ? (new Date(weightLogs[weightLogs.length - 1].logged_at).getTime() - new Date(weightLogs[0].logged_at).getTime())
          / (1000 * 60 * 60 * 24 * (weightLogs.length - 1))
        : 1
    const weeklyRateKg = trend ? Math.abs(trend.slope / avgDaysBetweenLogs * 7) : 0

    const projectedDays = hasGoal && currentWeight && weeklyRateKg > 0
        ? daysUntilTarget(currentWeight, profile!.target_weight_kg!, weeklyRateKg)
        : null

    const bmiVal = currentWeight && profile?.height_cm ? bmi(currentWeight, profile.height_cm) : null
    const bmiLabel = bmiVal == null ? '—' : bmiVal < 18.5 ? 'Underweight' : bmiVal < 25 ? 'Healthy' : bmiVal < 30 ? 'Overweight' : 'Obese'

    // Personalised tip
    function getTip(): string {
        if (!hasGoal || !currentWeight) return 'Set a body target in Settings → Goal to get personalised feedback.'
        const diff = profile!.target_weight_kg! - currentWeight
        const mode = profile?.goal_mode ?? 'bulk'
        if (Math.abs(diff) < 0.5) return "You're essentially at your target — focus on maintaining consistency."
        if (diff < 0) {
            // Losing weight
            if (weeklyRateKg > 1) return "You're losing weight faster than 1 kg/week — make sure you're eating enough protein to preserve muscle."
            if (weeklyRateKg < 0.2) return 'Progress is slow. Try tightening your calorie target by 100–200 kcal/day.'
            return 'Solid rate of loss. Keep protein high to retain muscle while in a deficit.'
        } else {
            // Gaining
            if (weeklyRateKg > 0.8) return "Gaining quickly — some may be fat. Consider slowing to 0.25–0.5 kg/week for a cleaner bulk."
            if (weeklyRateKg < 0.1) return `Not gaining much. If you're on ${mode === 'bulk' ? 'a bulk' : 'a gain phase'}, try adding 200 kcal/day.`
            return 'Good rate of gain. Hit your protein target daily to maximise muscle growth.'
        }
    }

    if (loading) return (
        <div className="px-4 sm:px-8 pt-16 sm:pt-8 pb-12 max-w-2xl mx-auto space-y-6">
            <Skeleton className="h-8 w-36" />
            <div className="grid grid-cols-2 gap-3">
                {[0,1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
        </div>
    )

    // No goal set → prompt
    if (!hasGoal) return (
        <div className="px-4 sm:px-8 pt-16 sm:pt-8 pb-12 max-w-2xl mx-auto">
            <h1 className="font-display text-3xl font-extrabold text-foreground mb-1">Progress</h1>
            <p className="text-sm text-muted-foreground mb-8">Track your weight and body composition over time.</p>
            <div className="bg-card border border-dashed border-border rounded-2xl p-10 flex flex-col items-center gap-4 text-center">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                </div>
                <div>
                    <div className="font-semibold text-foreground mb-1">No body target set</div>
                    <p className="text-sm text-muted-foreground max-w-xs">Set a target weight in Settings to start tracking your progress here.</p>
                </div>
                <Button
                    className="mt-2"
                    onClick={() => router.push('/dashboard/settings?tab=goal')}
                >
                    Set body target
                </Button>
            </div>
        </div>
    )

    return (
        <div className="px-4 sm:px-8 pt-16 sm:pt-16 sm:pt-8 pb-12 max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="font-display text-3xl font-extrabold text-foreground mb-0.5">Progress</h1>
                    <p className="text-sm text-muted-foreground">Weight tracking and body composition.</p>
                </div>
                <Button
                    onClick={() => setShowLogModal(true)}
                    prefixIcon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
                >
                    Log weight
                </Button>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    label="Current weight"
                    value={currentWeight ? `${currentWeight} kg` : '—'}
                    sub={bmiVal ? `BMI ${bmiVal.toFixed(1)} · ${bmiLabel}` : undefined}
                    accent
                />
                <StatCard
                    label="Body fat"
                    value={latestBodyFat != null ? `${latestBodyFat}%` : '—'}
                    sub={latestBodyFat != null
                        ? latestBodyFat < 10 ? 'Essential / Athletic'
                          : latestBodyFat < 18 ? 'Fit'
                          : latestBodyFat < 25 ? 'Average'
                          : 'Above average'
                        : 'Log to track'}
                />
                <StatCard
                    label={totalChange != null && totalChange < 0 ? 'Lost so far' : 'Gained so far'}
                    value={totalChange != null ? `${Math.abs(totalChange).toFixed(1)} kg` : '—'}
                    sub={weightLogs.length > 0 ? `over ${weightLogs.length} check-ins` : 'No logs yet'}
                />
                <StatCard
                    label="Projected arrival"
                    value={projectedDays != null ? `${projectedDays}d` : '—'}
                    sub={projectedDays != null
                        ? `~${weeklyRateKg.toFixed(2)} kg/week`
                        : weightLogs.length < 2 ? 'Log 2+ entries' : 'On target'}
                />
            </div>

            {/* Polar summary — only show if data exists */}
            {latestPolar && (
                <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Latest Polar data</div>
                        <div className="flex items-center gap-4 flex-wrap">
                            {latestPolar.polar_steps != null && (
                                <span className="text-[13px] font-semibold text-foreground">{latestPolar.polar_steps.toLocaleString()} steps</span>
                            )}
                            {latestPolar.polar_calories_burned != null && (
                                <span className="text-[13px] font-semibold text-foreground">{Math.round(latestPolar.polar_calories_burned)} kcal burned</span>
                            )}
                        </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground flex-shrink-0">
                        {new Date(latestPolar.logged_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}
                    </div>
                </div>
            )}

            {/* Chart */}
            <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="text-[13px] font-semibold text-foreground">Weight over time</div>
                    <div className="flex items-center bg-muted dark:bg-[#091E42] rounded-full p-0.5 gap-0.5">
                        {([30, 60, 90] as const).map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={cn(
                                    'px-3 py-1 rounded-full text-[12px] font-medium transition-all',
                                    range === r
                                        ? 'bg-card dark:bg-[#1F3460] text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {r}d
                            </button>
                        ))}
                    </div>
                </div>
                {weightLogs.length === 0 ? (
                    <div className="h-36 flex flex-col items-center justify-center gap-2 text-center">
                        <p className="text-sm text-muted-foreground">No weight logs in this period.</p>
                        <button onClick={() => setShowLogModal(true)} className="text-sm text-primary font-medium">Log your first entry</button>
                    </div>
                ) : (
                    <WeightChart logs={weightLogs} targetWeight={profile!.target_weight_kg} />
                )}
            </div>

            {/* Progress toward target */}
            {currentWeight && profile!.target_weight_kg && (() => {
                const start = startWeight ?? profile!.weight_kg ?? currentWeight
                const target = profile!.target_weight_kg!
                const totalNeeded = Math.abs(target - start)
                const done = Math.abs(currentWeight - start)
                const pct = totalNeeded > 0 ? Math.min(100, (done / totalNeeded) * 100) : 100
                const losing = target < start
                return (
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-[13px] font-semibold text-foreground">Goal progress</div>
                            <span className="text-[12px] font-semibold text-primary">{pct.toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                            <div
                                className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, background: losing ? 'var(--danger)' : 'var(--primary)' }}
                            />
                        </div>
                        <div className="flex justify-between text-[11px] text-muted-foreground">
                            <span>Start: {start.toFixed(1)} kg</span>
                            <span>Target: {target.toFixed(1)} kg</span>
                        </div>
                    </div>
                )
            })()}

            {/* Personalised tip */}
            <div className="rounded-2xl p-5 flex gap-4" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' }}>
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                </div>
                <div>
                    <div className="text-[11px] font-bold uppercase tracking-widest text-white/60 mb-1">Personalised tip</div>
                    <div className="text-[13px] text-white leading-relaxed">{getTip()}</div>
                </div>
            </div>

            {/* Recent log */}
            {weightLogs.length > 0 && (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-border">
                        <span className="text-[13px] font-semibold text-foreground">Recent check-ins</span>
                    </div>
                    {[...weightLogs].reverse().slice(0, 10).map((log) => {
                        const origIdx = weightLogs.indexOf(log)
                        const prev = weightLogs[origIdx - 1]
                        const delta = prev ? log.weight_kg - prev.weight_kg : null
                        const isConfirmingDelete = deleteConfirmId === log.id
                        return (
                            <div key={log.id} className="px-5 py-3 border-b border-border last:border-0">
                                {isConfirmingDelete ? (
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-[12px] text-muted-foreground">Delete {log.weight_kg} kg on {new Date(log.logged_at).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })}?</span>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button onClick={() => setDeleteConfirmId(null)} className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1">Cancel</button>
                                            <button onClick={() => deleteWeight(log.id)} className="text-[12px] font-semibold text-white bg-danger rounded-lg px-3 py-1 hover:bg-danger/90 transition-colors">Delete</button>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="flex items-center justify-between">
                                            <span className="text-[13px] text-muted-foreground">
                                                {new Date(log.logged_at).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                {delta != null && (
                                                    <span className={cn('text-[11px] font-medium', delta < 0 ? 'text-success' : delta > 0 ? 'text-danger' : 'text-muted-foreground')}>
                                                        {delta > 0 ? '+' : ''}{delta.toFixed(1)} kg
                                                    </span>
                                                )}
                                                <span className="text-[13px] font-bold text-foreground tabular-nums">{log.weight_kg} kg</span>
                                                <button
                                                    onClick={() => setEditLog(log)}
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                                                    title="Edit"
                                                >
                                                    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(log.id)}
                                                    className="p-1.5 rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                                                    title="Delete"
                                                >
                                                    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                                </button>
                                            </div>
                                        </div>
                                        {(log.body_fat_pct != null || log.polar_steps != null || log.polar_calories_burned != null) && (
                                            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                                {log.body_fat_pct != null && (
                                                    <span className="text-[11px] text-muted-foreground">{log.body_fat_pct}% body fat</span>
                                                )}
                                                {log.polar_steps != null && (
                                                    <span className="text-[11px] text-muted-foreground">{log.polar_steps.toLocaleString()} steps</span>
                                                )}
                                                {log.polar_calories_burned != null && (
                                                    <span className="text-[11px] text-muted-foreground">{Math.round(log.polar_calories_burned)} kcal burned</span>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            <LogWeightModal
                open={showLogModal}
                currentWeight={currentWeight}
                currentBodyFat={latestBodyFat}
                onLog={logWeight}
                onClose={() => setShowLogModal(false)}
            />

            <LogWeightModal
                open={!!editLog}
                logId={editLog?.id}
                currentWeight={editLog?.weight_kg ?? null}
                currentBodyFat={editLog?.body_fat_pct ?? null}
                onLog={editWeight}
                onClose={() => setEditLog(null)}
            />
        </div>
    )
}
