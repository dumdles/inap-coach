'use client'

// Small pieces shared by the My Wing components (section map, attention list,
// roster, trends). Maths lives in lib/wing-overview.ts.

import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { activeDays, daysSilent, MAX_WEEKLY_SCORE, type GoalMode, type WingCadet } from '@/lib/wing-overview'
import { isDemoCadet } from '@/lib/wing-demo'

// Goal modes: text/badge classes for labels, plus the validated --viz-goal-*
// chart hues (globals.css) for marks. Badges always carry the word, so the
// colour is never the only cue.
export const GOAL_META: Record<GoalMode, { label: string; badge: string; viz: string }> = {
    bulk:     { label: 'Bulk',     badge: 'bg-primary/10 text-primary',          viz: 'var(--viz-goal-bulk)' },
    cut:      { label: 'Cut',      badge: 'bg-danger/10 text-danger',            viz: 'var(--viz-goal-cut)' },
    maintain: { label: 'Maintain', badge: 'bg-success/10 text-success',          viz: 'var(--viz-goal-maintain)' },
    ippt:     { label: 'IPPT',     badge: 'bg-warning/15 text-warning-dark',     viz: 'var(--viz-goal-ippt)' },
}
export const GOAL_ORDER: GoalMode[] = ['bulk', 'cut', 'maintain', 'ippt']

export function GoalBadge({ mode, className }: { mode: GoalMode | null; className?: string }) {
    if (!mode) return null
    return (
        <span className={cn('inline-flex items-center h-5 px-1.5 rounded-full text-[10px] font-semibold', GOAL_META[mode].badge, className)}>
            {GOAL_META[mode].label}
        </span>
    )
}

export function initials(name: string) {
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

/** Neutral initials avatar — identity comes from the name next to it, not colour. */
export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
    return (
        <span className="rounded-full bg-muted dark:bg-background text-muted-foreground font-semibold inline-flex items-center justify-center shrink-0"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
            {initials(name)}
        </span>
    )
}

/** "P2 · S3" — where a cadet sits in the wing. */
export function unitLabel(c: Pick<WingCadet, 'platoon' | 'section'>) {
    return [c.platoon ? `P${c.platoon}` : null, c.section ? `S${c.section}` : 'No section'].filter(Boolean).join(' · ')
}

/** Links to the cadet's profile; demo cadets have no profile, so they render as plain text. */
export function CadetLink({ cadet, className, children }: { cadet: WingCadet; className?: string; children: React.ReactNode }) {
    if (isDemoCadet(cadet.id)) return <span className={className}>{children}</span>
    return <Link href={`/dashboard/wing/cadet/${cadet.id}`} className={className}>{children}</Link>
}

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Seven small bars: meals logged on each of the last 7 days (today on the right). */
export function LastSevenStrip({ cadet, className }: { cadet: WingCadet; className?: string }) {
    const days = cadet.last7 ?? [0, 0, 0, 0, 0, 0, cadet.mealsToday]
    const today = new Date().getDay()
    return (
        <span className={cn('inline-flex items-end gap-[2px] h-4', className)}
            aria-label={`Logged on ${activeDays(cadet)} of the last 7 days`}>
            {days.map((n, i) => (
                <span key={i}
                    title={`${DAY[(today - 6 + i + 7) % 7]}: ${n} meal${n === 1 ? '' : 's'}`}
                    className="w-[5px] rounded-[1.5px]"
                    style={{
                        height: n ? `${40 + Math.min(n, 3) * 20}%` : '22%',
                        background: n ? 'var(--viz-accent)' : 'var(--viz-muted)',
                        opacity: n ? 1 : 0.6,
                    }} />
            ))}
        </span>
    )
}

/** Today's logging status as words (+ colour as a secondary cue). */
export function TodayStatus({ cadet }: { cadet: WingCadet }) {
    const silent = daysSilent(cadet)
    const [text, cls] =
        cadet.mealsToday >= 3 ? ['On track', 'text-success']
        : cadet.mealsToday > 0 ? [`${cadet.mealsToday} meal${cadet.mealsToday === 1 ? '' : 's'}`, 'text-foreground']
        : silent >= 3 ? [silent >= 7 ? 'Silent 7d+' : `Silent ${silent}d`, 'text-danger font-semibold']
        : ['Not yet', 'text-muted-foreground']
    return <span className={cn('text-[12px] whitespace-nowrap', cls)}>{text}</span>
}

