// ── My Wing overview maths ────────────────────────────────────────────────────
// Pure helpers behind the instructor's My Wing page (app/dashboard/wing): group a
// wing's cadets by platoon → section, summarise each group, and pick out the few
// cadets who need attention. No React, no DB — fed by /api/leaderboard rows (or
// the fake wing in lib/wing-demo.ts) and unit-testable on their own.
//
// Wings have 100–200 cadets, so the page never lists everyone at once: it shows
// sections first (components/wing/section-map.tsx), a short "needs attention"
// list, and the full roster only on its own tab.

export type GoalMode = 'bulk' | 'cut' | 'maintain' | 'ippt'

/** One row of GET /api/leaderboard?scope=wing. */
export type WingCadet = {
    id: string
    full_name: string
    rank: string
    wing: string
    platoon: string | null
    section: string | null
    goal_mode: GoalMode | null
    score: number
    streak: number
    mealsToday: number
    position: number
    /** Meals logged on each of the last 7 days, oldest → today. */
    last7?: number[]
}

/** The weekly score ceiling (lib/scoring.ts) — bars and bins are drawn against it. */
export const MAX_WEEKLY_SCORE = 840

/** Silent this many days or more → flagged in "Needs attention". */
export const SILENT_DAYS = 3

/** 7-day history, falling back to "today only" for rows from an older API. */
function history(c: WingCadet): number[] {
    if (c.last7?.length === 7) return c.last7
    return [0, 0, 0, 0, 0, 0, c.mealsToday]
}

/** Days in the last 7 with at least one meal logged (0–7). */
export function activeDays(c: WingCadet): number {
    return history(c).filter(n => n > 0).length
}

/** Days since the cadet last logged a meal: 0 = today, 7 = not in the last 7 days. */
export function daysSilent(c: WingCadet): number {
    const h = history(c)
    for (let i = h.length - 1; i >= 0; i--) if (h[i] > 0) return h.length - 1 - i
    return 7
}

