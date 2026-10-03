'use client'

// ── Admin → Overview ──────────────────────────────────────────────────────────
// The commander's one-screen read of OCS, top to bottom:
//   1. What needs attention — plain-English findings, each linking to where to act
//   2. KPI tiles with deltas vs the previous period
//   3. Logging trend + what is putting cadets at risk
//   4. Wing-by-wing heatmap (click a wing to drill in)
//   5. IPPT readiness and sleep distribution
// All numbers come from lib/admin-analytics.ts via useAdminData().

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminData } from '@/components/admin/admin-data'
import {
    Panel, StatTile, TrendChart, HeatmapTable, TierBars, BarList, Histogram, SeverityIcon, shortDate,
} from '@/components/admin/charts'
import { WING_COLUMNS, wingHref } from '@/components/admin/wing-columns'

export default function AdminOverviewPage() {
    const { data, loading, error, period } = useAdminData()

    if (error) return <p className="text-sm text-danger">{error}</p>
    if (!data || (loading && !data)) return <OverviewSkeleton />

    const k = data.kpis
    const periodLabel = `${period}d`
    const trend = data.daily.map(d => ({ label: shortDate(d.date), value: d.activePct }))

    return (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            {/* 1 ── What needs attention */}
            <Panel title="What needs your attention" subtitle="Computed from the last period's logs — click through to act" className="mb-6">
                {data.findings.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing flagged this period.</p>
                ) : (
                    <ul className="grid gap-2 md:grid-cols-2">
                        {data.findings.map(f => (
                            <li key={f.title}>
                                <Link href={f.href ?? '#'} className="flex items-start gap-3 rounded-xl border border-border p-3 hover:bg-muted transition-colors h-full">
                                    <SeverityIcon severity={f.severity} />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[13px] font-semibold text-foreground">{f.title}</div>
                                        <div className="text-[12px] text-muted-foreground mt-0.5">{f.detail}</div>
                                    </div>
                                    <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1" aria-hidden />
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>

            {/* 2 ── KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
                <StatTile label="Daily logging rate" value={k.dailyActivePct.value} prev={k.dailyActivePct.prev} unit="%" periodLabel={periodLabel}
                    spark={data.daily.map(d => d.activePct)} />
                <StatTile label="Calories on target" value={k.adherencePct.value} prev={k.adherencePct.prev} unit="%" periodLabel={periodLabel}
                    hint="Logged days within ±10%" />
                <StatTile label="Average sleep" value={k.avgSleepH.value} prev={k.avgSleepH.prev} unit="h" periodLabel={periodLabel}
                    spark={data.daily.map(d => d.avgSleepH)} />
                <StatTile label="Training per cadet" value={k.trainingMinWk.value} prev={k.trainingMinWk.prev} unit="min/wk" periodLabel={periodLabel}
                    spark={data.daily.map(d => d.trainingMin)} />
                <StatTile label="IPPT pass rate" value={k.ipptPassPct.value} prev={k.ipptPassPct.prev} unit="%" periodLabel={periodLabel}
                    hint="Latest result per tested cadet" />
                <StatTile label="Cadets at risk" value={k.atRisk.value} prev={k.atRisk.prev} upIsGood={false} periodLabel={periodLabel}
                    hint={`of ${data.totals.cadets} · open watchlist`} href="/dashboard/admin/watchlist" />
            </div>

            {/* 3 ── Trend + risk drivers */}
            <div className="grid gap-6 lg:grid-cols-3 mb-6">
                <Panel title="Daily logging rate" subtitle="% of cadets who logged a meal, workout or sleep each day" className="lg:col-span-2">
                    <TrendChart data={trend} valueLabel="Logging rate" unit="%" domain={[0, 100]} />
                </Panel>
                <Panel title="What's putting cadets at risk" subtitle="Cadets carrying each flag">
                    <BarList items={data.riskDrivers.map(r => ({
                        label: r.label, value: r.count, href: `/dashboard/admin/watchlist?flag=${r.key}`,
                    }))} />
                </Panel>
            </div>

            {/* 4 ── Wing heatmap */}
            <Panel title="Wings at a glance" subtitle="Each metric shaded from weak to strong · click a wing to drill in" className="mb-6">
                {data.wings.length === 0 ? <p className="text-sm text-muted-foreground">No cadets yet.</p> : (
                    <HeatmapTable rows={data.wings} columns={WING_COLUMNS} rowKey={w => w.wing} rowHref={w => wingHref(w.wing)}
                        rowLabel={w => <>{w.wing} <span className="text-muted-foreground font-normal">· {w.cadets}</span></>} />
                )}
            </Panel>

            {/* 5 ── IPPT + sleep */}
            <div className="grid gap-6 lg:grid-cols-2">
                <Panel title="IPPT readiness by wing"
                    subtitle={`${data.ipptUpcoming.within14} cadets test within 14 days, ${data.ipptUpcoming.within30} within 30 · ${data.ipptUpcoming.notReady30} not ready`}>
                    <TierBars rows={data.wings.map(w => ({ label: w.wing, tiers: w.tiers, href: wingHref(w.wing) }))} />
                </Panel>
                <Panel title="Sleep distribution" subtitle="Cadets by average nightly sleep (3+ nights logged)">
                    <Histogram emphasisLabel="Under 6h" data={data.sleepBuckets.map(b => ({ label: b.label, count: b.count, emphasis: b.below6 }))} />
                </Panel>
            </div>
        </div>
    )
}

function OverviewSkeleton() {
    return (
        <div className="space-y-6">
            <Skeleton className="h-36 rounded-2xl" />
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
                <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
                <Skeleton className="h-72 rounded-2xl" />
            </div>
            <Skeleton className="h-64 rounded-2xl" />
        </div>
    )
}
