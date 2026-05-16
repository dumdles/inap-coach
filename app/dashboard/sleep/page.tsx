'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { LogSleepDialog, SleepLog as LogSleepDialogLog } from '@/components/sleep/log-sleep-dialog'
import { AppleHealthImportDialog } from '@/components/sleep/apple-health-import-dialog'
import { recoveryReadiness, sleepDebtHours, type ReadinessLevel } from '@/lib/scoring'
import {
    MoonIcon, RefreshCwIcon, PlusIcon, HeartIcon, ZapIcon, FootprintsIcon,
    AppleIcon, PencilIcon, Trash2Icon, ChevronDownIcon, BookOpenIcon, ClockIcon,
    GaugeIcon, ActivityIcon, TrendingUpIcon, TrendingDownIcon, MinusIcon,
} from 'lucide-react'
import {
    BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine,
} from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────

type SleepLog = {
    id: string
    source: 'manual' | 'polar' | 'apple_health'
    night_date: string
    sleep_start: string
    sleep_end: string
    duration_min: number
    sleep_score: number | null
    ans_charge_status: number | null
    deep_min: number | null
    rem_min: number | null
    light_min: number | null
    awake_min: number | null
    heart_rate_avg: number | null
    hrv_avg: number | null
    rating: number | null
    notes: string | null
    polar_date: string | null
    created_at: string
}

