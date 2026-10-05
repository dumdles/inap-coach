'use client'

// ── Admin → Watchlist ─────────────────────────────────────────────────────────
// Every cadet with at least one flag, worst first. Filters (one row): wing,
// flag type (?flag= so Overview findings can deep-link), and whether to include
// low-severity "watch" flags. Flag rules live in lib/admin-analytics.ts (THRESHOLDS).

import React, { Suspense, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAdminData } from '@/components/admin/admin-data'
import { Panel, SeverityBadge } from '@/components/admin/charts'
import { CadetTable } from '@/components/admin/cadet-table'
import type { FlagKey, Severity } from '@/lib/admin-analytics'

const ALL = 'all'

export default function AdminWatchlistPage() {
    return <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}><WatchlistInner /></Suspense>
}

function WatchlistInner() {
    const { data, loading, error } = useAdminData()
    const router = useRouter()
    const params = useSearchParams()
    const flag = (params.get('flag') ?? ALL) as FlagKey | typeof ALL
    const [wing, setWing] = useState<string>(ALL)
    const [includeWatch, setIncludeWatch] = useState(false)

    const setFlag = (f: string) =>
        router.replace(f === ALL ? '/dashboard/admin/watchlist' : `/dashboard/admin/watchlist?flag=${f}`, { scroll: false })

    const filtered = useMemo(() => {
        if (!data) return []
        return data.cadets.filter(c => {
            const flags = c.flags.filter(f => includeWatch || f.severity !== 'warning')
            if (!flags.length) return false
            if (wing !== ALL && c.wing !== wing) return false
            if (flag !== ALL && !flags.some(f => f.key === flag)) return false
            return true
        })
    }, [data, wing, flag, includeWatch])

    if (error) return <p className="text-sm text-danger">{error}</p>
    if (!data) return <Skeleton className="h-96 rounded-2xl" />

    // Count cadets by their *worst* flag, for the summary strip.
    const worst = (sev: Severity) => filtered.filter(c => c.flags[0] && [...c.flags].sort(bySeverity)[0].severity === sev).length

    return (
        <div className={cn('transition-opacity', loading && 'opacity-60')}>
            {/* Filters — one row */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
                <Select value={wing} onValueChange={setWing}>
                    <SelectTrigger className="w-[160px] h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>All wings</SelectItem>
                        {data.wings.map(w => <SelectItem key={w.wing} value={w.wing}>{w.wing}</SelectItem>)}
                    </SelectContent>
                </Select>
                <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                    {[{ key: ALL, label: 'All flags' }, ...data.riskDrivers.map(r => ({ key: r.key, label: r.label }))].map(f => (
                        <button key={f.key} onClick={() => setFlag(f.key)}
                            className={cn(
                                'px-3 py-1 rounded-full text-[12px] font-medium border whitespace-nowrap transition-colors',
                                flag === f.key ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground',
                            )}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <label className="ml-auto inline-flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={includeWatch} onChange={e => setIncludeWatch(e.target.checked)} className="accent-current" />
                    Include low-severity
                </label>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <SeverityBadge severity="critical" label={`${worst('critical')} critical`} />
                <SeverityBadge severity="serious" label={`${worst('serious')} serious`} />
                {includeWatch && <SeverityBadge severity="warning" label={`${worst('warning')} watch`} />}
            </div>

            <Panel title={`${filtered.length} cadet${filtered.length === 1 ? '' : 's'} flagged`}
                subtitle={`Based on the last ${data.windowDays} days · thresholds: <6h sleep, <80% of calorie target, 4+ days without logging, IPPT within 30 days without a pass`}>
                <CadetTable cadets={filtered} windowDays={data.windowDays} emptyText="No cadets match these filters." />
            </Panel>
        </div>
    )
}

const RANK: Record<Severity, number> = { critical: 0, serious: 1, warning: 2 }
const bySeverity = (a: { severity: Severity }, b: { severity: Severity }) => RANK[a.severity] - RANK[b.severity]
