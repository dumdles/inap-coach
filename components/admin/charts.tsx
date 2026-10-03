'use client'

// ── Admin console chart kit ───────────────────────────────────────────────────
// Small, opinionated chart pieces shared by the Admin tabs. Rules they follow
// (see the dataviz guidance this was built from):
//   • Colours come from the fixed --viz-* tokens in app/globals.css (validated
//     for colour-blind safety), never from --primary, which changes per goal mode.
//   • One accent series; comparison/context series are grey ("emphasis").
//   • Text is always in text tokens (foreground / muted-foreground), never the
//     series colour. Status colours only appear with an icon + label.
//   • Every chart has a hover tooltip; values are also readable without colour.

import React, { useState } from 'react'
import Link from 'next/link'
import {
    ResponsiveContainer, AreaChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid,
    BarChart, Bar, Cell,
} from 'recharts'
import { AlertOctagon, AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Info, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { IpptTier, Severity } from '@/lib/admin-analytics'

export const AXIS_TICK = { fontSize: 11, fill: 'var(--color-muted-foreground)' }

// ── Panel ─────────────────────────────────────────────────────────────────────
export function Panel({ title, subtitle, action, className, children }: {
    title: string; subtitle?: string; action?: React.ReactNode; className?: string; children: React.ReactNode
}) {
    return (
        <section className={cn('rounded-2xl bg-card border border-border p-5', className)}>
            <div className="flex items-start justify-between gap-3 mb-4">
                <div className="min-w-0">
                    <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
                    {subtitle && <p className="text-[12px] text-muted-foreground mt-0.5">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    )
}

// ── Severity badge (status colour + icon + label, never colour alone) ─────────
const SEVERITY_META: Record<Severity | 'good', { label: string; className: string; Icon: typeof Info }> = {
    critical: { label: 'Critical', className: 'bg-danger-light text-danger-dark', Icon: AlertOctagon },
    serious:  { label: 'Serious',  className: 'bg-warning-light text-warning-dark', Icon: AlertTriangle },
    warning:  { label: 'Watch',    className: 'bg-muted text-muted-foreground', Icon: Info },
    good:     { label: 'Good',     className: 'bg-success-light text-success-dark', Icon: CheckCircle2 },
}

export function SeverityBadge({ severity, label }: { severity: Severity | 'good'; label?: string }) {
    const m = SEVERITY_META[severity]
    return (
        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', m.className)}>
            <m.Icon size={12} aria-hidden />
            {label ?? m.label}
        </span>
    )
}

export function SeverityIcon({ severity }: { severity: Severity | 'good' }) {
    const m = SEVERITY_META[severity]
    return (
        <span className={cn('inline-flex w-8 h-8 shrink-0 items-center justify-center rounded-full', m.className)} aria-label={m.label}>
            <m.Icon size={16} />
        </span>
    )
}

// ── Sparkline (12–28 points, grey with the latest point in the accent) ─────────
export function Sparkline({ values, height = 28 }: { values: (number | null)[]; height?: number }) {
    const pts = values.map((v, i) => ({ v, i })).filter((p): p is { v: number; i: number } => p.v != null)
    if (pts.length < 2) return <div style={{ height }} />
    const w = 100
    const min = Math.min(...pts.map(p => p.v)), max = Math.max(...pts.map(p => p.v))
    const span = max - min || 1
    const x = (i: number) => (i / (values.length - 1)) * w
    const y = (v: number) => height - 3 - ((v - min) / span) * (height - 6)
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
    const last = pts[pts.length - 1]
    return (
        <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full overflow-visible" style={{ height }} aria-hidden>
            <path d={d} fill="none" stroke="var(--viz-muted)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <circle cx={x(last.i)} cy={y(last.v)} r={3} fill="var(--viz-accent)" stroke="var(--card)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </svg>
    )
}

// ── Stat tile: label · value · delta vs previous period · sparkline ────────────
export function StatTile({ label, value, unit, prev, upIsGood = true, periodLabel, spark, hint, href }: {
    label: string
    value: number | null
    unit?: string
    prev?: number | null          // omit to hide the delta line entirely
    upIsGood?: boolean
    periodLabel?: string
    spark?: (number | null)[]
    hint?: string
    href?: string
}) {
    const delta = value != null && prev != null ? Math.round((value - prev) * 10) / 10 : null
    const good = delta == null || delta === 0 ? null : (delta > 0) === upIsGood
    const DeltaIcon = delta == null || delta === 0 ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight
    const body = (
        <>
            <div className="text-[12px] text-muted-foreground">{label}</div>
            <div className="mt-1.5 flex items-baseline gap-1">
                <span className="font-display font-bold text-[30px] leading-none tracking-tight text-foreground">
                    {value == null ? '—' : value.toLocaleString()}
                </span>
                {value != null && unit && <span className="text-[13px] text-muted-foreground">{unit}</span>}
            </div>
            {prev !== undefined && <div className={cn(
                'mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-medium',
                good == null ? 'text-muted-foreground' : good ? 'text-success-dark' : 'text-danger-dark',
            )}>
                <DeltaIcon size={12} aria-hidden />
                {delta == null ? 'No prior data' : `${delta > 0 ? '+' : ''}${delta}${unit === '%' ? ' pts' : unit ? ` ${unit}` : ''} vs prev ${periodLabel}`}
            </div>}
            {spark && <div className="mt-3"><Sparkline values={spark} /></div>}
            {hint && <div className="mt-2 text-[11px] text-muted-foreground">{hint}</div>}
        </>
    )
    const cls = 'block rounded-2xl bg-card border border-border p-4'
    return href
        ? <Link href={href} className={cn(cls, 'transition-colors hover:border-foreground/30')}>{body}</Link>
        : <div className={cls}>{body}</div>
}

// ── Trend: one accent area + optional grey comparison line, crosshair tooltip ──
export type TrendPoint = { label: string; value: number | null; compare?: number | null }

export function TrendChart({ data, valueLabel, compareLabel, unit = '', domain, height = 220 }: {
    data: TrendPoint[]; valueLabel: string; compareLabel?: string; unit?: string
    domain?: [number, number]; height?: number
}) {
    const hasCompare = !!compareLabel && data.some(d => d.compare != null)
    return (
        <div>
            {hasCompare && (
                <div className="flex flex-wrap gap-4 mb-2 text-[12px] text-muted-foreground">
                    <LegendKey color="var(--viz-accent)" label={valueLabel} />
                    <LegendKey color="var(--viz-muted)" label={compareLabel!} />
                </div>
            )}
            <ResponsiveContainer width="100%" height={height}>
                <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={36} domain={domain ?? ['auto', 'auto']}
                        tickFormatter={v => `${v}${unit === '%' ? '%' : ''}`} />
                    <Tooltip
                        cursor={{ stroke: 'var(--color-muted-foreground)', strokeWidth: 1 }}
                        content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null
                            const p = payload[0].payload as TrendPoint
                            return (
                                <TooltipBox title={String(label)}>
                                    <TooltipRow color="var(--viz-accent)" label={valueLabel} value={fmt(p.value, unit)} />
                                    {hasCompare && <TooltipRow color="var(--viz-muted)" label={compareLabel!} value={fmt(p.compare ?? null, unit)} />}
                                </TooltipBox>
                            )
                        }}
                    />
                    <Area type="monotone" dataKey="value" stroke="var(--viz-accent)" strokeWidth={2} fill="var(--viz-accent)" fillOpacity={0.1}
                        connectNulls dot={false} activeDot={{ r: 4, fill: 'var(--viz-accent)', stroke: 'var(--card)', strokeWidth: 2 }} />
                    {hasCompare && (
                        <Line type="monotone" dataKey="compare" stroke="var(--viz-muted)" strokeWidth={2} connectNulls dot={false}
                            activeDot={{ r: 4, fill: 'var(--viz-muted)', stroke: 'var(--card)', strokeWidth: 2 }} />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}

// ── Heatmap table: rows × metrics, each column shaded by how good the value is ─
export type HeatColumn<T> = {
    key: string; label: string
    get: (row: T) => number | null
    format: (v: number) => string
    // Fixed shading range: `weak` maps to the faintest step, `strong` to the
    // strongest. Use weak > strong for "lower is better" metrics (e.g. at-risk %).
    // Fixed ranges keep trivial gaps (56% vs 58%) from looking dramatic.
    weak: number; strong: number
}

export function HeatmapTable<T>({ rows, columns, rowLabel, rowHref, rowKey }: {
    rows: T[]; columns: HeatColumn<T>[]
    rowLabel: (r: T) => React.ReactNode; rowHref?: (r: T) => string; rowKey: (r: T) => string
}) {
    // Map a value onto 5 steps of one hue between the column's weak → strong range.
    const step = (c: HeatColumn<T>, v: number) => {
        const t = Math.max(0, Math.min(1, (v - c.weak) / (c.strong - c.weak)))
        return Math.min(5, Math.floor(t * 5) + 1)
    }
    return (
        <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-[13px] border-separate" style={{ borderSpacing: 2 }}>
                <thead>
                    <tr>
                        <th className="text-left text-[11px] font-medium text-muted-foreground px-2 py-1.5" />
                        {columns.map(c => (
                            <th key={c.key} title={`Shaded from ${c.format(c.weak)} (weak) to ${c.format(c.strong)} (strong)`}
                                className="text-[11px] font-medium text-muted-foreground px-2 py-1.5 text-center whitespace-nowrap">
                                {c.label}{c.weak > c.strong && <span className="sr-only"> (lower is better)</span>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => (
                        <tr key={rowKey(r)}>
                            <th scope="row" className="text-left font-medium text-foreground px-2 py-2 whitespace-nowrap">
                                {rowHref ? <Link href={rowHref(r)} className="hover:underline underline-offset-2">{rowLabel(r)}</Link> : rowLabel(r)}
                            </th>
                            {columns.map(c => {
                                const v = c.get(r)
                                if (v == null) return <td key={c.key} className="rounded-md bg-muted text-muted-foreground text-center px-2 py-2">—</td>
                                const s = step(c, v)
                                return (
                                    <td key={c.key} title={`${c.label}: ${c.format(v)}`}
                                        className="rounded-md text-center px-2 py-2 font-medium tabular-nums"
                                        style={{ background: `var(--viz-heat-${s})`, color: `var(--viz-heat-ink-${s})` }}>
                                        {c.format(v)}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Weaker</span>
                {[1, 2, 3, 4, 5].map(s => <span key={s} className="w-5 h-2.5 rounded-sm" style={{ background: `var(--viz-heat-${s})` }} />)}
                <span>Stronger</span>
                <span className="ml-2">· each metric against a fixed range (hover a header); for at-risk, fewer is stronger</span>
            </div>
        </div>
    )
}

// ── IPPT tiers: 100% stacked horizontal bars, one per row ──────────────────────
export const TIER_META: { key: IpptTier; label: string; color: string }[] = [
    { key: 'gold', label: 'Gold', color: 'var(--viz-tier-1)' },
    { key: 'silver', label: 'Silver', color: 'var(--viz-tier-2)' },
    { key: 'pass', label: 'Pass', color: 'var(--viz-tier-3)' },
    { key: 'fail', label: 'Fail', color: 'var(--danger)' },
    { key: 'none', label: 'No result', color: 'var(--viz-muted)' },
]

export function TierBars({ rows }: { rows: { label: string; tiers: Record<IpptTier, number>; href?: string }[] }) {
    const [hover, setHover] = useState<{ row: string; tier: IpptTier } | null>(null)
    return (
        <div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 text-[12px] text-muted-foreground">
                {TIER_META.map(t => <LegendKey key={t.key} color={t.color} label={t.label} square />)}
            </div>
            <div className="flex flex-col gap-3">
                {rows.map(r => {
                    const total = Object.values(r.tiers).reduce((a, b) => a + b, 0) || 1
                    const tested = total - r.tiers.none
                    const passing = r.tiers.gold + r.tiers.silver + r.tiers.pass
                    return (
                        <div key={r.label}>
                            <div className="flex justify-between text-[12px] mb-1">
                                {r.href ? <Link href={r.href} className="font-medium text-foreground hover:underline underline-offset-2">{r.label}</Link>
                                    : <span className="font-medium text-foreground">{r.label}</span>}
                                <span className="text-muted-foreground tabular-nums">
                                    {tested ? `${Math.round((passing / tested) * 100)}% pass` : 'No results'} · {tested}/{total} tested
                                </span>
                            </div>
                            <div className="relative flex h-3 gap-[2px]" onMouseLeave={() => setHover(null)}>
                                {TIER_META.filter(t => r.tiers[t.key] > 0).map((t, i, arr) => {
                                    const n = r.tiers[t.key]
                                    const active = hover?.row === r.label && hover.tier === t.key
                                    return (
                                        <div key={t.key}
                                            onMouseEnter={() => setHover({ row: r.label, tier: t.key })}
                                            className={cn('relative h-full', i === 0 && 'rounded-l', i === arr.length - 1 && 'rounded-r')}
                                            style={{ width: `${(n / total) * 100}%`, background: t.color, opacity: hover && hover.row === r.label && !active ? 0.55 : 1 }}>
                                            {active && (
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 pointer-events-none">
                                                    <TooltipBox title={r.label}>
                                                        <TooltipRow color={t.color} label={t.label} value={`${n} (${Math.round((n / total) * 100)}%)`} />
                                                    </TooltipBox>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Horizontal bar list (value at the tip), e.g. risk drivers ─────────────────
export function BarList({ items }: { items: { label: string; value: number; href?: string; hint?: string }[] }) {
    const max = Math.max(1, ...items.map(i => i.value))
    return (
        <ul className="flex flex-col gap-2.5">
            {items.map(it => {
                const inner = (
                    <>
                        <div className="flex justify-between text-[12px] mb-1">
                            <span className="text-foreground">{it.label}</span>
                            <span className="text-muted-foreground tabular-nums">{it.value}</span>
                        </div>
                        <div className="h-2.5 rounded-r bg-transparent">
                            <div className="h-full rounded-r transition-[width] duration-500"
                                style={{ width: `${Math.max(it.value ? 2 : 0, (it.value / max) * 100)}%`, background: it.value ? 'var(--viz-accent)' : 'transparent' }} />
                        </div>
                    </>
                )
                return (
                    <li key={it.label} title={it.hint ?? `${it.label}: ${it.value}`}>
                        {it.href ? <Link href={it.href} className="block rounded-md -mx-1 px-1 py-0.5 hover:bg-muted">{inner}</Link> : inner}
                    </li>
                )
            })}
        </ul>
    )
}

// ── Column histogram with emphasis on flagged buckets ─────────────────────────
export function Histogram({ data, height = 180, emphasisLabel }: {
    data: { label: string; count: number; emphasis: boolean }[]; height?: number; emphasisLabel: string
}) {
    return (
        <div>
            <div className="flex flex-wrap gap-4 mb-2 text-[12px] text-muted-foreground">
                <LegendKey color="var(--viz-accent)" label={emphasisLabel} square />
                <LegendKey color="var(--viz-muted)" label="Other cadets" square />
            </div>
            <ResponsiveContainer width="100%" height={height}>
                <BarChart data={data} margin={{ top: 16, right: 8, bottom: 0, left: 0 }} barCategoryGap={8}>
                    <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
                    <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
                    <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip
                        cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }}
                        content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const p = payload[0].payload as { label: string; count: number; emphasis: boolean }
                            return (
                                <TooltipBox title={`Average sleep ${p.label}`}>
                                    <TooltipRow color={p.emphasis ? 'var(--viz-accent)' : 'var(--viz-muted)'} label="Cadets" value={String(p.count)} />
                                </TooltipBox>
                            )
                        }}
                    />
                    <Bar dataKey="count" maxBarSize={24} radius={[4, 4, 0, 0]}
                        label={{ position: 'top', fontSize: 11, fill: 'var(--color-muted-foreground)' }}>
                        {data.map(d => <Cell key={d.label} fill={d.emphasis ? 'var(--viz-accent)' : 'var(--viz-muted)'} />)}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

// ── Small shared bits ─────────────────────────────────────────────────────────
export function LegendKey({ color, label, square }: { color: string; label: string; square?: boolean }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className={cn(square ? 'w-2.5 h-2.5 rounded-sm' : 'w-3 h-[2px] rounded-full')} style={{ background: color }} />
            {label}
        </span>
    )
}

export function TooltipBox({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-popover border border-border rounded-xl px-3 py-2 text-[12px] shadow-md min-w-[140px]">
            <div className="font-semibold text-foreground mb-1 whitespace-nowrap">{title}</div>
            {children}
        </div>
    )
}

export function TooltipRow({ color, label, value }: { color: string; label: string; value: string }) {
    return (
        <div className="flex items-center justify-between gap-4 whitespace-nowrap">
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />{label}
            </span>
            <span className="font-medium text-foreground tabular-nums">{value}</span>
        </div>
    )
}

function fmt(v: number | null, unit: string) {
    if (v == null) return '—'
    return unit === '%' ? `${v}%` : unit ? `${v} ${unit}` : String(v)
}

/** "2026-10-02" → "2 Oct" for chart axes. */
export function shortDate(d: string) {
    return new Date(d + 'T00:00:00Z').toLocaleDateString('en-SG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
