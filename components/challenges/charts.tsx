'use client'

// ── Challenge visuals ─────────────────────────────────────────────────────────
// Charts and game pieces for the Challenges list + detail pages. Same rules as
// the Command console kit (components/admin/charts.tsx): fixed --viz-* tokens,
// "you" is the one accent series and everyone else is grey context, text stays
// in text tokens, every chart has a hover tooltip. Medal colours (--medal-*)
// only ever appear next to a place label, never as a data series.

import React from 'react'
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { Dumbbell, Flame, Route, Timer, Utensils, Beef, CalendarCheck, Activity, Repeat } from 'lucide-react'
import { AXIS_TICK, LegendKey, TooltipBox, TooltipRow, shortDate } from '@/components/admin/charts'
import { cn } from '@/lib/utils'
import type { ChallengeMetric } from '@/lib/challenges'

// ── Metric icon ───────────────────────────────────────────────────────────────
const METRIC_ICON: Record<ChallengeMetric, typeof Dumbbell> = {
    distance_km: Route, workout_minutes: Timer, workouts: Activity,
    calorie_days: CalendarCheck, protein_days: Beef, meals_logged: Utensils,
    active_days: CalendarCheck, best_streak: Flame, reps: Repeat,
}
export function MetricIcon({ metric, size = 18, className }: { metric: ChallengeMetric; size?: number; className?: string }) {
    const Icon = METRIC_ICON[metric] ?? Dumbbell
    return <Icon size={size} className={className} aria-hidden />
}

// ── Medals ────────────────────────────────────────────────────────────────────
export const MEDAL = ['var(--medal-gold)', 'var(--medal-silver)', 'var(--medal-bronze)'] as const
const MEDAL_NAME = ['Gold', 'Silver', 'Bronze']

/** Round place disc: medal-coloured ring for 1–3, plain for the rest. */
export function PlaceBadge({ place, size = 28, scored = true }: { place: number; size?: number; scored?: boolean }) {
    const medal = scored && place >= 1 && place <= 3 ? MEDAL[place - 1] : null
    return (
        <span
            className={cn('inline-flex items-center justify-center rounded-full font-display font-bold tabular-nums shrink-0',
                medal ? 'text-foreground' : 'text-muted-foreground bg-muted dark:bg-background')}
            style={{ width: size, height: size, fontSize: size * 0.42, ...(medal ? { boxShadow: `inset 0 0 0 2px ${medal}`, background: 'var(--card)' } : {}) }}
            aria-label={medal ? `${MEDAL_NAME[place - 1]} — place ${place}` : `Place ${place}`}
        >
            {place}
        </span>
    )
}

// ── Podium ────────────────────────────────────────────────────────────────────
export type PodiumEntry = { place: number; label: string; score: number; mine?: boolean }

