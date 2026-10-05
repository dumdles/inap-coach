'use client'

// ── Roster tab ────────────────────────────────────────────────────────────────
// Every cadet in the wing, one compact line each: search, quick views ("Not
// logged today", "Needs attention"…), platoon/section/goal filters, sort, and
// grouping by section with collapsible headers. Groups use `content-visibility:
// auto`, so the browser skips laying out sections that are off-screen — the
// list stays smooth at 150–200 cadets without a virtual-list library.

import React, { useMemo, useState } from 'react'
import { ArrowLeftRight, ChevronDown, Flame, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    daysSilent, groupWing, matchesQuery, needsAttention, naturalCompare, platoonLabel, sectionLabel,
    type GoalMode, type WingCadet,
} from '@/lib/wing-overview'
import { isDemoCadet } from '@/lib/wing-demo'
import { Avatar, CadetLink, GOAL_META, GOAL_ORDER, GoalBadge, LastSevenStrip, TodayStatus, unitLabel } from '@/components/wing/shared'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export type RosterView = 'all' | 'not-today' | 'attention' | 'silent' | 'unassigned'
export const ROSTER_VIEWS: { key: RosterView; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'not-today', label: 'Not logged today' },
    { key: 'attention', label: 'Needs attention' },
    { key: 'silent', label: 'Silent 3+ days' },
    { key: 'unassigned', label: 'No section' },
]
type Sort = 'score' | 'streak' | 'name' | 'silent'
const ALL = '__all'

/** Shared column layout for the header and every row (desktop); phones show cadet + today. */
const COLS = 'grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_64px_72px_56px_88px_36px] items-center gap-x-3'

export function RosterHeader() {
    return (
        <div className={cn(COLS, 'hidden md:grid px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground')}>
            <span>Cadet</span><span className="text-right">Score</span><span>Last 7 days</span><span>Streak</span><span>Today</span><span />
        </div>
    )
}

export function RosterRow({ c, highlight, onManage }: { c: WingCadet; highlight?: boolean; onManage?: (c: WingCadet) => void }) {
    return (
        <div id={`cadet-${c.id}`} className={cn(COLS, 'px-3 py-2 rounded-lg transition-colors',
            highlight ? 'bg-primary/10 ring-1 ring-primary/40' : 'hover:bg-muted/60 dark:hover:bg-background/60')}>
            <CadetLink cadet={c} className="flex items-center gap-2.5 min-w-0">
                <Avatar name={c.full_name} />
                <span className="min-w-0">
                    <span className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-[13px] font-semibold text-foreground">{c.full_name}</span>
                        <GoalBadge mode={c.goal_mode} className="hidden sm:inline-flex" />
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">{c.rank} · {unitLabel(c)}</span>
                </span>
            </CadetLink>
            {/* Phones: today + last 7 days only */}
            <span className="md:hidden flex flex-col items-end gap-1"><TodayStatus cadet={c} /><LastSevenStrip cadet={c} /></span>
            <span className="hidden md:block text-right font-display font-bold tabular-nums text-foreground">{c.score}</span>
            <span className="hidden md:block"><LastSevenStrip cadet={c} /></span>
            <span className="hidden md:inline-flex items-center gap-1 text-[12px] tabular-nums text-foreground">
                {c.streak > 0 ? <><Flame size={12} className="text-warning" />{c.streak}d</> : <span className="text-muted-foreground">—</span>}
            </span>
            <span className="hidden md:block"><TodayStatus cadet={c} /></span>
            <span className="hidden md:block">
                {onManage && !isDemoCadet(c.id) && (
                    <button onClick={() => onManage(c)} title="Manage section / wing" aria-label={`Manage ${c.full_name}'s assignment`}
                        className="w-8 h-8 rounded-full inline-flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted">
                        <ArrowLeftRight size={15} />
                    </button>
                )}
            </span>
        </div>
    )
}

