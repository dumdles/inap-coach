'use client'

// ── Trends tab ────────────────────────────────────────────────────────────────
// Wing-level patterns that hold up at 150+ cadets: summaries and distributions
// instead of one bar or dot per cadet.
//   • Sections compared — which sections are logging / scoring (one row each)
//   • Score distribution — histogram with the median, plus top / bottom 5
//   • Goal mix — one 100% stacked bar with labelled counts
//   • Streaks — cadets grouped by current logging streak
// Plain HTML bars: every value is printed next to its bar, so nothing depends on
// hover or on colour alone.

import React, { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
    MAX_WEEKLY_SCORE, activeDays, median, platoonLabel, scoreBins,
    type PlatoonGroup, type WingCadet,
} from '@/lib/wing-overview'
import { Avatar, CadetLink, GOAL_META, GOAL_ORDER, unitLabel } from '@/components/wing/shared'

type SectionMetric = 'today' | 'week' | 'score'
const SECTION_METRICS: { key: SectionMetric; label: string }[] = [
    { key: 'today', label: 'Logged today' },
    { key: 'week', label: 'Logging days (7d)' },
    { key: 'score', label: 'Avg score' },
]

function Card({ title, sub, right, children, className }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
    return (
        <section className={cn('rounded-2xl bg-card border border-border p-4 md:p-5', className)}>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                <div>
                    <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
                    {sub && <p className="text-[12px] text-muted-foreground">{sub}</p>}
                </div>
                {right}
            </div>
            {children}
        </section>
    )
}

export function Trends({ cadets, groups }: { cadets: WingCadet[]; groups: PlatoonGroup[] }) {
    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <SectionsCompared groups={groups} />
            <ScoreDistribution cadets={cadets} />
            <GoalMix cadets={cadets} />
            <StreakBuckets cadets={cadets} />
        </div>
    )
}

