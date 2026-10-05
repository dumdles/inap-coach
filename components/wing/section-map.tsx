'use client'

// ── Wing map ──────────────────────────────────────────────────────────────────
// The whole wing on one screen: a tile per section (grouped by platoon), with
// every cadet as one small square — like the wing fallen in on the parade
// square. "Colour by" switches what the squares show (today's logging, last 7
// days, score, goal mode). Hover a square for the cadet; click a square or a
// section header to open that section (SectionDialog in the page).

import React, { useRef, useState } from 'react'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysSilent, activeDays, type PlatoonGroup, type SectionGroup, type WingCadet } from '@/lib/wing-overview'
import { COLOR_MODES, GoalBadge, Legend, Square, unitLabel, type ColorBy } from '@/components/wing/shared'

type Hover = { cadet: WingCadet; x: number; y: number } | null

export function SectionMap({ groups, colorBy, onColorBy, onOpenSection, weakestKey }: {
    groups: PlatoonGroup[]
    colorBy: ColorBy
    onColorBy: (c: ColorBy) => void
    /** Open a section's detail; `cadetId` highlights the square that was clicked. */
    onOpenSection: (key: string, cadetId?: string) => void
    /** Section with the lowest logging today — gets a subtle marker. */
    weakestKey?: string | null
}) {
    const wrap = useRef<HTMLDivElement>(null)
    const [hover, setHover] = useState<Hover>(null)

    // Position the single shared tooltip above the hovered/focused square.
    function show(cadet: WingCadet, el: HTMLElement) {
        const box = wrap.current?.getBoundingClientRect(), r = el.getBoundingClientRect()
        if (!box) return
        setHover({ cadet, x: r.left - box.left + r.width / 2, y: r.top - box.top })
    }

    return (
        <section className="rounded-2xl bg-card border border-border p-4 md:p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-[15px] font-semibold text-foreground">Wing map</h2>
                    <p className="text-[12px] text-muted-foreground">Each square is a cadet · {COLOR_MODES[colorBy].hint.toLowerCase()}</p>
                </div>
                <div role="radiogroup" aria-label="Colour squares by" className="flex items-center bg-muted dark:bg-background rounded-full p-0.5 gap-0.5 self-start">
                    {(Object.keys(COLOR_MODES) as ColorBy[]).map(k => (
                        <button key={k} role="radio" aria-checked={colorBy === k} onClick={() => onColorBy(k)}
                            className={cn('px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap',
                                colorBy === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                            {COLOR_MODES[k].label}
                        </button>
                    ))}
                </div>
            </div>
            <Legend colorBy={colorBy} />

            <div ref={wrap} className="@container relative mt-4 flex flex-col gap-5" onMouseLeave={() => setHover(null)}>
                {groups.map(p => (
                    <div key={p.platoon ?? 'none'}>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                            <h3 className="text-[13px] font-semibold text-foreground">{p.label}</h3>
                            <span className="text-[12px] text-muted-foreground tabular-nums">
                                {p.stats.count} cadets · {Math.round(p.stats.todayRate * 100)}% logged today · avg {p.stats.avgScore}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 @[18rem]:grid-cols-2 @[34rem]:grid-cols-3 @[44rem]:grid-cols-4 gap-2.5">
                            {p.sections.map(s => (
                                <SectionTile key={s.key} s={s} colorBy={colorBy} weakest={s.key === weakestKey}
                                    onOpen={cadetId => onOpenSection(s.key, cadetId)}
                                    onHover={show} onLeave={() => setHover(null)} />
                            ))}
                        </div>
                    </div>
                ))}

                {/* One shared tooltip for every square */}
                {hover && (
                    <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full -mt-2 w-max max-w-[240px] rounded-xl border border-border bg-popover px-3 py-2 shadow-md text-[12px]"
                        style={{ left: hover.x, top: hover.y - 6 }}>
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground truncate">{hover.cadet.full_name}</span>
                            <GoalBadge mode={hover.cadet.goal_mode} />
                        </div>
                        <div className="text-muted-foreground mt-0.5 tabular-nums">
                            {unitLabel(hover.cadet)} · {hover.cadet.score} pts
                        </div>
                        <div className="text-muted-foreground tabular-nums">
                            Today {hover.cadet.mealsToday} meal{hover.cadet.mealsToday === 1 ? '' : 's'} · {activeDays(hover.cadet)}/7 days
                            {daysSilent(hover.cadet) >= 3 && <span className="text-danger font-medium"> · silent {daysSilent(hover.cadet) >= 7 ? '7+' : daysSilent(hover.cadet)}d</span>}
                        </div>
                    </div>
                )}
            </div>
        </section>
    )
}

function SectionTile({ s, colorBy, weakest, onOpen, onHover, onLeave }: {
    s: SectionGroup
    colorBy: ColorBy
    weakest: boolean
    onOpen: (cadetId?: string) => void
    onHover: (c: WingCadet, el: HTMLElement) => void
    onLeave: () => void
}) {
    const fill = COLOR_MODES[colorBy].fill
    const pct = Math.round(s.stats.todayRate * 100)
    return (
        <div className={cn('@container/tile rounded-xl border p-3 transition-colors',
            weakest ? 'border-danger/40 bg-danger/[0.03]' : 'border-border hover:border-foreground/20')}>
            <button onClick={() => onOpen()} className="group w-full flex items-center justify-between gap-2 text-left">
                <span className="text-[13px] font-semibold text-foreground inline-flex items-center gap-0.5 min-w-0 whitespace-nowrap">
                    <span className="truncate">{s.label}</span>
                    <ChevronRight size={14} className="text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                    <span className="text-foreground font-semibold">{s.stats.loggedToday}</span>/{s.stats.count}
                    <span className="hidden @[11rem]/tile:inline"> today</span>
                </span>
            </button>
            {/* Today's logging rate for the section */}
            <div className="mt-1.5 h-1 rounded-full bg-muted dark:bg-background overflow-hidden" aria-hidden>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--viz-accent)' }} />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-[2px]">
                {s.cadets.map(c => (
                    <button key={c.id}
                        aria-label={`${c.full_name}: ${c.mealsToday} meals today, ${c.score} points`}
                        onClick={() => onOpen(c.id)}
                        onMouseEnter={e => onHover(c, e.currentTarget)} onFocus={e => onHover(c, e.currentTarget)}
                        onBlur={onLeave}
                        className="p-[2px] rounded-[4px] hover:bg-foreground/10 focus-visible:outline-2 focus-visible:outline-primary">
                        <Square fill={fill(c)} />
                    </button>
                ))}
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground tabular-nums">
                <span>avg {s.stats.avgScore}</span>
                {s.stats.silent > 0
                    ? <span className="inline-flex items-center gap-1 text-danger font-medium"><AlertTriangle size={11} />{s.stats.silent} silent</span>
                    : weakest ? <span className="text-danger font-medium">Lowest today</span> : null}
            </div>
        </div>
    )
}