/** Classic 2–1–3 podium. Block heights are fixed by place (not data) so it reads as a game piece. */
export function Podium({ entries, fmt }: { entries: PodiumEntry[]; fmt: (v: number) => string }) {
    const scored = entries.filter(e => e.score > 0 && e.place <= 3)
    if (!scored.length) return <p className="text-sm text-muted-foreground py-6 text-center">No one on the podium yet — be the first to score.</p>
    // Order columns 2nd · 1st · 3rd; ties can put two entries on one step.
    const order = [2, 1, 3]
    const heights: Record<number, string> = { 1: 'h-24', 2: 'h-16', 3: 'h-12' }
    return (
        <div className="grid grid-cols-3 gap-2 items-end">
            {order.map(place => {
                const here = scored.filter(e => e.place === place)
                return (
                    <div key={place} className="flex flex-col items-center text-center min-w-0">
                        {here.length ? here.map(e => (
                            <div key={e.label} className="mb-1.5 min-w-0 w-full">
                                <div className={cn('text-[12px] font-semibold line-clamp-2 break-words', e.mine ? 'text-foreground' : 'text-foreground/90')}>
                                    {e.label}{e.mine && <span className="text-muted-foreground font-normal"> (you)</span>}
                                </div>
                                <div className="text-[11px] text-muted-foreground tabular-nums">{fmt(e.score)}</div>
                            </div>
                        )) : <div className="mb-1.5 text-[11px] text-muted-foreground">—</div>}
                        <div className={cn('w-full rounded-t-xl flex items-start justify-center pt-2 bg-muted dark:bg-background', heights[place])}
                            style={{ boxShadow: `inset 0 3px 0 ${MEDAL[place - 1]}` }}>
                            <span className="font-display font-extrabold text-[18px] text-foreground">{place}</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}

// ── Time meter ────────────────────────────────────────────────────────────────
/** Thin "how much of the challenge has elapsed" bar. */
export function TimeMeter({ startsAt, endsAt, now, className }: { startsAt: string; endsAt: string; now: number; className?: string }) {
    const pct = Math.min(100, Math.max(0, ((now - Date.parse(startsAt)) / (Date.parse(endsAt) - Date.parse(startsAt))) * 100))
    return (
        <div className={cn('h-1.5 rounded-full bg-muted dark:bg-background overflow-hidden', className)} role="progressbar"
            aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${Math.round(pct)}% of the challenge elapsed`}>
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: 'var(--viz-accent)' }} />
        </div>
    )
}

/** You vs the leader as two horizontal bars on one scale (accent = you, grey = leader). */
export function VersusBars({ you, leader, leaderLabel, fmt, youLabel = 'You' }: { you: number; leader: number; leaderLabel: string; fmt: (v: number) => string; youLabel?: string }) {
    const max = Math.max(you, leader, 1)
    const bar = (v: number, color: string) => (
        <div className="h-2 flex-1 rounded-r bg-transparent">
            <div className="h-full rounded-r" style={{ width: `${Math.max(v ? 2 : 0, (v / max) * 100)}%`, background: color }} />
        </div>
    )
    return (
        <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2"><span className="w-14 text-muted-foreground truncate">{youLabel}</span>{bar(you, 'var(--viz-accent)')}<span className="w-16 text-right tabular-nums text-foreground">{fmt(you)}</span></div>
            <div className="flex items-center gap-2"><span className="w-14 text-muted-foreground truncate" title={leaderLabel}>Leader</span>{bar(leader, 'var(--viz-muted)')}<span className="w-16 text-right tabular-nums text-muted-foreground">{fmt(leader)}</span></div>
        </div>
    )
}

// ── Race chart: cumulative score per day ──────────────────────────────────────
export type RaceLine = { key: string; label: string; place: number; mine: boolean; values: number[] }

export function RaceChart({ days, lines, unit, mineLabel = 'You', height = 260 }: {
    days: string[]; lines: RaceLine[]; unit: string; mineLabel?: string; height?: number
}) {
    const data = days.map((d, i) => ({ label: shortDate(d), ...Object.fromEntries(lines.map(l => [l.key, l.values[i]])) }))
    const others = lines.filter(l => !l.mine)
    const last = days.length - 1
    // Name each line at its right end (≤ 4 lines, so direct labels stay readable).
    // Close finishes would stack labels on top of each other: work out, from the
    // end values, how far down each label must move to sit ≥ 13px below the one
    // above it (approximate px-per-unit from the plot height; over-spacing is harmless).
    const nudge = new Map<string, number>()
    {
        const ends = lines.map(l => ({ key: l.key, v: l.values[last] ?? 0 })).sort((a, b) => b.v - a.v)
        const pxPerUnit = (height - 40) / Math.max(1e-9, ends[0]?.v ?? 0)
        let prevY = -Infinity // label y in px, measured downwards from the top value
        for (const e of ends) {
            const y = Math.max(((ends[0].v - e.v) * pxPerUnit), prevY + 13)
            nudge.set(e.key, y - (ends[0].v - e.v) * pxPerUnit)
            prevY = y
        }
    }
    const EndLabel = (l: RaceLine) => function Label(props: { x?: number | string; y?: number | string; index?: number }) {
        if (props.index !== last || props.x == null || props.y == null) return null
        const y = Number(props.y) + 4 + (nudge.get(l.key) ?? 0)
        // Place at the line end ("#2"); names are in the tooltip and standings.
        const name = l.mine ? `${mineLabel} #${l.place}` : `#${l.place}`
        return <text x={Number(props.x) + 6} y={y} fontSize={11} fill="var(--color-muted-foreground)" fontWeight={l.mine ? 600 : 400}>{name}</text>
    }
    return (
        <div>
            <div className="flex flex-wrap gap-4 mb-2 text-[12px] text-muted-foreground">
                {lines.some(l => l.mine) && <LegendKey color="var(--viz-accent)" label={mineLabel} />}
                {others.length > 0 && <LegendKey color="var(--viz-muted)" label={others.length === 1 ? others[0].label : 'Top 3'} />}
            </div>
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={data} margin={{ top: 8, right: 80, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                    <Tooltip
                        cursor={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 1 }}
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const rows = [...lines].map(l => ({ l, v: Number((payload[0].payload as Record<string, number>)[l.key] ?? 0) }))
                                .sort((a, b) => b.v - a.v)
                            return (
                                <TooltipBox title={`By end of ${label}`}>
                                    {rows.map(({ l, v }) => (
                                        <TooltipRow key={l.key} color={l.mine ? 'var(--viz-accent)' : 'var(--viz-muted)'}
                                            label={l.mine ? `${mineLabel} (#${l.place})` : `#${l.place} ${l.label}`} value={`${v} ${unit}`} />
                                    ))}
                                </TooltipBox>
                            )
                        }}
                    />
                    {/* Grey context lines first so "you" draws on top */}
                    {others.map(l => (
                        <Line key={l.key} type="linear" dataKey={l.key} stroke="var(--viz-muted)" strokeWidth={2} dot={false}
                            activeDot={{ r: 4, fill: 'var(--viz-muted)', stroke: 'var(--card)', strokeWidth: 2 }} label={EndLabel(l)} isAnimationActive={false} />
                    ))}
                    {lines.filter(l => l.mine).map(l => (
                        <Line key={l.key} type="linear" dataKey={l.key} stroke="var(--viz-accent)" strokeWidth={2.5} dot={false}
                            activeDot={{ r: 5, fill: 'var(--viz-accent)', stroke: 'var(--card)', strokeWidth: 2 }} label={EndLabel(l)} isAnimationActive={false} />
                    ))}
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

// ── Daily gains: you vs the average cadet ─────────────────────────────────────
export function DailyBars({ days, mine, avg, unit, height = 200 }: {
    days: string[]; mine: number[]; avg: number[]; unit: string; height?: number
}) {
    const data = days.map((d, i) => ({ label: shortDate(d), mine: mine[i] ?? 0, avg: avg[i] ?? 0 }))
    return (
        <div>
            <div className="flex flex-wrap gap-4 mb-2 text-[12px] text-muted-foreground">
                <LegendKey color="var(--viz-accent)" label="You" square />
                <LegendKey color="var(--viz-muted)" label="Average cadet" square />
            </div>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barGap={2} barCategoryGap="24%">
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                    <Tooltip
                        cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }}
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const p = payload[0].payload as { mine: number; avg: number }
                            return (
                                <TooltipBox title={String(label)}>
                                    <TooltipRow color="var(--viz-accent)" label="You" value={`${p.mine} ${unit}`} />
                                    <TooltipRow color="var(--viz-muted)" label="Average cadet" value={`${p.avg} ${unit}`} />
                                </TooltipBox>
                            )
                        }}
                    />
                    <Bar dataKey="mine" fill="var(--viz-accent)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                    <Bar dataKey="avg" fill="var(--viz-muted)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

// ── Score distribution: where everyone stands ─────────────────────────────────
/** Bucket scores into ≤ 8 even ranges; the caller's bucket is the accent bar. */
export function ScoreDistribution({ scores, myScore, unit, height = 180 }: {
    scores: number[]; myScore: number | null; unit: string; height?: number
}) {
    const max = Math.max(0, ...scores)
    const BINS = Math.min(8, Math.max(1, Math.ceil(max) || 1))
    // Whole-number bin widths unless the scores are small decimals (e.g. km).
    const width = max > BINS * 2 ? Math.ceil((max + 1) / BINS) : (max / BINS || 1)
    const bins = Array.from({ length: BINS }, (_, i) => ({ from: i * width, to: (i + 1) * width, count: 0, mine: false }))
    const binOf = (v: number) => Math.min(BINS - 1, Math.floor(v / width))
    for (const v of scores) bins[binOf(v)].count++
    if (myScore != null) bins[binOf(myScore)].mine = true
    const r = (n: number) => (Number.isInteger(width) ? Math.round(n) : Math.round(n * 10) / 10)
    // Axis shows each bin's start ("0", "94", …); the tooltip shows the full range.
    const data = bins.map(b => ({ ...b, label: String(r(b.from)), range: Number.isInteger(width) ? `${r(b.from)}–${r(b.to) - 1}` : `${r(b.from)}–${r(b.to)}` }))
    return (
        <div>
            {myScore != null && (
                <div className="flex flex-wrap gap-4 mb-2 text-[12px] text-muted-foreground">
                    <LegendKey color="var(--viz-accent)" label="Your range" square />
                    <LegendKey color="var(--viz-muted)" label="Other cadets" square />
                </div>
            )}
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap={4}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip
                        cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const p = payload[0].payload as (typeof data)[number]
                            return (
                                <TooltipBox title={`${p.range} ${unit}`}>
                                    <TooltipRow color={p.mine ? 'var(--viz-accent)' : 'var(--viz-muted)'} label={p.mine ? 'Cadets (incl. you)' : 'Cadets'} value={String(p.count)} />
                                </TooltipBox>
                            )
                        }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}
                        label={{ position: 'top', fontSize: 11, fill: 'var(--color-muted-foreground)' }}>
                        {data.map(d => <Cell key={d.label} fill={d.mine ? 'var(--viz-accent)' : 'var(--viz-muted)'} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