export function Roster({ cadets, view, onView, onManage }: {
    cadets: WingCadet[]
    view: RosterView
    onView: (v: RosterView) => void
    onManage?: (c: WingCadet) => void
}) {
    const [query, setQuery] = useState('')
    const [platoon, setPlatoon] = useState(ALL)
    const [section, setSection] = useState(ALL)
    const [goal, setGoal] = useState(ALL)
    const [sort, setSort] = useState<Sort>('score')
    const [grouped, setGrouped] = useState(true)
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

    const platoons = useMemo(() => [...new Set(cadets.map(c => c.platoon).filter(Boolean) as string[])].sort(naturalCompare), [cadets])
    const sections = useMemo(() => [...new Set(cadets.filter(c => platoon === ALL || c.platoon === platoon).map(c => c.section).filter(Boolean) as string[])].sort(naturalCompare), [cadets, platoon])
    const attentionIds = useMemo(() => new Set(needsAttention(cadets).map(a => a.cadet.id)), [cadets])

    const counts = useMemo(() => ({
        all: cadets.length,
        'not-today': cadets.filter(c => c.mealsToday === 0).length,
        attention: attentionIds.size,
        silent: cadets.filter(c => daysSilent(c) >= 3).length,
        unassigned: cadets.filter(c => !c.section).length,
    }), [cadets, attentionIds])

    const shown = useMemo(() => {
        const list = cadets.filter(c =>
            (view === 'all'
                || (view === 'not-today' && c.mealsToday === 0)
                || (view === 'attention' && attentionIds.has(c.id))
                || (view === 'silent' && daysSilent(c) >= 3)
                || (view === 'unassigned' && !c.section))
            && (platoon === ALL || c.platoon === platoon)
            && (section === ALL || c.section === section)
            && (goal === ALL || c.goal_mode === goal)
            && matchesQuery(c, query))
        return list.sort((a, b) =>
            sort === 'score' ? b.score - a.score
            : sort === 'streak' ? b.streak - a.streak
            : sort === 'silent' ? daysSilent(b) - daysSilent(a) || a.score - b.score
            : a.full_name.localeCompare(b.full_name))
    }, [cadets, view, attentionIds, platoon, section, goal, query, sort])

    // Grouped: platoon → section headers, keeping the chosen sort inside each group.
    const groups = useMemo(() => grouped
        ? groupWing(shown).flatMap(p => p.sections.map(s => ({
            key: s.key, title: `${platoonLabel(s.platoon)} · ${sectionLabel(s.section)}`,
            cadets: shown.filter(c => (c.platoon || null) === s.platoon && (c.section || null) === s.section),
            stats: s.stats,
        })))
        : [{ key: 'all', title: '', cadets: shown, stats: null }], [grouped, shown])

    const filtersOn = query || platoon !== ALL || section !== ALL || goal !== ALL
    const toggle = (k: string) => setCollapsed(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

    return (
        <section className="rounded-2xl bg-card border border-border">
            {/* Toolbar (sticks to the top while scrolling the list) */}
            <div className="sticky top-0 z-10 bg-card rounded-t-2xl border-b border-border p-3 md:p-4 flex flex-col gap-3">
                <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                    <label className="relative flex-1 min-w-0">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, rank, P2, S3…"
                            aria-label="Search cadets"
                            className="w-full h-9 rounded-full border border-border bg-background pl-9 pr-8 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                        {query && <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={14} /></button>}
                    </label>
                    <div className="grid grid-cols-2 sm:flex gap-2">
                        <FilterSelect value={platoon} onChange={v => { setPlatoon(v); setSection(ALL) }} all="All platoons"
                            options={platoons.map(p => ({ value: p, label: platoonLabel(p) }))} />
                        <FilterSelect value={section} onChange={setSection} all="All sections"
                            options={sections.map(s => ({ value: s, label: sectionLabel(s) }))} />
                        <FilterSelect value={goal} onChange={setGoal} all="All goals"
                            options={GOAL_ORDER.map(g => ({ value: g, label: GOAL_META[g as GoalMode].label }))} />
                        <FilterSelect value={sort} onChange={v => setSort(v as Sort)}
                            options={[{ value: 'score', label: 'Sort: score' }, { value: 'streak', label: 'Sort: streak' }, { value: 'silent', label: 'Sort: last log' }, { value: 'name', label: 'Sort: name' }]} />
                    </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                    {ROSTER_VIEWS.map(v => (
                        <button key={v.key} onClick={() => onView(v.key)} aria-pressed={view === v.key}
                            className={cn('shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12px] font-medium border transition-colors',
                                view === v.key ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
                            {v.label}<span className={cn('tabular-nums', view === v.key ? 'opacity-70' : 'opacity-60')}>{counts[v.key]}</span>
                        </button>
                    ))}
                    <label className="ml-auto shrink-0 inline-flex items-center gap-2 text-[12px] text-muted-foreground cursor-pointer select-none pl-2">
                        <input type="checkbox" checked={grouped} onChange={e => setGrouped(e.target.checked)} className="accent-[var(--primary)]" />
                        Group by section
                    </label>
                </div>
            </div>

            <div className="p-2 md:p-3">
                <div className="flex items-center justify-between px-3 pb-1 text-[12px] text-muted-foreground">
                    <span>{shown.length} of {cadets.length} cadets</span>
                    {filtersOn && <button onClick={() => { setQuery(''); setPlatoon(ALL); setSection(ALL); setGoal(ALL) }} className="underline underline-offset-2 hover:text-foreground">Clear filters</button>}
                </div>
                <RosterHeader />
                {shown.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">No cadets match.</p>
                ) : groups.filter(g => g.cadets.length).map(g => (
                    <div key={g.key} style={{ contentVisibility: 'auto', containIntrinsicSize: `auto ${g.cadets.length * 52 + 40}px` }}>
                        {grouped && (
                            <button onClick={() => toggle(g.key)} aria-expanded={!collapsed.has(g.key)}
                                className="w-full flex items-center gap-2 px-3 pt-3 pb-1.5 text-left">
                                <ChevronDown size={14} className={cn('text-muted-foreground transition-transform', collapsed.has(g.key) && '-rotate-90')} />
                                <span className="text-[12px] font-semibold text-foreground">{g.title}</span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {g.cadets.length}{g.stats && g.cadets.length !== g.stats.count ? ` of ${g.stats.count}` : ''} · {g.cadets.filter(c => c.mealsToday > 0).length} logged today
                                </span>
                                <span className="flex-1 border-t border-border ml-1" />
                            </button>
                        )}
                        {!collapsed.has(g.key) && g.cadets.map(c => <RosterRow key={c.id} c={c} onManage={onManage} />)}
                    </div>
                ))}
            </div>
        </section>
    )
}

function FilterSelect({ value, onChange, options, all }: {
    value: string; onChange: (v: string) => void
    options: { value: string; label: string }[]; all?: string
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-9 min-w-[120px] text-[12px]"><SelectValue /></SelectTrigger>
            <SelectContent>
                {all && <SelectItem value={ALL}>{all}</SelectItem>}
                {options.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
        </Select>
    )
}