/** Sorts "2" before "10", and puts missing values last. */
export function naturalCompare(a: string | null, b: string | null): number {
    if (a === b) return 0
    if (a === null) return 1
    if (b === null) return -1
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

export type GroupStats = {
    count: number
    loggedToday: number
    /** Logged at least once in the last 7 days. */
    active7: number
    /** Silent SILENT_DAYS+ days. */
    silent: number
    avgScore: number
    /** Share of the group that logged today, 0–1. */
    todayRate: number
}

export function groupStats(cadets: WingCadet[]): GroupStats {
    const count = cadets.length
    const loggedToday = cadets.filter(c => c.mealsToday > 0).length
    const active7 = cadets.filter(c => activeDays(c) > 0).length
    const silent = cadets.filter(c => daysSilent(c) >= SILENT_DAYS).length
    const avgScore = count ? Math.round(cadets.reduce((s, c) => s + c.score, 0) / count) : 0
    return { count, loggedToday, active7, silent, avgScore, todayRate: count ? loggedToday / count : 0 }
}

export type SectionGroup = {
    /** Stable id, e.g. "2|3" (platoon|section); '' parts = not assigned. */
    key: string
    platoon: string | null
    section: string | null
    label: string
    cadets: WingCadet[]
    stats: GroupStats
}

export type PlatoonGroup = {
    platoon: string | null
    label: string
    sections: SectionGroup[]
    stats: GroupStats
}

export function platoonLabel(p: string | null) {
    return p === null ? 'No platoon' : /^\d+$/.test(p) ? `Platoon ${p}` : p
}
export function sectionLabel(s: string | null) {
    return s === null ? 'No section' : /^\d+$/.test(s) ? `Section ${s}` : s
}

/**
 * Platoon → section tree, in natural order, cadets within a section by score.
 * Cadets without a section get their own "No section" group so they stay visible.
 */
export function groupWing(cadets: WingCadet[]): PlatoonGroup[] {
    const byPlatoon = new Map<string | null, Map<string | null, WingCadet[]>>()
    for (const c of cadets) {
        const p = c.platoon || null, s = c.section || null
        if (!byPlatoon.has(p)) byPlatoon.set(p, new Map())
        const secs = byPlatoon.get(p)!
        if (!secs.has(s)) secs.set(s, [])
        secs.get(s)!.push(c)
    }
    return [...byPlatoon.entries()]
        .sort(([a], [b]) => naturalCompare(a, b))
        .map(([platoon, secs]) => {
            const sections = [...secs.entries()]
                .sort(([a], [b]) => naturalCompare(a, b))
                .map(([section, list]) => ({
                    key: `${platoon ?? ''}|${section ?? ''}`,
                    platoon, section,
                    label: sectionLabel(section),
                    cadets: [...list].sort((a, b) => b.score - a.score || a.full_name.localeCompare(b.full_name)),
                    stats: groupStats(list),
                }))
            return { platoon, label: platoonLabel(platoon), sections, stats: groupStats(sections.flatMap(s => s.cadets)) }
        })
}

export type AttentionReason = { kind: 'silent' | 'patchy' | 'unassigned'; label: string }
export type AttentionItem = { cadet: WingCadet; reasons: AttentionReason[]; severity: number }

/**
 * Cadets who need an instructor's attention, most urgent first:
 *   • silent — no meal logged for SILENT_DAYS+ days
 *   • patchy — logged on only 1–2 of the last 7 days
 *   • unassigned — no section (an admin fix in the cadet's assignment dialog)
 * Not having logged *today* alone isn't a flag — early in the day that's everyone.
 */
export function needsAttention(cadets: WingCadet[]): AttentionItem[] {
    const items: AttentionItem[] = []
    for (const c of cadets) {
        const reasons: AttentionReason[] = []
        let severity = 0
        const silent = daysSilent(c), active = activeDays(c)
        if (silent >= SILENT_DAYS) {
            reasons.push({ kind: 'silent', label: silent >= 7 ? 'No logs in 7+ days' : `Silent ${silent} days` })
            severity += 100 + silent * 10
        } else if (active <= 2) {
            reasons.push({ kind: 'patchy', label: `Logged ${active} of 7 days` })
            severity += 50 - active * 5
        }
        if (!c.section) {
            reasons.push({ kind: 'unassigned', label: 'No section' })
            severity += 20
        }
        if (reasons.length) items.push({ cadet: c, reasons, severity })
    }
    return items.sort((a, b) => b.severity - a.severity || a.cadet.score - b.cadet.score || a.cadet.full_name.localeCompare(b.cadet.full_name))
}

/** The section with the lowest share of cadets logged today (ignores 1–2 person groups). */
export function weakestSectionToday(groups: PlatoonGroup[]): SectionGroup | null {
    const all = groups.flatMap(g => g.sections).filter(s => s.section !== null && s.stats.count >= 3)
    if (!all.length) return null
    return all.reduce((w, s) => s.stats.todayRate < w.stats.todayRate ? s : w)
}

export type ScoreBin = { from: number; to: number; count: number; label: string }

/** Histogram of scores in `bins` equal bins over 0–MAX; scores above MAX (challenge bonus) fall in the last bin. */
export function scoreBins(cadets: WingCadet[], bins = 10, max = MAX_WEEKLY_SCORE): ScoreBin[] {
    const width = max / bins
    const out = Array.from({ length: bins }, (_, i) => ({
        from: Math.round(i * width),
        to: Math.round((i + 1) * width),
        count: 0,
        label: i === bins - 1 ? `${Math.round(i * width)}+` : `${Math.round(i * width)}–${Math.round((i + 1) * width) - 1}`,
    }))
    for (const c of cadets) out[Math.min(bins - 1, Math.max(0, Math.floor(c.score / width)))].count++
    return out
}

export function median(values: number[]): number {
    if (!values.length) return 0
    const s = [...values].sort((a, b) => a - b)
    const m = Math.floor(s.length / 2)
    return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

/** Case-insensitive match on name, rank, platoon or section ("p2 s3" style queries work too). */
export function matchesQuery(c: WingCadet, query: string): boolean {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return true
    const hay = [c.full_name, c.rank, c.platoon ? `p${c.platoon} platoon ${c.platoon}` : '', c.section ? `s${c.section} sec ${c.section}` : '', c.goal_mode ?? '']
        .join(' ').toLowerCase()
    return terms.every(t => hay.includes(t))
}
