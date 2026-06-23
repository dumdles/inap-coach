'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
    Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import {
    Pagination, PaginationContent, PaginationItem, PaginationEllipsis, getPaginationRange,
} from '@/components/ui/pagination'
import { LogSleepDialog, SleepLog as LogSleepDialogLog } from '@/components/sleep/log-sleep-dialog'
import { AppleHealthImportDialog } from '@/components/sleep/apple-health-import-dialog'
import { TimePicker } from '@/components/ui/time-picker'
import { recoveryReadiness, sleepDebtHours, type ReadinessLevel } from '@/lib/scoring'
import { useFab } from '@/app/context/fab-context'
import {
    MoonIcon, RefreshCwIcon, PlusIcon, HeartIcon, ZapIcon, FootprintsIcon,
    AppleIcon, PencilIcon, Trash2Icon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon,
    BookOpenIcon, ClockIcon, GaugeIcon, ActivityIcon, TrendingUpIcon, TrendingDownIcon,
    MinusIcon, SettingsIcon,
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

function fmtTime(d: Date): string {
    return d.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const ANS_LABEL: Record<number, string> = {
    1: 'Much below usual',
    2: 'Below usual',
    3: 'Usual',
    4: 'Above usual',
    5: 'Much above usual',
}

// Short labels for stat cards where space is tight
const ANS_SHORT: Record<number, string> = {
    1: 'Very low',
    2: 'Low',
    3: 'Normal',
    4: 'High',
    5: 'Very high',
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
            className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-3 duration-300"
            style={{ animationDelay: `${delay}ms`, animationFillMode: 'both', boxShadow: '0 1px 4px rgba(9,30,66,0.05)' }}
        >
            {/* Icon + label on one row */}
            <div className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', toneCls)}>
                    <span className="[&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground truncate">{label}</div>
            </div>
            {/* Value — font-sans keeps numbers compact and single-line */}
            <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-bold text-foreground tabular-nums leading-none tracking-tight truncate">{value}</span>
                {unit && <span className="text-[11px] text-muted-foreground flex-shrink-0">{unit}</span>}
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

const TREND_PERIODS = [7, 14, 30] as const
type TrendPeriod = typeof TREND_PERIODS[number]

// Build a YYYY-MM-DD key from a local Date (avoids UTC midnight offset for UTC+8 users)
function localDateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function DurationTrend({ logs, targetHours }: { logs: SleepLog[]; targetHours: number }) {
    const [period, setPeriod] = useState<TrendPeriod>(14)

    const data = useMemo(() => {
        const map = new Map<string, SleepLog>()
        for (const log of logs) map.set(log.night_date, log)
        const out: { date: string; hours: number; label: string; hasData: boolean }[] = []
        for (let i = period - 1; i >= 0; i--) {
            const d = new Date()
            d.setDate(d.getDate() - i)
            // Use local date so the key matches night_date values stored from Polar / Apple Health
            const key = localDateKey(d)
            const log = map.get(key)
            out.push({
                date: key,
                hours: log ? +(log.duration_min / 60).toFixed(2) : 0,
                // For ≤14 days show first letter of weekday; for 30 days show day number to avoid crowding
                label: period <= 14
                    ? d.toLocaleDateString('en-SG', { weekday: 'short' })[0]
                    : String(d.getDate()),
                hasData: !!log,
            })
        }
        return out
    }, [logs, period])

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <div className="text-[13px] font-semibold text-foreground">{period}-day sleep trend</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Hours per night vs your {targetHours}h target</p>
                </div>
                {/* Period toggle */}
                <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                    {TREND_PERIODS.map(p => (
                        <button
                            key={p}
                            type="button"
                            onClick={() => setPeriod(p)}
                            className={cn(
                                'px-2 py-1 rounded-md text-[11px] font-semibold transition-colors',
                                period === p
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {p}d
                        </button>
                    ))}
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
                            interval={period === 30 ? 4 : 0}
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
                                const datum = payload[0].payload as { date: string; hours: number; hasData: boolean }
                                return (
                                    <div className="bg-popover border border-border rounded-lg shadow-md px-3 py-2 text-[12px]">
                                        <div className="font-semibold text-foreground">{shortDate(datum.date)}</div>
                                        <div className="text-muted-foreground">
                                            {datum.hasData ? `${datum.hours.toFixed(1)}h slept` : 'No data'}
                                        </div>
                                    </div>
                                )
                            }}
                        />
                        <ReferenceLine y={targetHours} stroke="var(--color-primary)" strokeDasharray="3 3" strokeOpacity={0.5} />
                        <Bar
                            dataKey="hours"
                            radius={[4, 4, 0, 0]}
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
                    <span className="text-xl font-bold text-foreground tabular-nums tracking-tight">{Math.abs(debt)}h</span>
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
                    <span className="text-xl font-bold text-foreground tabular-nums tracking-tight">{target.slice(0, 5)}</span>
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

// ── Hypnogram generation ──────────────────────────────────────────────────
//
// Polar only returns stage totals (no per-interval timestamps), so we
// synthesise a plausible cycle layout using known sleep-science patterns:
//   • Deep sleep peaks in the FIRST half of the night (early cycles)
//   • REM peaks in the SECOND half (late cycles)
//   • Each cycle is ~90 min: light → deep → light → REM → (micro-arousal)
//
// The algorithm generates template blocks with relative weights per cycle,
// then scales each stage's weights so the totals exactly match the stored
// deep_min / rem_min / light_min / awake_min values.

type HypnoBlock = {
    stage: StageKey
    durationMin: number
    startTime: Date
    endTime: Date
}

function generateHypnogramBlocks(log: SleepLog): HypnoBlock[] {
    const deepMin  = log.deep_min  ?? 0
    const remMin   = log.rem_min   ?? 0
    const lightMin = log.light_min ?? 0
    const awakeMin = log.awake_min ?? 0

    const stageTotal = deepMin + remMin + lightMin + awakeMin
    if (stageTotal === 0) return []

    const sleepStart = new Date(log.sleep_start)
    const numCycles  = Math.max(1, Math.min(6, Math.round(log.duration_min / 90)))

    // Build template cycles — each phase is a (stage, weight) pair.
    // Weights are relative and will be scaled to match actual totals.
    type Phase = { stage: StageKey; weight: number }
    const templates: Phase[][] = []

    for (let c = 0; c < numCycles; c++) {
        // p: 0 = first cycle, 1 = last cycle
        const p = numCycles > 1 ? c / (numCycles - 1) : 0.5

        const cycle: Phase[] = [
            { stage: 'light', weight: 0.8 + p * 0.2 },               // opening light (more in late cycles)
            { stage: 'deep',  weight: Math.max(0.05, 1 - p * 0.95) }, // deep (shrinks to near-zero in last cycle)
            { stage: 'light', weight: 0.4 },                           // light bridge
            { stage: 'rem',   weight: Math.max(0.05, p) },             // REM (grows through the night)
        ]

        // Micro-arousal between cycles (only when awake data is present)
        if (c < numCycles - 1 && awakeMin > 0) {
            cycle.push({ stage: 'awake', weight: 0.15 })
        }

        templates.push(cycle)
    }

    // Sum total weight per stage across all cycles
    const totalWeight: Record<StageKey, number> = { deep: 0, rem: 0, light: 0, awake: 0 }
    for (const cycle of templates)
        for (const ph of cycle) totalWeight[ph.stage] += ph.weight

    // Scale factor = actual minutes / sum-of-weights for that stage
    const scale: Record<StageKey, number> = {
        deep:  totalWeight.deep  > 0 ? deepMin  / totalWeight.deep  : 0,
        rem:   totalWeight.rem   > 0 ? remMin   / totalWeight.rem   : 0,
        light: totalWeight.light > 0 ? lightMin / totalWeight.light : 0,
        awake: totalWeight.awake > 0 ? awakeMin / totalWeight.awake : 0,
    }

    // Build raw blocks, consuming from a per-stage budget to avoid rounding drift
    const budget: Record<StageKey, number> = { deep: deepMin, rem: remMin, light: lightMin, awake: awakeMin }
    const rawBlocks: { stage: StageKey; durationMin: number }[] = []

    for (const cycle of templates) {
        for (const ph of cycle) {
            if (budget[ph.stage] <= 0) continue
            const duration = Math.min(budget[ph.stage], Math.max(1, Math.round(ph.weight * scale[ph.stage])))
            rawBlocks.push({ stage: ph.stage, durationMin: duration })
            budget[ph.stage] -= duration
        }
    }

    // Flush any remaining minutes into the last block of each stage
    for (const stage of ['light', 'deep', 'rem', 'awake'] as StageKey[]) {
        if (budget[stage] <= 0) continue
        const lastMatch = [...rawBlocks].reverse().find(b => b.stage === stage)
        if (lastMatch) lastMatch.durationMin += budget[stage]
        else if (budget[stage] >= 2) rawBlocks.push({ stage, durationMin: budget[stage] })
    }

    // Attach absolute start / end times
    const blocks: HypnoBlock[] = []
    let offsetMs = 0
    for (const raw of rawBlocks) {
        const ms = raw.durationMin * 60_000
        blocks.push({
            stage: raw.stage,
            durationMin: raw.durationMin,
            startTime: new Date(sleepStart.getTime() + offsetMs),
            endTime:   new Date(sleepStart.getTime() + offsetMs + ms),
        })
        offsetMs += ms
    }

    return blocks
}

// ── Sleep stages card (full interactive breakdown for most recent night) ──

const STAGE_META = {
    deep: {
        label: 'Deep',
        color: 'var(--color-sleep-deep)',
        bgClass: 'bg-[var(--color-sleep-deep)]',
        textClass: 'text-[var(--color-sleep-deep)]',
        dotClass: 'bg-[var(--color-sleep-deep)]',
        target: '15–25%',
        headline: 'Physical recovery',
        description: 'Growth hormone surges and muscles repair during deep sleep. This stage peaks in the first half of the night — the earlier you sleep, the more you get.',
    },
    rem: {
        label: 'REM',
        color: 'var(--color-sleep-rem)',
        bgClass: 'bg-[var(--color-sleep-rem)]',
        textClass: 'text-[var(--color-sleep-rem)]',
        dotClass: 'bg-[var(--color-sleep-rem)]',
        target: '20–25%',
        headline: 'Motor learning & memory',
        description: 'Drill movements, navigation patterns, and weapon-handling repetitions consolidate here. REM peaks in the second half of the night — cut your sleep short and you lose this.',
    },
    light: {
        label: 'Light',
        color: 'var(--color-sleep-light)',
        bgClass: 'bg-[var(--color-sleep-light)]',
        textClass: 'text-[var(--color-sleep-light)]',
        dotClass: 'bg-[var(--color-sleep-light)]',
        target: '~50%',
        headline: 'Transitional stage',
        description: 'Light sleep bridges your waking hours to deep and REM. A large proportion is normal and expected — it\'s the scaffolding around the restorative stages.',
    },
    awake: {
        label: 'Awake',
        color: 'var(--color-sleep-awake)',
        bgClass: 'bg-[var(--color-sleep-awake)]',
        textClass: 'text-[var(--color-sleep-awake)]',
        dotClass: 'bg-[var(--color-sleep-awake)]',
        target: '< 5%',
        headline: 'Brief arousals',
        description: 'Some micro-arousals are completely normal. If this climbs above 10%, check for environmental disruptions: noise, temperature, late caffeine, or dehydration.',
    },
} as const

type StageKey = keyof typeof STAGE_META

// compact=true: no outer card wrapper or title — used when embedded inside a dialog
function SleepStagesCard({ log, compact = false }: { log: SleepLog | null; compact?: boolean }) {
    const [mode, setMode]           = useState<'summary' | 'timeline'>('summary')
    const [activeStage, setActiveStage] = useState<StageKey | null>(null)
    const [hoveredBlock, setHoveredBlock] = useState<HypnoBlock | null>(null)

    const stages = useMemo(() => {
        if (!log) return null
        const raw: { key: StageKey; min: number }[] = [
            { key: 'deep',  min: log.deep_min  ?? 0 },
            { key: 'rem',   min: log.rem_min   ?? 0 },
            { key: 'light', min: log.light_min ?? 0 },
            { key: 'awake', min: log.awake_min ?? 0 },
        ]
        const total = raw.reduce((s, r) => s + r.min, 0)
        if (total === 0) return null
        return raw.map(r => ({ ...r, pct: (r.min / total) * 100, total }))
    }, [log])

    const hypnoBlocks = useMemo(() => log ? generateHypnogramBlocks(log) : [], [log])

    // Time-axis ticks for timeline view
    const timeTicks = useMemo(() => {
        if (!log) return []
        const start      = new Date(log.sleep_start)
        const totalMin   = log.duration_min
        const intervalH  = totalMin > 360 ? 2 : 1
        const ticks: { pct: number; label: string }[] = []
        for (let h = 0; h * 60 <= totalMin; h += intervalH) {
            const t = new Date(start.getTime() + h * 3_600_000)
            ticks.push({ pct: (h * 60 / totalMin) * 100, label: fmtTime(t) })
        }
        return ticks
    }, [log])

    if (!log || !stages) {
        return (
            <div className="bg-card border border-dashed border-border rounded-2xl p-5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center flex-shrink-0">
                    <ActivityIcon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                    <div className="text-[13px] font-semibold text-foreground">No sleep stage data</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                        Sync your Polar watch or import Apple Health data to see your deep, REM, and light stage breakdown.
                    </p>
                </div>
            </div>
        )
    }

    const detail = activeStage ? STAGE_META[activeStage] : null
    const activeData = activeStage ? stages.find(s => s.key === activeStage) : null
    const totalHypnoMin = hypnoBlocks.reduce((s, b) => s + b.durationMin, 0)

    const inner = (
        <>
            {/* Header row with mode toggle — hidden in compact mode */}
            {!compact && (
            <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                    <div className="text-[13px] font-semibold text-foreground">Last night&apos;s sleep stages</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{shortDate(log.night_date)} · {durationLabel(log.duration_min)} total</p>
                </div>
                {/* Summary / Timeline toggle */}
                <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5 flex-shrink-0">
                    {(['summary', 'timeline'] as const).map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => { setMode(m); setActiveStage(null); setHoveredBlock(null) }}
                            className={cn(
                                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors capitalize',
                                mode === m
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>
            )}

            {/* In compact mode show toggle without the title row */}
            {compact && (
            <div className="flex items-center justify-end mb-3">
                <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
                    {(['summary', 'timeline'] as const).map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => { setMode(m); setActiveStage(null); setHoveredBlock(null) }}
                            className={cn(
                                'px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors capitalize',
                                mode === m ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>
            )}

            {/* ── SUMMARY MODE ─────────────────────────────────────────── */}
            {mode === 'summary' && (
                <>
                    {/* Proportional stacked bar */}
                    <div
                        className="flex h-10 rounded-xl overflow-hidden gap-px bg-border"
                        onMouseLeave={() => setActiveStage(null)}
                    >
                        {stages.filter(s => s.pct > 0).map(s => {
                            const meta = STAGE_META[s.key]
                            const isActive = activeStage === s.key
                            return (
                                <div
                                    key={s.key}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${meta.label}: ${durationLabel(s.min)}, ${s.pct.toFixed(0)}%`}
                                    className="relative flex items-center justify-center cursor-pointer transition-all duration-150 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    style={{
                                        width: `${s.pct}%`,
                                        background: meta.color,
                                        opacity: activeStage && !isActive ? 0.45 : 1,
                                        transform: isActive ? 'scaleY(1.08)' : 'scaleY(1)',
                                    }}
                                    onMouseEnter={() => setActiveStage(s.key)}
                                    onFocus={() => setActiveStage(s.key)}
                                    onBlur={() => setActiveStage(null)}
                                    onKeyDown={e => e.key === 'Enter' && setActiveStage(prev => prev === s.key ? null : s.key)}
                                >
                                    {s.pct >= 14 && (
                                        <span className="text-[10px] font-bold text-white drop-shadow-sm pointer-events-none">
                                            {meta.label}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Legend — 2-column grid */}
                    <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {stages.map(s => {
                            const meta = STAGE_META[s.key]
                            const isActive = activeStage === s.key
                            return (
                                <button
                                    key={s.key}
                                    type="button"
                                    className={cn(
                                        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors',
                                        isActive ? 'bg-muted' : 'hover:bg-muted/50',
                                    )}
                                    onMouseEnter={() => setActiveStage(s.key)}
                                    onMouseLeave={() => setActiveStage(null)}
                                    onClick={() => setActiveStage(prev => prev === s.key ? null : s.key)}
                                >
                                    <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', meta.dotClass)} />
                                    <span className="flex-1 min-w-0">
                                        <span className="text-[11px] font-semibold text-foreground">{meta.label}</span>
                                        <span className="text-[10px] text-muted-foreground ml-1.5">{durationLabel(s.min)}</span>
                                    </span>
                                    <span className={cn('text-[11px] font-bold tabular-nums', isActive ? meta.textClass : 'text-muted-foreground')}>
                                        {s.pct.toFixed(0)}%
                                    </span>
                                </button>
                            )
                        })}
                    </div>

                    {/* Detail panel */}
                    <div className={cn('mt-3 overflow-hidden transition-all duration-200', detail ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
                        {detail && activeData && (
                            <div
                                className="rounded-xl p-3 border"
                                style={{ borderColor: detail.color, background: `color-mix(in srgb, ${detail.color} 8%, var(--color-card))` }}
                            >
                                <div className="flex items-center justify-between gap-3 mb-1">
                                    <span className="text-[12px] font-bold" style={{ color: detail.color }}>{detail.headline}</span>
                                    <span className="text-[10px] font-semibold text-muted-foreground">Target {detail.target}</span>
                                </div>
                                <p className="text-[11px] text-foreground leading-relaxed">{detail.description}</p>
                                <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                                    <span><strong className="text-foreground">{durationLabel(activeData.min)}</strong> last night</span>
                                    <span>·</span>
                                    <span><strong className="text-foreground">{activeData.pct.toFixed(0)}%</strong> of total</span>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ── TIMELINE MODE ─────────────────────────────────────────── */}
            {mode === 'timeline' && (
                <>
                    {/* "Estimated" badge */}
                    <div className="flex items-center gap-1.5 mb-3">
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                            Estimated
                        </span>
                        <span className="text-[10px] text-muted-foreground">Cycle layout inferred from stage totals</span>
                    </div>

                    {/* Timeline bar */}
                    <div
                        className="flex h-12 rounded-xl overflow-hidden gap-px bg-border"
                        onMouseLeave={() => setHoveredBlock(null)}
                    >
                        {hypnoBlocks.map((block, i) => {
                            const meta     = STAGE_META[block.stage]
                            const widthPct = totalHypnoMin > 0 ? (block.durationMin / totalHypnoMin) * 100 : 0
                            const isHovered = hoveredBlock === block
                            return (
                                <div
                                    key={i}
                                    role="button"
                                    tabIndex={0}
                                    aria-label={`${meta.label}: ${fmtTime(block.startTime)}–${fmtTime(block.endTime)}, ${durationLabel(block.durationMin)}`}
                                    className="relative flex items-center justify-center cursor-pointer transition-all duration-100 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    style={{
                                        width: `${widthPct}%`,
                                        minWidth: '3px',
                                        background: meta.color,
                                        opacity: hoveredBlock && !isHovered ? 0.45 : 1,
                                        transform: isHovered ? 'scaleY(1.08)' : 'scaleY(1)',
                                    }}
                                    onMouseEnter={() => setHoveredBlock(block)}
                                    onFocus={() => setHoveredBlock(block)}
                                    onBlur={() => setHoveredBlock(null)}
                                    onKeyDown={e => e.key === 'Enter' && setHoveredBlock(prev => prev === block ? null : block)}
                                >
                                    {/* Stage label inside block if wide enough */}
                                    {widthPct >= 12 && (
                                        <span className="text-[9px] font-bold text-white drop-shadow-sm pointer-events-none">
                                            {meta.label}
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>

                    {/* Time axis */}
                    <div className="relative mt-1.5 h-4">
                        {timeTicks.map(tick => (
                            <span
                                key={tick.pct}
                                className="absolute text-[9px] text-muted-foreground -translate-x-1/2"
                                style={{ left: `${Math.min(96, Math.max(4, tick.pct))}%` }}
                            >
                                {tick.label}
                            </span>
                        ))}
                    </div>

                    {/* Hover detail panel */}
                    <div className={cn('mt-2 overflow-hidden transition-all duration-200', hoveredBlock ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0')}>
                        {hoveredBlock && (() => {
                            const meta = STAGE_META[hoveredBlock.stage]
                            return (
                                <div
                                    className="rounded-xl p-3 border"
                                    style={{ borderColor: meta.color, background: `color-mix(in srgb, ${meta.color} 8%, var(--color-card))` }}
                                >
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                        <span className="text-[12px] font-bold" style={{ color: meta.color }}>
                                            {meta.label} — {meta.headline}
                                        </span>
                                        <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                                            {fmtTime(hoveredBlock.startTime)} – {fmtTime(hoveredBlock.endTime)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                        <span><strong className="text-foreground">{durationLabel(hoveredBlock.durationMin)}</strong> in this block</span>
                                        <span>·</span>
                                        <span>Target {meta.target}</span>
                                    </div>
                                </div>
                            )
                        })()}
                    </div>

                    {/* Stage legend strip */}
                    <div className="mt-3 flex items-center gap-3 flex-wrap">
                        {(Object.keys(STAGE_META) as StageKey[]).filter(k => stages.some(s => s.key === k && s.min > 0)).map(k => {
                            const meta = STAGE_META[k]
                            return (
                                <span key={k} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <span className={cn('w-2.5 h-2.5 rounded-sm flex-shrink-0', meta.dotClass)} />
                                    {meta.label}
                                </span>
                            )
                        })}
                    </div>
                </>
            )}
        </>
    )

    if (compact) return <div>{inner}</div>
    return (
        <div className="bg-card border border-border rounded-2xl p-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {inner}
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

// ── Sleep log detail dialog ───────────────────────────────────────────────

function SleepLogDetailDialog({
    log, open, onOpenChange, onEdit, onDelete,
}: {
    log: SleepLog | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onEdit: (log: SleepLog) => void
    onDelete: (id: string) => void
}) {
    const [confirmDelete, setConfirmDelete] = useState(false)

    // Reset confirm state when dialog closes or log changes
    React.useEffect(() => { if (!open) setConfirmDelete(false) }, [open])

    if (!log) return null

    const hasStages = (log.deep_min ?? 0) + (log.rem_min ?? 0) + (log.light_min ?? 0) > 0

    // Sleep score quality text
    function scoreLabel(s: number): { text: string; cls: string } {
        if (s >= 80) return { text: 'Excellent', cls: 'text-success-dark bg-success-light' }
        if (s >= 60) return { text: 'Good', cls: 'text-primary bg-primary/10' }
        return { text: 'Poor', cls: 'text-danger-dark bg-danger-light' }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent swipeToDismiss className="sm:max-w-md w-full p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
                {/* Sticky header */}
                <div className="px-5 pt-5 pb-4 border-b border-border flex-shrink-0">
                    <div className="flex items-start justify-between gap-3 pr-8">
                        <div>
                            <DialogTitle className="text-[17px] font-bold text-foreground leading-tight">
                                {shortDate(log.night_date)}
                            </DialogTitle>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className={cn(
                                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                    log.source === 'polar' ? 'bg-primary/10 text-primary' :
                                        log.source === 'apple_health' ? 'bg-success-light text-success-dark' :
                                            'bg-muted text-muted-foreground'
                                )}>
                                    {log.source === 'apple_health' ? 'Apple Health' : log.source === 'polar' ? 'Polar' : 'Manual'}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                    {timeOfDay(log.sleep_start)} → {timeOfDay(log.sleep_end)}
                                </span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-bold text-foreground tabular-nums tracking-tight leading-none">
                                {durationLabel(log.duration_min)}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">total sleep</div>
                        </div>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">

                    {/* Recovery metrics row */}
                    {(log.sleep_score != null || log.ans_charge_status != null || log.heart_rate_avg != null || log.hrv_avg != null) && (
                        <div className="grid grid-cols-2 gap-2">
                            {log.sleep_score != null && (() => {
                                const sl = scoreLabel(log.sleep_score)
                                return (
                                    <div className="rounded-xl border border-border p-3">
                                        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Sleep score</div>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{log.sleep_score}</span>
                                            <span className="text-[10px] text-muted-foreground">/100</span>
                                        </div>
                                        <span className={cn('mt-1.5 inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold', sl.cls)}>{sl.text}</span>
                                    </div>
                                )
                            })()}

                            {log.ans_charge_status != null && (
                                <div className="rounded-xl border border-border p-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">ANS recharge</div>
                                    <div className="text-[15px] font-bold text-foreground leading-tight">{ANS_LABEL[log.ans_charge_status]}</div>
                                    <div className="mt-1.5 flex gap-1">
                                        {[1,2,3,4,5].map(n => (
                                            <div key={n} className={cn('h-1 flex-1 rounded-full', n <= log.ans_charge_status! ? 'bg-primary' : 'bg-muted')} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {log.heart_rate_avg != null && (
                                <div className="rounded-xl border border-border p-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Avg heart rate</div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{log.heart_rate_avg}</span>
                                        <span className="text-[10px] text-muted-foreground">bpm</span>
                                    </div>
                                </div>
                            )}

                            {log.hrv_avg != null && (
                                <div className="rounded-xl border border-border p-3">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">HRV</div>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-2xl font-bold text-foreground tabular-nums tracking-tight">{log.hrv_avg}</span>
                                        <span className="text-[10px] text-muted-foreground">ms</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Rating */}
                    {log.rating != null && (
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Your rating</div>
                            <div className="flex items-center gap-1">
                                {[1,2,3,4,5].map(n => (
                                    <span key={n} className={cn('text-lg', n <= log.rating! ? 'text-warning' : 'text-muted')}>★</span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sleep stages */}
                    {hasStages && (
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Sleep stages</div>
                            <SleepStagesCard log={log} compact />
                        </div>
                    )}

                    {/* Notes */}
                    {log.notes && (
                        <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notes</div>
                            <p className="text-[13px] text-foreground leading-relaxed bg-muted/40 rounded-xl px-3 py-2.5 italic">
                                &ldquo;{log.notes}&rdquo;
                            </p>
                        </div>
                    )}
                </div>

                {/* Sticky footer */}
                <div className="px-5 py-4 border-t border-border flex-shrink-0 flex items-center justify-between gap-3">
                    {confirmDelete ? (
                        <>
                            <span className="text-[12px] text-muted-foreground">Delete this sleep log?</span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setConfirmDelete(false)}
                                    className="text-[12px] text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => { onDelete(log.id); onOpenChange(false) }}
                                    className="text-[12px] font-semibold text-white bg-danger rounded-full px-4 py-1.5 hover:bg-danger/90 transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConfirmDelete(true)}
                                className="text-muted-foreground hover:text-danger"
                                prefixIcon={<Trash2Icon className="size-3.5" />}
                            >
                                Delete
                            </Button>
                            {log.source === 'manual' && (
                                <Button
                                    size="sm"
                                    onClick={() => { onEdit(log); onOpenChange(false) }}
                                    prefixIcon={<PencilIcon className="size-3.5" />}
                                >
                                    Edit
                                </Button>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
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
                    <TimePicker value={bedtime} onChange={setBedtime} placeholder="Bedtime" />
                </div>
                <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Wake</label>
                    <TimePicker value={wake} onChange={setWake} placeholder="Wake" />
                </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
                <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
                <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                </Button>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function SleepPage() {
    const { user, session } = useAuth()

    const [logs, setLogs] = useState<SleepLog[]>([])
    const [logsLoading, setLogsLoading] = useState(true)
    const [settings, setSettings] = useState<SleepSettings>({ target_hours: 7.5, target_bedtime: null, target_wake_time: null })
    const [polarSyncing, setPolarSyncing] = useState(false)
    const [logDialogOpen, setLogDialogOpen] = useState(false)
    const [importDialogOpen, setImportDialogOpen] = useState(false)
    const [editingLog, setEditingLog] = useState<SleepLog | null>(null)

    // Mobile FAB on the sleep page logs sleep (fresh entry, not an edit).
    useFab({ label: 'Log sleep', icon: <MoonIcon className="w-[22px] h-[22px]" />, onClick: () => { setEditingLog(null); setLogDialogOpen(true) } })
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
    const [expandedLesson, setExpandedLesson] = useState<string | null>(null)
    const [settingsOpen, setSettingsOpen] = useState(false)
    const [detailLog, setDetailLog] = useState<SleepLog | null>(null)
    const [historyPage, setHistoryPage] = useState(1)

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
    // Return to page 1 whenever the log list updates (e.g. after delete or sync)
    useEffect(() => { setHistoryPage(1) }, [logs])

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
        await fetch(`/api/sleep-logs?id=${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${session?.access_token}` } })
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
    const LOGS_PER_PAGE = 7
    const totalHistoryPages = Math.max(1, Math.ceil(logs.length / LOGS_PER_PAGE))
    const pagedLogs = logs.slice((historyPage - 1) * LOGS_PER_PAGE, historyPage * LOGS_PER_PAGE)

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
        <div className="px-4 sm:px-6 lg:px-10 pt-16 sm:pt-8 pb-24 max-w-5xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div>
                    <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground leading-none">Sleep</h1>
                    <p className="text-sm text-muted-foreground mt-1.5">Recovery is when training actually happens.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="relative">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSettingsOpen(o => !o)}
                            title="Sleep targets"
                            prefixIcon={<SettingsIcon className="size-3.5" />}
                        >
                            <span className="hidden sm:inline">Settings</span>
                        </Button>
                        {settingsOpen && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setSettingsOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 z-40">
                                    <SettingsPopover settings={settings} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
                                </div>
                            </>
                        )}
                    </div>
                    <Button
                        onClick={() => setLogDialogOpen(true)}
                        prefixIcon={<PlusIcon className="size-3.5" />}
                    >
                        Log sleep
                    </Button>
                </div>
            </div>

            {/* Recovery Readiness — the headline */}
            <ReadinessCard log={lastNight} />

            {/* Stat cards — 2 col on mobile, 4 col on lg+ */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                    value={avgAns != null ? ANS_SHORT[avgAns] : '—'}
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

            {/* Sleep stages + Trend — stacked on mobile, side-by-side on lg */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="space-y-0">
                    <SectionHeader title="Sleep stages" />
                    <SleepStagesCard log={lastNight} />
                </div>
                <div>
                    <DurationTrend logs={logs} targetHours={settings.target_hours} />
                </div>
            </div>

            {/* Sync buttons */}
            <div className="flex items-center gap-2 flex-wrap">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={syncPolar}
                    disabled={polarSyncing}
                    prefixIcon={<RefreshCwIcon className={cn('size-3', polarSyncing && 'animate-spin')} />}
                >
                    {polarSyncing ? 'Syncing Polar…' : 'Sync Polar sleep'}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setImportDialogOpen(true)}
                    prefixIcon={<AppleIcon className="size-3" />}
                >
                    Import Apple Health
                </Button>
            </div>

            {/* Sleep School + Recent Nights — stacked on mobile, side-by-side on lg */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">

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
                            <Button size="sm" onClick={() => setLogDialogOpen(true)}>
                                Log last night
                            </Button>
                        </div>
                    ) : (
                        pagedLogs.map(log => {
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
                                        <div
                                            className="px-5 py-3.5 group hover:bg-muted/30 transition-colors cursor-pointer"
                                            onClick={() => setDetailLog(log)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={e => e.key === 'Enter' && setDetailLog(log)}
                                        >
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
                                                            onClick={e => { e.stopPropagation(); setEditingLog(log); setLogDialogOpen(true) }}
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
                {totalHistoryPages > 1 && (() => {
                    const prevButton = (
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
                    )
                    const nextButton = (
                        <PaginationItem>
                            <button
                                onClick={() => setHistoryPage(p => Math.min(totalHistoryPages, p + 1))}
                                disabled={historyPage === totalHistoryPages}
                                className="flex h-9 items-center gap-1 px-3 rounded-md text-[13px] font-medium text-foreground hover:bg-accent transition-colors disabled:pointer-events-none disabled:opacity-40"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ChevronRightIcon className="w-4 h-4" />
                            </button>
                        </PaginationItem>
                    )
                    const pageButton = (page: number) => (
                        <PaginationItem key={page}>
                            <button
                                onClick={() => setHistoryPage(page)}
                                className={cn(
                                    'flex h-9 w-9 items-center justify-center rounded-md text-[13px] font-medium transition-colors',
                                    page === historyPage
                                        ? 'bg-primary text-white'
                                        : 'hover:bg-accent text-foreground'
                                )}
                            >
                                {page}
                            </button>
                        </PaginationItem>
                    )

                    return (
                        <Pagination className="mt-3">
                            {/* Mobile: truncated to first/last + a window around the current page,
                                so months of history don't turn into dozens of number buttons. */}
                            <PaginationContent className="sm:hidden">
                                {prevButton}
                                {getPaginationRange(historyPage, totalHistoryPages).map((token, i) =>
                                    token === 'ellipsis'
                                        ? <PaginationItem key={`e-${i}`}><PaginationEllipsis /></PaginationItem>
                                        : pageButton(token)
                                )}
                                {nextButton}
                            </PaginationContent>
                            {/* Desktop: full list — there's room, and it's already horizontally scrollable as a fallback. */}
                            <PaginationContent className="hidden sm:flex">
                                {prevButton}
                                {Array.from({ length: totalHistoryPages }, (_, i) => i + 1).map(pageButton)}
                                {nextButton}
                            </PaginationContent>
                        </Pagination>
                    )
                })()}
                </div>
            </div>{/* end School + Nights grid */}

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

            <SleepLogDetailDialog
                log={detailLog}
                open={detailLog !== null}
                onOpenChange={open => { if (!open) setDetailLog(null) }}
                onEdit={log => { setEditingLog(log); setLogDialogOpen(true) }}
                onDelete={handleDelete}
            />
        </div>
    )
}

// Keep React happy about unused imports if tree-shaking misses them.
void MinusIcon
