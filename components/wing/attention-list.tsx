'use client'

// ── Needs attention ───────────────────────────────────────────────────────────
// The short list an instructor acts on, instead of a wall of every cadet who
// hasn't logged yet today: silent 3+ days, patchy logging, no section — most
// urgent first (rules in lib/wing-overview.ts needsAttention). Shows the top
// few; "See all" opens the Roster tab filtered to the rest.

import React from 'react'
import { ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AttentionItem, SectionGroup } from '@/lib/wing-overview'
import { platoonLabel } from '@/lib/wing-overview'
import { Avatar, CadetLink, unitLabel } from '@/components/wing/shared'

const REASON_STYLE = {
    silent: 'bg-danger/10 text-danger',
    patchy: 'bg-warning/15 text-warning-dark',
    unassigned: 'bg-muted text-muted-foreground dark:bg-background',
} as const

export function AttentionList({ items, limit = 7, weakest, nobodyToday, onSeeAll, onOpenSection }: {
    items: AttentionItem[]
    limit?: number
    weakest: SectionGroup | null
    /** Nobody in the wing has logged yet today (e.g. early morning). */
    nobodyToday: boolean
    onSeeAll: () => void
    onOpenSection: (key: string) => void
}) {
    const top = items.slice(0, limit)
    return (
        <section className="rounded-2xl bg-card border border-border p-4 md:p-5 flex flex-col">
            <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-foreground">Needs attention</h2>
                <span className="text-[12px] text-muted-foreground tabular-nums">{items.length} cadet{items.length === 1 ? '' : 's'}</span>
            </div>
            <p className="text-[12px] text-muted-foreground mb-3">Silent 3+ days, patchy logging, or no section</p>

            {/* Section-level note first: one line instead of a list of names */}
            {nobodyToday ? (
                <div className="mb-3 rounded-xl bg-muted dark:bg-background px-3 py-2 text-[12px] text-muted-foreground">
                    Nobody has logged a meal yet today — check back after breakfast.
                </div>
            ) : weakest && weakest.stats.todayRate < 0.5 ? (
                <button onClick={() => onOpenSection(weakest.key)}
                    className="mb-3 w-full flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/[0.04] px-3 py-2 text-left text-[12px] hover:bg-danger/[0.07]">
                    <span className="flex-1 min-w-0">
                        <span className="font-semibold text-foreground">{platoonLabel(weakest.platoon)} · {weakest.label}</span>
                        <span className="text-muted-foreground"> has the fewest logs today — {weakest.stats.loggedToday} of {weakest.stats.count}</span>
                    </span>
                    <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                </button>
            ) : null}

            {top.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-8">
                    <CheckCircle2 size={22} className="text-success" />
                    <p className="text-[13px] text-muted-foreground">Everyone has logged in the last few days.</p>
                </div>
            ) : (
                <ul className="flex flex-col -mx-2">
                    {top.map(({ cadet, reasons }) => (
                        <li key={cadet.id}>
                            <CadetLink cadet={cadet} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/60 dark:hover:bg-background/60">
                                <Avatar name={cadet.full_name} size={30} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[13px] font-semibold text-foreground">{cadet.full_name}</span>
                                    <span className="block text-[11px] text-muted-foreground">{unitLabel(cadet)}</span>
                                </span>
                                <span className="flex flex-col items-end gap-1">
                                    {reasons.map(r => (
                                        <span key={r.kind} className={cn('px-1.5 h-5 inline-flex items-center rounded-full text-[10px] font-semibold whitespace-nowrap', REASON_STYLE[r.kind])}>
                                            {r.label}
                                        </span>
                                    ))}
                                </span>
                            </CadetLink>
                        </li>
                    ))}
                </ul>
            )}

            {items.length > top.length && (
                <button onClick={onSeeAll} className="mt-2 inline-flex items-center gap-1 self-start text-[13px] font-semibold text-primary hover:text-primary-dark">
                    See all {items.length} in Roster <ArrowRight size={14} />
                </button>
            )}
        </section>
    )
}