// ── Colour modes for the wing map squares ─────────────────────────────────────
// Sequential measures use the single-hue --viz-heat ramp (light → dark = more);
// "nothing" is an empty outlined square. Goal mode uses the categorical hues.

export type ColorBy = 'today' | 'week' | 'score' | 'goal'

type Swatch = { label: string; fill: string | null }

export const COLOR_MODES: Record<ColorBy, { label: string; hint: string; legend: Swatch[]; fill: (c: WingCadet) => string | null }> = {
    today: {
        label: 'Today',
        hint: 'Meals logged today',
        legend: [
            { label: 'None yet', fill: null },
            { label: '1', fill: 'var(--viz-heat-2)' },
            { label: '2', fill: 'var(--viz-heat-3)' },
            { label: '3+', fill: 'var(--viz-heat-5)' },
        ],
        fill: c => c.mealsToday <= 0 ? null : c.mealsToday === 1 ? 'var(--viz-heat-2)' : c.mealsToday === 2 ? 'var(--viz-heat-3)' : 'var(--viz-heat-5)',
    },
    week: {
        label: 'Last 7 days',
        hint: 'Days with a meal logged, last 7 days',
        legend: [
            { label: '0', fill: null },
            { label: '1–2', fill: 'var(--viz-heat-1)' },
            { label: '3–4', fill: 'var(--viz-heat-2)' },
            { label: '5–6', fill: 'var(--viz-heat-4)' },
            { label: '7', fill: 'var(--viz-heat-5)' },
        ],
        fill: c => {
            const d = activeDays(c)
            return d === 0 ? null : d <= 2 ? 'var(--viz-heat-1)' : d <= 4 ? 'var(--viz-heat-2)' : d <= 6 ? 'var(--viz-heat-4)' : 'var(--viz-heat-5)'
        },
    },
    score: {
        label: 'Score',
        hint: `Score this period, out of ${MAX_WEEKLY_SCORE}`,
        legend: [1, 2, 3, 4, 5].map(i => ({
            label: i === 5 ? `${Math.round(MAX_WEEKLY_SCORE * 0.8)}+` : `${Math.round(MAX_WEEKLY_SCORE * (i - 1) / 5)}`,
            fill: `var(--viz-heat-${i})`,
        })),
        fill: c => `var(--viz-heat-${Math.min(5, 1 + Math.floor((c.score / MAX_WEEKLY_SCORE) * 5))})`,
    },
    goal: {
        label: 'Goal',
        hint: 'Goal mode each cadet has set',
        legend: [
            ...(['bulk', 'cut', 'maintain', 'ippt'] as GoalMode[]).map(g => ({ label: GOAL_META[g].label, fill: GOAL_META[g].viz })),
            { label: 'Not set', fill: 'var(--viz-muted)' },
        ],
        fill: c => c.goal_mode ? GOAL_META[c.goal_mode].viz : 'var(--viz-muted)',
    },
}

/** One cadet's square (or a legend swatch): filled, or an empty outline for "none". */
export function Square({ fill, size = 14, className }: { fill: string | null; size?: number; className?: string }) {
    return (
        <span className={cn('block rounded-[3px] shrink-0', className)}
            style={{
                width: size, height: size,
                background: fill ?? 'transparent',
                boxShadow: fill ? undefined : 'inset 0 0 0 1.5px var(--viz-muted)',
            }} />
    )
}

export function Legend({ colorBy }: { colorBy: ColorBy }) {
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground" aria-label={COLOR_MODES[colorBy].hint}>
            {COLOR_MODES[colorBy].legend.map(s => (
                <span key={s.label} className="inline-flex items-center gap-1.5">
                    <Square fill={s.fill} size={10} />{s.label}
                </span>
            ))}
        </div>
    )
}
