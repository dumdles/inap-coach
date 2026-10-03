'use client'

// Cadet roster used by the Wings and Watchlist tabs. One row per cadet with
// the numbers behind their flags, so a commander can see *why* someone is on
// the list. Names link to the existing cadet detail page, which superadmins
// can open for any wing (see app/api/cadet).

import React from 'react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SeverityBadge, TIER_META } from '@/components/admin/charts'
import type { CadetInsight } from '@/lib/admin-analytics'

function lastActiveLabel(c: CadetInsight) {
    if (c.daysInactive == null) return 'Never'
    if (c.daysInactive === 0) return 'Today'
    if (c.daysInactive === 1) return 'Yesterday'
    return `${c.daysInactive}d ago`
}

export function CadetTable({ cadets, windowDays, showWing = true, emptyText = 'No cadets match.' }: {
    cadets: CadetInsight[]; windowDays: number; showWing?: boolean; emptyText?: string
}) {
    if (cadets.length === 0) return <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>
    return (
        <div className="overflow-x-auto -mx-5">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="pl-5">Cadet</TableHead>
                        {showWing && <TableHead>Wing</TableHead>}
                        <TableHead>Platoon</TableHead>
                        <TableHead className="text-right">Last log</TableHead>
                        <TableHead className="text-right">Days logged</TableHead>
                        <TableHead className="text-right">Sleep</TableHead>
                        <TableHead className="text-right">Training</TableHead>
                        <TableHead>IPPT</TableHead>
                        <TableHead className="pr-5">Flags</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {cadets.map(c => {
                        const tier = c.ippt ? TIER_META.find(t => t.key === c.ippt!.tier) : null
                        return (
                            <TableRow key={c.id}>
                                <TableCell className="pl-5 font-medium whitespace-nowrap">
                                    <Link href={`/dashboard/wing/cadet/${c.id}`} className="text-foreground hover:underline underline-offset-2">
                                        {c.rank} {c.full_name}
                                    </Link>
                                </TableCell>
                                {showWing && <TableCell className="text-muted-foreground whitespace-nowrap">{c.wing}</TableCell>}
                                <TableCell className="text-muted-foreground whitespace-nowrap">{c.platoon ?? '—'}{c.section ? ` · S${c.section}` : ''}</TableCell>
                                <TableCell className="text-right tabular-nums whitespace-nowrap">{lastActiveLabel(c)}</TableCell>
                                <TableCell className="text-right tabular-nums">{c.activeDays}/{windowDays}</TableCell>
                                <TableCell className="text-right tabular-nums">{c.avgSleepH != null ? `${c.avgSleepH}h` : '—'}</TableCell>
                                <TableCell className="text-right tabular-nums whitespace-nowrap">{c.trainingMinWk}m/wk</TableCell>
                                <TableCell className="whitespace-nowrap">
                                    {c.ippt && tier ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-sm" style={{ background: tier.color }} />
                                            {tier.label} <span className="text-muted-foreground tabular-nums">{c.ippt.points}</span>
                                        </span>
                                    ) : <span className="text-muted-foreground">—</span>}
                                    {c.daysToIppt != null && c.daysToIppt >= 0 && c.daysToIppt <= 30 && (
                                        <div className="text-[11px] text-muted-foreground">Test in {c.daysToIppt}d</div>
                                    )}
                                </TableCell>
                                <TableCell className="pr-5">
                                    <div className="flex flex-wrap gap-1 min-w-[160px]">
                                        {c.flags.length === 0
                                            ? <span className="text-muted-foreground text-[12px]">—</span>
                                            : c.flags.map(f => <SeverityBadge key={f.key} severity={f.severity} label={f.label} />)}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}