type SleepSettings = {
    target_hours: number
    target_bedtime: string | null
    target_wake_time: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────

function durationLabel(min: number | null | undefined): string {
    if (!min || min <= 0) return '—'
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h}h ${m.toString().padStart(2, '0')}m`
}

function timeOfDay(iso: string): string {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function shortDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
}

const ANS_LABEL: Record<number, string> = {
    1: 'Much below usual',
    2: 'Below usual',
    3: 'Usual',
    4: 'Above usual',
    5: 'Much above usual',
}

const ANS_TONE: Record<number, string> = {
    1: 'text-danger',
    2: 'text-warning-dark',
    3: 'text-muted-foreground',
    4: 'text-success-dark',
    5: 'text-success',
}

const READINESS_THEME: Record<ReadinessLevel, { gradient: string; iconBg: string; shadowVar: string }> = {
    go:      { gradient: 'linear-gradient(135deg, var(--color-success) 0%, var(--color-success-dark) 100%)',   iconBg: 'bg-white/20', shadowVar: 'var(--color-success)' },
    normal:  { gradient: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',    iconBg: 'bg-white/20', shadowVar: 'var(--color-primary)' },
    caution: { gradient: 'linear-gradient(135deg, var(--color-warning) 0%, var(--color-warning-dark) 100%)',    iconBg: 'bg-white/20', shadowVar: 'var(--color-warning)' },
    rest:    { gradient: 'linear-gradient(135deg, var(--color-danger) 0%, var(--color-danger-dark) 100%)',      iconBg: 'bg-white/20', shadowVar: 'var(--color-danger)' },
}

// ── Sleep School content ──────────────────────────────────────────────────

const SLEEP_SCHOOL = [
    {
        id: 'sleep-score',
        title: 'What is a "sleep score"?',
        icon: GaugeIcon,
        summary: 'A 0–100 score that blends how long, how continuously, and how restoratively you slept.',
        body: `Polar combines three signals: duration (did you get enough?), continuity (did you stay asleep?), and actual sleep (the time you spent in deep + REM, not just lying in bed).

A score of 85+ means a strong recovery night. 70–84 is solid. 60–69 is a warning — your brain and muscles got partial restoration. Below 60 means a rough night, and you should respect it: skip max-effort training, hydrate, eat well, and protect tonight.

The number isn't a grade — it's information. One bad night won't ruin a week, but a pattern of low scores tells you something is off (caffeine timing, alcohol, screens, stress, bunk environment).`,
    },
    {
        id: 'ans-recharge',
        title: 'ANS Recharge & training readiness',
        icon: ZapIcon,
        summary: 'Your nervous system\'s overnight recovery score — the single best predictor of how hard you can push tomorrow.',
        body: `Your Autonomic Nervous System (ANS) controls your heart rate, breathing, and stress response. Polar measures how it behaves in the first 4 hours of sleep — that\'s when it does its recovery work.

"Above usual" or "much above usual" = your body absorbed yesterday's training and is primed for hard work. Hit your intervals, attempt that PR, run your hardest tempo.

"Usual" = baseline. Train normally.

"Below usual" or "much below usual" = your nervous system is still under load. High-intensity training now compounds the fatigue and risks injury. Switch to active recovery: light cardio, mobility, technique drills.

For cadets: ANS Recharge is what tells you whether you can suffer well today — or whether you should bank the recovery for the field exercise on Thursday.`,
    },
    {
        id: 'tactical-sleep',
        title: 'Tactical sleep for cadets',
        icon: FootprintsIcon,
        summary: 'Sleep banking, the 20-min nap, and caffeine timing — operational sleep tools.',
        body: `Sleep banking: the 2 nights before a night exercise or sustained-ops scenario, sleep 9 hours instead of 7.5. Research from US Army labs shows banking measurably blunts performance loss when you're sleep-deprived later.

The 20-minute nap: if you can sleep at all between 13:00–15:00, do it. Keep it ≤20 min — long enough to take the edge off, short enough that you don't enter deep sleep and wake up groggy ("sleep inertia"). Set an alarm.

Caffeine cutoff: caffeine has a 5–6h half-life. A 16:00 coffee = ~50% still circulating at 22:00. Cut hard caffeine by 14:00 if you want to be asleep by 22:30.

Alcohol on weekends: even 2 drinks reduces REM by 25%. You'll fall asleep faster but recover less. Saturday nights cost you Sunday training quality.

Light discipline: bright phone screens after 21:00 suppress melatonin by ~50%. Use Night Shift / Dark Mode aggressively or — better — read a paperback.`,
    },
    {
        id: 'sleep-stages',
        title: 'Sleep stages 101',
        icon: ActivityIcon,
        summary: 'Deep sleep = physical recovery. REM = motor learning. You need both — and they happen on different parts of the night.',
        body: `Each night cycles through 4–6 cycles of ~90 min, each containing light → deep → REM sleep.

Deep sleep (your "stage 3" / "slow wave"): peaks in the FIRST half of the night. Growth hormone surges, your muscles repair, your immune system resets. This is where the gym work consolidates. ~15–25% of total sleep is the target.

REM sleep: peaks in the SECOND half of the night. This is where your brain consolidates motor skills — drill movements, weapon handling, navigation patterns. It's also where memory and emotional regulation get processed. ~20–25% is the target.

The trap: if you go to bed at 01:00 and wake at 06:00, you cut the back half of the night — the REM half. Your physical recovery looks fine, but your skill learning and emotional resilience took a hit. This is why "I sleep 5 hours and feel OK" is a lie your body tells you for a few days, then catches up with.`,
    },
    {
        id: 'four-enemies',
        title: 'The 4 enemies of sleep at camp',
        icon: MoonIcon,
        summary: 'Late caffeine, weekend alcohol, blue light past 22:00, and inconsistent schedule.',
        body: `1. Late caffeine. Singapore cookhouse coffee at 17:00 is still 25% active when you're trying to sleep at 22:00. Tea isn't much better. Switch to water or decaf after lunch.

2. Weekend alcohol. Even moderate drinking on Saturday flattens your REM. Sunday workouts feel harder, Monday cookhouse food sits heavy, and your week starts from a deficit. You don't have to be a monk — just know what it costs.

3. Blue light past 22:00. Phone screens are the biggest culprit. Your retinas read blue light as "daylight" and your brain delays melatonin. Result: you "feel tired" but can't fall asleep. Fixes (in order of effectiveness): paperback book, dim red lamp, phone in greyscale + Night Shift, blue-blocker glasses.

4. Inconsistent schedule. Sleeping 22:00–06:00 on weekdays and 02:00–10:00 on weekends gives you "social jet lag" — your body never settles into a rhythm. Aim to keep weekend bedtime within ~90 min of weekday bedtime, even if you're out late.`,
    },
] as const