function SectionsCompared({ groups }: { groups: PlatoonGroup[] }) {
    const [metric, setMetric] = useState<SectionMetric>('today')
    const rows = useMemo(() => groups.flatMap(p => p.sections.filter(s => s.section !== null).map(s => {
        const value = metric === 'today' ? s.stats.todayRate * 100
            : metric === 'week' ? (s.cadets.reduce((n, c) => n + activeDays(c), 0) / (s.cadets.length * 7 || 1)) * 100
            : s.stats.avgScore
        return { key: s.key, label: `P${s.platoon ?? '–'} · S${s.section}`, title: `${platoonLabel(s.platoon)} · ${s.label}`, value, count: s.stats.count }
    })).sort((a, b) => b.value - a.value), [groups, metric])
    const max = metric === 'score' ? MAX_WEEKLY_SCORE : 100
    const fmt = (v: number) => metric === 'score' ? String(Math.round(v)) : `${Math.round(v)}%`

    return (
        <Card title="Sections compared" sub="Best to worst — spot the section that needs a word"
            right={
                <div role="radiogroup" aria-label="Compare by" className="flex items-center bg-muted dark:bg-background rounded-full p-0.5 gap-0.5 self-start">
                    {SECTION_METRICS.map(m => (
                        <button key={m.key} role="radio" aria-checked={metric === m.key} onClick={() => setMetric(m.key)}
                            className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-all',
                                metric === m.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                            {m.label}
                        </button>
                    ))}
                </div>
            }>
            {rows.length === 0 ? <p className="text-[13px] text-muted-foreground">No sections assigned yet.</p> : (
                <ul className="flex flex-col gap-1.5">
                    {rows.map(r => (
                        <li key={r.key} className="grid grid-cols-[64px_minmax(0,1fr)_44px] items-center gap-2 text-[12px]" title={`${r.title} · ${r.count} cadets · ${fmt(r.value)}`}>
                            <span className="text-muted-foreground tabular-nums">{r.label}</span>
                            <span className="h-3.5 rounded-r-[4px] rounded-l-[2px] bg-muted/60 dark:bg-background overflow-hidden">
                                <span className="block h-full rounded-r-[4px]" style={{ width: `${Math.max(1, Math.min(100, (r.value / max) * 100))}%`, background: 'var(--viz-accent)' }} />
                            </span>
                            <span className="text-right font-semibold text-foreground tabular-nums">{fmt(r.value)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    )
}

function ScoreDistribution({ cadets }: { cadets: WingCadet[] }) {
    const bins = useMemo(() => scoreBins(cadets), [cadets])
    const med = useMemo(() => median(cadets.map(c => c.score)), [cadets])
    const medBin = Math.min(bins.length - 1, Math.floor(med / (MAX_WEEKLY_SCORE / bins.length)))
    const peak = Math.max(1, ...bins.map(b => b.count))
    const ranked = useMemo(() => [...cadets].sort((a, b) => b.score - a.score), [cadets])

    return (
        <Card title="Score distribution" sub={`How many cadets in each score band · median ${med}`}>
            <div className="flex items-end gap-[2px] h-36" role="img" aria-label={`Score histogram, median ${med}`}>
                {bins.map((b, i) => (
                    <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full gap-1" title={`${b.label} pts: ${b.count} cadet${b.count === 1 ? '' : 's'}`}>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{b.count || ''}</span>
                        <span className="w-full rounded-t-[4px]"
                            style={{ height: `${(b.count / peak) * 100}%`, minHeight: b.count ? 3 : 0, background: i === medBin ? 'var(--viz-heat-5)' : 'var(--viz-heat-3)' }} />
                    </div>
                ))}
            </div>
            <div className="flex gap-[2px] mt-1 border-t border-border pt-1">
                {bins.map((b, i) => (
                    <span key={b.label} className={cn('flex-1 text-center text-[9px] tabular-nums', i === medBin ? 'text-foreground font-semibold' : 'text-muted-foreground')}>
                        {i % 2 === 0 || i === medBin ? b.from : ''}
                    </span>
                ))}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground"><span className="inline-block w-2.5 h-2.5 rounded-[2px] align-[-1px] mr-1" style={{ background: 'var(--viz-heat-5)' }} />Darker bar holds the median</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
                <RankList title="Top 5" cadets={ranked.slice(0, 5)} />
                <RankList title="Bottom 5" cadets={ranked.slice(-5).reverse()} />
            </div>
        </Card>
    )
}

function RankList({ title, cadets }: { title: string; cadets: WingCadet[] }) {
    return (
        <div>
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{title}</h3>
            <ul className="flex flex-col">
                {cadets.map(c => (
                    <li key={c.id}>
                        <CadetLink cadet={c} className="flex items-center gap-2 py-1 rounded-md hover:bg-muted/60 dark:hover:bg-background/60 px-1 -mx-1">
                            <Avatar name={c.full_name} size={22} />
                            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{c.full_name}</span>
                            <span className="text-[11px] text-muted-foreground">{unitLabel(c)}</span>
                            <span className="w-9 text-right text-[12px] font-semibold tabular-nums text-foreground">{c.score}</span>
                        </CadetLink>
                    </li>
                ))}
            </ul>
        </div>
    )
}

function GoalMix({ cadets }: { cadets: WingCadet[] }) {
    const total = cadets.length || 1
    const counts = GOAL_ORDER.map(g => ({ g, n: cadets.filter(c => c.goal_mode === g).length }))
    const none = cadets.filter(c => !c.goal_mode).length
    return (
        <Card title="Goal mix" sub="What cadets are training for">
            <div className="flex h-4 gap-[2px] rounded-full overflow-hidden" role="img"
                aria-label={counts.map(({ g, n }) => `${GOAL_META[g].label} ${n}`).join(', ')}>
                {counts.filter(x => x.n).map(({ g, n }) => (
                    <span key={g} style={{ width: `${(n / total) * 100}%`, background: GOAL_META[g].viz }} title={`${GOAL_META[g].label}: ${n}`} />
                ))}
                {none > 0 && <span style={{ width: `${(none / total) * 100}%`, background: 'var(--viz-muted)' }} title={`Not set: ${none}`} />}
            </div>
            <ul className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {counts.map(({ g, n }) => (
                    <li key={g} className="flex flex-col">
                        <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: GOAL_META[g].viz }} />{GOAL_META[g].label}
                        </span>
                        <span className="font-display text-xl font-bold text-foreground tabular-nums">{n}
                            <span className="text-[12px] font-normal text-muted-foreground"> · {Math.round((n / total) * 100)}%</span>
                        </span>
                    </li>
                ))}
            </ul>
            {none > 0 && <p className="mt-2 text-[12px] text-muted-foreground">{none} haven’t set a goal yet.</p>}
        </Card>
    )
}

const STREAKS = [
    { label: 'No streak', min: 0, max: 0, fill: null },
    { label: '1–2 days', min: 1, max: 2, fill: 'var(--viz-heat-2)' },
    { label: '3–6 days', min: 3, max: 6, fill: 'var(--viz-heat-3)' },
    { label: '1–2 weeks', min: 7, max: 13, fill: 'var(--viz-heat-4)' },
    { label: '2 weeks+', min: 14, max: Infinity, fill: 'var(--viz-heat-5)' },
]

function StreakBuckets({ cadets }: { cadets: WingCadet[] }) {
    const rows = STREAKS.map(b => ({ ...b, n: cadets.filter(c => c.streak >= b.min && c.streak <= b.max).length }))
    const peak = Math.max(1, ...rows.map(r => r.n))
    return (
        <Card title="Logging streaks" sub="Consecutive days with a meal logged, up to today (a streak shows 0 until today's first log)">
            <ul className="flex flex-col gap-2">
                {rows.map(r => (
                    <li key={r.label} className="grid grid-cols-[80px_minmax(0,1fr)_36px] items-center gap-2 text-[12px]">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="h-3.5 flex items-center">
                            <span className="h-full rounded-r-[4px] rounded-l-[2px]"
                                style={{ width: `${Math.max(r.n ? 1 : 0, (r.n / peak) * 100)}%`, background: r.fill ?? 'transparent', boxShadow: r.fill ? undefined : 'inset 0 0 0 1.5px var(--viz-muted)' }} />
                        </span>
                        <span className="text-right font-semibold text-foreground tabular-nums">{r.n}</span>
                    </li>
                ))}
            </ul>
        </Card>
    )
}
