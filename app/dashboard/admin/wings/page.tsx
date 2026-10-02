'use client'

// ── Admin → Wings ─────────────────────────────────────────────────────────────
// Drill into one wing: how it compares with the OCS average, its logging trend
// against OCS, a platoon-by-platoon heatmap, IPPT readiness per platoon and the
// full cadet roster sorted by risk. The selected wing lives in ?wing= so
// findings on the Overview can deep-link here.

import React, { Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAdminData } from '@/components/admin/admin-data'
import { Panel, StatTile, TrendChart, HeatmapTable, TierBars, shortDate } from '@/components/admin/charts'
import { CadetTable } from '@/components/admin/cadet-table'
import { WING_COLUMNS, wingHref, type MetricRow } from '@/components/admin/wing-columns'
import type { CadetInsight, IpptTier } from '@/lib/admin-analytics'

type PlatoonRow = MetricRow & { platoon: string; cadets: number; tiers: Record<IpptTier, number> }

const avgOf = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null)
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
}

/** Roll cadets up into platoon rows (cadet-weighted means of each metric). */
function platoonRows(cadets: CadetInsight[], windowDays: number): PlatoonRow[] {
    const groups = new Map<string, CadetInsight[]>()
    for (const c of cadets) {
        const key = c.platoon ? (/^\d+$/.test(c.platoon) ? `Platoon ${c.platoon}` : c.platoon) : 'No platoon'
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(c)
    }
    return [...groups.entries()].map(([platoon, cs]) => {
        const tiers: Record<IpptTier, number> = { gold: 0, silver: 0, pass: 0, fail: 0, none: 0 }
        for (const c of cs) tiers[c.ippt?.tier ?? 'none']++
        const tested = cs.length - tiers.none
        const atRisk = cs.filter(c => c.flags.some(f => f.severity !== 'warning')).length
        const round = (n: number | null) => (n == null ? null : Math.round(n))
        return {
            platoon, cadets: cs.length, tiers,
            activePct: round(avgOf(cs.map(c => (c.activeDays / windowDays) * 100))),
            adherencePct: round(avgOf(cs.map(c => c.adherencePct))),
            proteinHitPct: round(avgOf(cs.map(c => c.proteinHitPct))),
            avgSleepH: avgOf(cs.map(c => c.avgSleepH)),
            trainingMinWk: round(avgOf(cs.map(c => c.trainingMinWk))),
            ipptPassPct: tested ? Math.round(((tested - tiers.fail) / tested) * 100) : null,
            atRiskPct: Math.round((atRisk / cs.length) * 100),
        }
    }).sort((a, b) => a.platoon.localeCompare(b.platoon, undefined, { numeric: true }))
}

export default function AdminWingsPage() {
    return <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}><WingsInner /></Suspense>
}

function WingsInner() {
    const { data, loading, error, period } = useAdminData()
    const router = useRouter()
    const params = useSearchParams()

    const wingName = params.get('wing') ?? data?.wings[0]?.wing ?? null
    const wing = data?.wings.find(w => w.wing === wingName) ?? null
    const cadets = useMemo(() => (data && wing ? data.cadets.filter(c => c.wing === wing.wing) : []), [data, wing])
    const platoons = useMemo(() => (data ? platoonRows(cadets, data.windowDays) : []), [cadets, data])

    if (error) return <p className="text-sm text-danger">{error}</p>
    if (!data) return <Skeleton className="h-96 rounded-2xl" />
    if (!wing) return <p className="text-sm text-muted-foreground">No wing selected.</p>

    const k = data.kpis
    const ocs = (v: number | null, unit: string) => (v == null ? 'OCS —' : `OCS ${v}${unit}`)
    const trend = data.dates.map((d, i) => ({
        label: shortDate(d), value: data.dailyByWing[wing.wing]?.[i] ?? null, compare: data.daily[i]?.activePct ?? null,
    }))

    return (
        <div className={cn('transition-opacity', loading && 'opacity-60')}>
            {/* Wing picker — one row of chips above the content */}
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-6" role="tablist" aria-label="Wing">
                {data.wings.map(w => (
                    <button key={w.wing} role="tab" aria-selected={w.wing === wing.wing}
                        onClick={() => router.replace(wingHref(w.wing), { scroll: false })}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-[12px] font-medium border whitespace-nowrap transition-colors',
                            w.wing === wing.wing ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                        )}>
                        {w.wing}
                        {w.atRisk > 0 && <span className="ml-1.5 tabular-nums opacity-70">{w.atRisk}</span>}
                    </button>
                ))}
            </div>

            {/* Wing vs OCS */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
                <StatTile label="Daily logging rate" value={wing.activePct} prev={wing.prevActivePct} unit="%" periodLabel={`${period}d`}
                    hint={ocs(k.dailyActivePct.value, '%')} />
                <StatTile label="Calories on target" value={wing.adherencePct} unit="%" hint={ocs(k.adherencePct.value, '%')} />
                <StatTile label="Average sleep" value={wing.avgSleepH} unit="h" hint={ocs(k.avgSleepH.value, 'h')} />
                <StatTile label="Training per cadet" value={wing.trainingMinWk} unit="min/wk" hint={ocs(k.trainingMinWk.value, ' min')} />
                <StatTile label="IPPT pass rate" value={wing.ipptPassPct} unit="%" hint={ocs(k.ipptPassPct.value, '%')} />
                <StatTile label="Cadets at risk" value={wing.atRisk} hint={`${wing.atRiskPct}% of ${wing.cadets} cadets`} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3 mb-6">
                <Panel title={`${wing.wing} logging vs OCS`} subtitle="% of cadets logging anything each day" className="lg:col-span-2">
                    <TrendChart data={trend} valueLabel={wing.wing} compareLabel="OCS average" unit="%" domain={[0, 100]} />
                </Panel>
                <Panel title="IPPT readiness by platoon" subtitle={`${wing.upcomingIppt} cadets test within 30 days`}>
                    <TierBars rows={platoons.map(p => ({ label: p.platoon, tiers: p.tiers }))} />
                </Panel>
            </div>

            <Panel title="Platoons" subtitle="Each metric shaded from weak to strong" className="mb-6">
                <HeatmapTable rows={platoons} columns={WING_COLUMNS} rowKey={p => p.platoon}
                    rowLabel={p => <>{p.platoon} <span className="text-muted-foreground font-normal">· {p.cadets}</span></>} />
            </Panel>

            <Panel title="Cadets" subtitle="Sorted by risk — highest first">
                <CadetTable cadets={cadets} windowDays={data.windowDays} showWing={false} />
            </Panel>
        </div>
    )
}