// ── Sub-components ────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">{title}</h2>
            <div className="flex-1 h-px bg-border" />
        </div>
    )
}

function StatCard({
    label, value, unit, sub, tone = 'primary', icon, delay = 0,
}: {
    label: string
    value: string | number
    unit?: string
    sub?: string
    tone?: 'primary' | 'success' | 'warning' | 'danger'
    icon?: React.ReactNode
    delay?: number
}) {
    const toneCls = {
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success-light text-success-dark',
        warning: 'bg-warning-light text-warning-dark',
        danger:  'bg-danger-light text-danger-dark',
    }[tone]
    return (
        <div
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300"
            style={{ animationDelay: `${delay}ms`, animationFillMode: 'both', boxShadow: '0 1px 4px rgba(9,30,66,0.05)' }}
        >
            <div className="flex items-center justify-between gap-3">
                <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', toneCls)}>{icon}</div>
                <div className="flex-1 text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
                    <div className="mt-0.5 flex items-baseline gap-1 justify-end">
                        <span className="font-display text-2xl font-extrabold text-foreground tabular-nums">{value}</span>
                        {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
                    </div>
                </div>
            </div>
            {sub && <p className="text-[11px] text-muted-foreground leading-relaxed">{sub}</p>}
        </div>
    )
}

// ── Sleep School card (expandable) ────────────────────────────────────────

function SleepSchoolCard({
    item, expanded, onToggle,
}: {
    item: typeof SLEEP_SCHOOL[number]
    expanded: boolean
    onToggle: () => void
}) {
    const Icon = item.icon
    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-muted/30 transition-colors"
            >
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-foreground">{item.title}</div>
                    <p className="text-[12px] text-muted-foreground mt-0.5 leading-relaxed">{item.summary}</p>
                </div>
                <ChevronDownIcon
                    className={cn('w-4 h-4 text-muted-foreground flex-shrink-0 mt-1 transition-transform duration-200', expanded && 'rotate-180')}
                />
            </button>
            {expanded && (
                <div className="px-5 pb-5 -mt-1 border-t border-border/50">
                    <div className="pt-4 text-[13px] text-foreground leading-relaxed whitespace-pre-line">
                        {item.body}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Recovery Readiness card ───────────────────────────────────────────────

function ReadinessCard({ log }: { log: SleepLog | null }) {
    const assessment = useMemo(() => recoveryReadiness(
        log?.duration_min ?? null,
        log?.sleep_score ?? null,
        log?.ans_charge_status ?? null,
    ), [log])

    if (!log) {
        return (
            <div className="rounded-2xl p-5 flex items-center gap-4 border border-dashed border-border bg-card">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <MoonIcon className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-semibold text-foreground">No sleep data yet</div>
                    <p className="text-[12px] text-muted-foreground mt-0.5">Log last night or sync your Polar watch to see your recovery readiness.</p>
                </div>
            </div>
        )
    }

    const theme = READINESS_THEME[assessment.level]
    return (
        <div
            className="rounded-2xl p-5 flex items-start gap-4 text-white animate-in fade-in slide-in-from-bottom-3 duration-300"
            style={{
                background: theme.gradient,
                boxShadow: `0 4px 20px color-mix(in srgb, ${theme.shadowVar} 30%, transparent)`,
                animationFillMode: 'both',
            }}
        >
            <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0', theme.iconBg)}>
                <ZapIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-white/70 mb-0.5">Recovery Readiness</div>
                <div className="font-display text-lg font-extrabold text-white leading-tight">{assessment.headline}</div>
                <p className="text-[12px] text-white/80 mt-1.5 leading-relaxed">{assessment.detail}</p>
                <div className="mt-3 flex items-center gap-3 flex-wrap text-[11px] text-white/70">
                    <span><strong className="text-white">{durationLabel(log.duration_min)}</strong> slept</span>
                    {log.sleep_score != null && <span>· Score <strong className="text-white">{log.sleep_score}</strong></span>}
                    {log.ans_charge_status != null && <span>· ANS <strong className="text-white">{ANS_LABEL[log.ans_charge_status].toLowerCase()}</strong></span>}
                </div>
            </div>
        </div>
    )
}

// ── 14-day duration trend chart ───────────────────────────────────────────

function DurationTrend({ logs, targetHours }: { logs: SleepLog[]; targetHours: number }) {
    // Build last 14 days, oldest first, filling gaps with 0
    const data = useMemo(() => {
        const map = new Map<string, SleepLog>()
        for (const log of logs) map.set(log.night_date, log)
        const out: { date: string; hours: number; label: string }[] = []
        for (let i = 13; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const key = d.toISOString().slice(0, 10)
            const log = map.get(key)
            out.push({
                date: key,
                hours: log ? +(log.duration_min / 60).toFixed(2) : 0,
                label: d.toLocaleDateString('en-SG', { weekday: 'short' })[0],
            })
        }
        return out
    }, [logs])

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-[13px] font-semibold text-foreground">14-day sleep trend</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Hours per night vs your {targetHours}h target</p>
                </div>
            </div>
            <div className="h-44 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <XAxis
                            dataKey="label"
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            interval={0}
                        />
                        <YAxis
                            stroke="var(--color-muted-foreground)"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            domain={[0, 12]}
                            ticks={[0, 4, 8, 12]}
                            unit="h"
                            width={28}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }}
                            content={({ active, payload }) => {
                                if (!active || !payload?.length) return null
                                const datum = payload[0].payload as { date: string; hours: number }
                                return (
                                    <div className="bg-popover border border-border rounded-lg shadow-md px-3 py-2 text-[12px]">
                                        <div className="font-semibold text-foreground">{shortDate(datum.date)}</div>
                                        <div className="text-muted-foreground">{datum.hours > 0 ? `${datum.hours.toFixed(1)}h slept` : 'No data'}</div>
                                    </div>
                                )
                            }}
                        />
                        <ReferenceLine y={targetHours} stroke="var(--color-primary)" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <Bar
                            dataKey="hours"
                            radius={[6, 6, 0, 0]}
                            fill="var(--color-primary)"
                            fillOpacity={0.85}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

// ── Sleep debt + bedtime nudge ────────────────────────────────────────────

function SleepDebtCard({ logs, targetHours }: { logs: SleepLog[]; targetHours: number }) {
    const last7 = useMemo(() => {
        const map = new Map<string, SleepLog>()
        for (const log of logs) map.set(log.night_date, log)
        const arr: number[] = []
        for (let i = 6; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            const log = map.get(d.toISOString().slice(0, 10))
            arr.push(log?.duration_min ?? 0)
        }
        return arr
    }, [logs])

    const debt = sleepDebtHours(last7, targetHours)
    const surplus = debt < 0

    return (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', surplus ? 'bg-success-light text-success-dark' : 'bg-warning-light text-warning-dark')}>
                {surplus ? <TrendingUpIcon className="w-4 h-4" /> : <TrendingDownIcon className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">7-day sleep debt</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-display text-xl font-extrabold text-foreground tabular-nums">{Math.abs(debt)}h</span>
                    <span className="text-[11px] text-muted-foreground">{surplus ? 'banked' : 'short'}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {surplus
                        ? 'You\'re ahead of your target — keep the rhythm steady.'
                        : debt < 4
                            ? 'Mild deficit. Add 30 min tonight to flatten it.'
                            : 'Significant deficit. Aim for 9h on the next non-camp night.'}
                </p>
            </div>
        </div>
    )
}

function BedtimeNudgeCard({ settings }: { settings: SleepSettings }) {
    const target = settings.target_bedtime
    if (!target) {
        return (
            <div className="bg-card border border-dashed border-border rounded-2xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
                    <ClockIcon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-semibold text-foreground">Set a bedtime target</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Tap &ldquo;Settings&rdquo; above to set a target bedtime — we&apos;ll nudge you with a countdown each evening.
                    </p>
                </div>
            </div>
        )
    }

    // Compute minutes until target bedtime (today)
    const now = new Date()
    const [hh, mm] = target.split(':').map(n => parseInt(n, 10))
    const tgt = new Date()
    tgt.setHours(hh, mm, 0, 0)
    if (tgt < now) tgt.setDate(tgt.getDate() + 1)
    const minsUntil = Math.round((tgt.getTime() - now.getTime()) / 60000)
    const hours = Math.floor(minsUntil / 60)
    const mins = minsUntil % 60

    const within2h = minsUntil <= 120
    return (
        <div className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', within2h ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                <MoonIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Target bedtime</div>
                <div className="mt-0.5 flex items-baseline gap-2">
                    <span className="font-display text-xl font-extrabold text-foreground tabular-nums">{target.slice(0, 5)}</span>
                    <span className="text-[11px] text-muted-foreground">in {hours > 0 ? `${hours}h ` : ''}{mins}m</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    {within2h
                        ? 'Wind-down time: dim lights, cut caffeine, screens away.'
                        : 'Plan your evening so you can be in bed on time.'}
                </p>
            </div>
        </div>
    )
}

// ── Sleep stages breakdown (when Polar / Apple Health has staged data) ───

function StageBreakdown({ log }: { log: SleepLog }) {
    const total = (log.deep_min ?? 0) + (log.rem_min ?? 0) + (log.light_min ?? 0)
    if (total === 0) return null

    const deepPct = ((log.deep_min ?? 0) / total) * 100
    const remPct = ((log.rem_min ?? 0) / total) * 100
    const lightPct = ((log.light_min ?? 0) / total) * 100

    return (
        <div className="mt-3 space-y-2">
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
                <div style={{ width: `${deepPct}%` }} className="bg-primary" title={`Deep ${log.deep_min}m`} />
                <div style={{ width: `${remPct}%` }} className="bg-primary/60" title={`REM ${log.rem_min}m`} />
                <div style={{ width: `${lightPct}%` }} className="bg-primary/30" title={`Light ${log.light_min}m`} />
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Deep {log.deep_min ?? 0}m</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/60" /> REM {log.rem_min ?? 0}m</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary/30" /> Light {log.light_min ?? 0}m</span>
                {log.awake_min != null && log.awake_min > 0 && (
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning" /> Awake {log.awake_min}m</span>
                )}
            </div>
        </div>
    )
}

// ── Settings popover (target hours + bedtime + waketime) ──────────────────

function SettingsPopover({
    settings, onSave, onClose,
}: {
    settings: SleepSettings
    onSave: (s: SleepSettings) => Promise<void>
    onClose: () => void
}) {
    const [hours, setHours] = useState(settings.target_hours.toString())
    const [bedtime, setBedtime] = useState(settings.target_bedtime?.slice(0, 5) ?? '22:30')
    const [wake, setWake] = useState(settings.target_wake_time?.slice(0, 5) ?? '06:00')
    const [saving, setSaving] = useState(false)

    async function save() {
        setSaving(true)
        await onSave({
            target_hours: parseFloat(hours) || 7.5,
            target_bedtime: bedtime,
            target_wake_time: wake,
        })
        setSaving(false)
        onClose()
    }

    return (
        <div className="bg-popover border border-border rounded-2xl shadow-lg p-4 w-72 space-y-3">
            <div className="text-[13px] font-semibold text-foreground">Sleep targets</div>
            <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Target hours</label>
                <input
                    type="number" min="4" max="12" step="0.5"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
                />
            </div>
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Bedtime</label>
                    <input
                        type="time"
                        value={bedtime}
                        onChange={e => setBedtime(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
                    />
                </div>
                <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Wake</label>
                    <input
                        type="time"
                        value={wake}
                        onChange={e => setWake(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px]"
                    />
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={onClose} className="text-[12px] text-muted-foreground hover:text-foreground px-3 py-1.5">Cancel</button>
                <button
                    onClick={save}
                    disabled={saving}
                    className="text-[12px] font-semibold rounded-full bg-primary text-white px-3.5 py-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {saving ? 'Saving…' : 'Save'}
                </button>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function SleepPage() {
    const { user } = useAuth()

    const [logs, setLogs] = useState<SleepLog[]>([])
    const [logsLoading, setLogsLoading] = useState(true)
    const [settings, setSettings] = useState<SleepSettings>({ target_hours: 7.5, target_bedtime: null, target_wake_time: null })
    const [polarSyncing, setPolarSyncing] = useState(false)
    const [logDialogOpen, setLogDialogOpen] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [editingLog, setEditingLog] = useState<SleepLog | null>(null)
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [expandedLesson, setExpandedLesson] = useState<string | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)

    const fetchLogs = useCallback(async () => {
        if (!user?.id) return
        setLogsLoading(true)
        const res = await fetch(`/api/sleep-logs?userId=${user.id}&limit=90`)
        const data = await res.json()
        setLogs(Array.isArray(data) ? data : [])
        setLogsLoading(false)
    }, [user?.id])

    const fetchSettings = useCallback(async () => {
        if (!user?.id) return
        const res = await fetch(`/api/sleep-logs/settings?userId=${user.id}`)
        const data = await res.json()
        if (data) setSettings(data)
    }, [user?.id])

    useEffect(() => { fetchLogs(); fetchSettings() }, [fetchLogs, fetchSettings])

    const syncPolar = useCallback(async () => {
        if (!user?.id) return
        setPolarSyncing(true)
        try {
            await fetch(`/api/polar/sleep?userId=${user.id}`)
            await fetchLogs()
        } finally {
            setPolarSyncing(false)
        }
    }, [user?.id, fetchLogs])

    async function handleDelete(id: string) {
        await fetch(`/api/sleep-logs?id=${id}`, { method: 'DELETE' })
        setLogs(prev => prev.filter(l => l.id !== id))
        setConfirmDeleteId(null)
    }

    async function saveSettings(s: SleepSettings) {
        await fetch('/api/sleep-logs/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user?.id, ...s }),
        })
        setSettings(s)
    }

    // Derived stats
    const lastNight = logs[0] ?? null
    const last7 = logs.slice(0, 7)
    const avg7DayMin = last7.length
        ? Math.round(last7.reduce((s, l) => s + l.duration_min, 0) / last7.length)
        : 0
    const scoredLogs = logs.filter(l => l.sleep_score != null).slice(0, 7)
    const avg7DayScore = scoredLogs.length
        ? Math.round(scoredLogs.reduce((s, l) => s + (l.sleep_score ?? 0), 0) / scoredLogs.length)
        : null
    const ansLogs = logs.filter(l => l.ans_charge_status != null).slice(0, 7)
    const avgAns = ansLogs.length
        ? Math.round(ansLogs.reduce((s, l) => s + (l.ans_charge_status ?? 0), 0) / ansLogs.length)
        : null

    return (
        <div className="px-4 sm:px-8 pt-16 sm:pt-8 pb-24 max-w-2xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                    <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground leading-none">Sleep</h1>
                    <p className="text-sm text-muted-foreground mt-1.5">Recovery is when training actually happens.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative">
                        <button
                            onClick={() => setSettingsOpen(o => !o)}
                            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                            title="Sleep targets"
                        >
                            <ClockIcon className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Settings</span>
                        </button>
                        {settingsOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 z-40">
                                    <SettingsPopover settings={settings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={() => setLogDialogOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white hover:bg-primary/90 transition-colors"
                    >
                        <PlusIcon className="w-3.5 h-3.5" />
                        Log sleep
                    </button>
                </div>
            </div>

            {/* Recovery Readiness — the headline */}
            <ReadinessCard log={lastNight} />

            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
                <StatCard
                    label="Last night"
                    value={lastNight ? durationLabel(lastNight.duration_min) : '—'}
                    sub={lastNight ? `${timeOfDay(lastNight.sleep_start)} → ${timeOfDay(lastNight.sleep_end)}` : 'Log a session to start'}
                    tone="primary"
                    icon={<MoonIcon className="w-4 h-4" />}
                    delay={60}
                />
                <StatCard
                    label="7-day avg"
                    value={avg7DayMin > 0 ? durationLabel(avg7DayMin) : '—'}
                    sub={settings.target_hours ? `Target ${settings.target_hours}h/night` : 'Set a target in Settings'}
                    tone="success"
                    icon={<TrendingUpIcon className="w-4 h-4" />}
                    delay={120}
                />
                <StatCard
                    label="Sleep score"
                    value={avg7DayScore != null ? avg7DayScore : '—'}
                    unit={avg7DayScore != null ? '/100' : ''}
                    sub={avg7DayScore != null
                        ? avg7DayScore >= 80 ? 'Strong recovery week' : avg7DayScore >= 60 ? 'Solid — room to grow' : 'Recovery is suffering'
                        : 'Sync Polar to track this'}
                    tone="warning"
                    icon={<GaugeIcon className="w-4 h-4" />}
                    delay={180}
                />
                <StatCard
                    label="ANS recharge"
                    value={avgAns != null ? ANS_LABEL[avgAns].split(' ')[0] : '—'}
                    sub={avgAns != null
                        ? `Avg of last ${ansLogs.length} nights`
                        : 'Available with Polar sync'}
                    tone={avgAns != null && avgAns >= 4 ? 'success' : avgAns != null && avgAns <= 2 ? 'danger' : 'primary'}
                    icon={<ZapIcon className="w-4 h-4" />}
                    delay={240}
                />
            </div>

            {/* Debt + bedtime nudge */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <SleepDebtCard logs={logs} targetHours={settings.target_hours} />
                <BedtimeNudgeCard settings={settings} />
            </div>

            {/* Trend chart */}
            <DurationTrend logs={logs} targetHours={settings.target_hours} />

            {/* Sync buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                <button
                    onClick={syncPolar}
                    disabled={polarSyncing}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-accent transition-colors disabled:opacity-50"
                >
                    <RefreshCwIcon className={cn('w-3 h-3', polarSyncing && 'animate-spin')} />
                    {polarSyncing ? 'Syncing Polar…' : 'Sync Polar sleep'}
                </button>
                <button
                    onClick={() => setImportDialogOpen(true)}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3.5 py-1.5 text-[12px] font-semibold text-foreground hover:bg-accent transition-colors"
                >
                    <AppleIcon className="w-3 h-3" />
                    Import Apple Health
                </button>
            </div>

            {/* Sleep School */}
            <div>
                <SectionHeader title="Sleep School" />
                <div className="bg-primary/[0.04] border border-primary/[0.12] rounded-2xl p-3 mb-3 flex items-start gap-2">
                    <BookOpenIcon className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-foreground leading-relaxed">
                        Short, cadet-specific lessons. Tap any card to expand — about 60 seconds of reading each.
                    </p>
                </div>
                <div className="space-y-2">
                    {SLEEP_SCHOOL.map(item => (
                        <SleepSchoolCard
                            key={item.id}
                            item={item}
                            expanded={expandedLesson === item.id}
                            onToggle={() => setExpandedLesson(prev => prev === item.id ? null : item.id)}
                        />
                    ))}
                </div>
            </div>

            {/* Session list */}
            <div>
                <SectionHeader title="Recent nights" />
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                    {logsLoading ? (
                        <div className="px-5 py-5 space-y-3">
                            {[0, 1, 2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="px-5 py-10 flex flex-col items-center gap-3 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                                <MoonIcon className="w-5 h-5 text-muted-foreground" />
                            </div>
                            <div>
                                <div className="text-[13px] font-semibold text-foreground">No sleep logged yet</div>
                                <p className="text-[12px] text-muted-foreground mt-0.5">Log a night manually, sync your Polar, or import from Apple Health.</p>
                            </div>
                            <button
                                onClick={() => setLogDialogOpen(true)}
                                className="rounded-full bg-primary px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-primary/90 transition-colors"
                            >
                                Log last night
                            </button>
                        </div>
                    ) : (
                        logs.slice(0, 14).map(log => {
                            const isConfirming = confirmDeleteId === log.id
                            return (
                                <div key={log.id} className="border-b border-border last:border-0">
                                    {isConfirming ? (
                                        <div className="px-5 py-3.5 flex items-center justify-between gap-3">
                                            <span className="text-[12px] text-muted-foreground">
                                                Delete sleep for <span className="font-semibold text-foreground">{shortDate(log.night_date)}</span>?
                                            </span>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <button onClick={() => setConfirmDeleteId(null)} className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1">Cancel</button>
                                                <button onClick={() => handleDelete(log.id)} className="text-[12px] font-semibold text-white bg-danger rounded-lg px-3 py-1 hover:bg-danger/90 transition-colors">Delete</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="px-5 py-3.5 group hover:bg-muted/30 transition-colors">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-[13px] font-semibold text-foreground">{shortDate(log.night_date)}</span>
                                                        <span className={cn(
                                                            'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                                            log.source === 'polar' ? 'bg-primary/10 text-primary' :
                                                                log.source === 'apple_health' ? 'bg-success-light text-success-dark' :
                                                                    'bg-muted text-muted-foreground'
                                                        )}>
                                                            {log.source === 'apple_health' ? 'Apple' : log.source}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                            <ClockIcon className="w-3 h-3" />{timeOfDay(log.sleep_start)} → {timeOfDay(log.sleep_end)}
                                                        </span>
                                                        {log.sleep_score != null && (
                                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                <GaugeIcon className="w-3 h-3" />Score {log.sleep_score}
                                                            </span>
                                                        )}
                                                        {log.ans_charge_status != null && (
                                                            <span className={cn('text-[11px] flex items-center gap-1', ANS_TONE[log.ans_charge_status])}>
                                                                <ZapIcon className="w-3 h-3" />{ANS_LABEL[log.ans_charge_status]}
                                                            </span>
                                                        )}
                                                        {log.heart_rate_avg != null && (
                                                            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                <HeartIcon className="w-3 h-3" />{log.heart_rate_avg} bpm
                                                            </span>
                                                        )}
                                                    </div>
                                                    <StageBreakdown log={log} />
                                                    {log.notes && (
                                                        <p className="mt-2 text-[11px] text-muted-foreground italic">{log.notes}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <div className="text-right mr-2">
                                                        <span className="text-[14px] font-bold text-foreground tabular-nums">{durationLabel(log.duration_min)}</span>
                                                    </div>
                                                    {log.source === 'manual' && (
                                                        <button
                                                            onClick={() => { setEditingLog(log); setLogDialogOpen(true) }}
                                                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Edit"
                                                        >
                                                            <PencilIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => setConfirmDeleteId(log.id)}
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
            </div>

            <LogSleepDialog
                open={logDialogOpen}
                onOpenChange={open => { setLogDialogOpen(open); if (!open) setEditingLog(null) }}
                editing={editingLog as LogSleepDialogLog | null}
                onLogged={fetchLogs}
            />

            <AppleHealthImportDialog
                open={importDialogOpen}
                onOpenChange={setImportDialogOpen}
                onImported={fetchLogs}
            />
        </div>
    )
}

// Keep React happy about unused imports if tree-shaking misses them.
void MinusIcon
