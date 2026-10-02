// ── Challenges: pure scoring + validation ────────────────────────────────────
// Shared by the API (app/api/challenges, app/api/_lib/challenges.ts) and the UI.
// No DB access here — the server fetches raw logs and passes them in, which
// keeps the rules readable and unit-testable.
//
// How a challenge works
//  • An instructor (own wing) or superadmin (any/all wings) creates it with a
//    metric, a time window and an optional bonus.
//  • Every cadet in scope is auto-enrolled; their score is computed live from
//    what they already log (meals, workouts, sleep) between starts_at and ends_at.
//  • Format "individual" ranks cadets; "team" ranks sections/platoons/wings by
//    the AVERAGE of their members' scores (fair across team sizes, and every
//    member counts — a cadet who logs nothing pulls the team down).
//  • When it ends, places 1–3 earn bonus points (100% / 60% / 30% of the bonus),
//    which are added to the wing leaderboard (see SCORING_SYSTEM.md).

import { calculateProteinRequirement, type GoalMode } from '@/lib/tdee'

// ── Metrics ──────────────────────────────────────────────────────────────────
export const CHALLENGE_METRICS = {
    distance_km:     { label: 'Distance',               unit: 'km',      group: 'Training',    hint: 'Total distance across logged and Polar workouts' },
    workout_minutes: { label: 'Training time',          unit: 'min',     group: 'Training',    hint: 'Total minutes of logged workouts' },
    workouts:        { label: 'Workouts logged',        unit: 'sessions', group: 'Training',   hint: 'Number of workouts logged' },
    calorie_days:    { label: 'Days on calorie target', unit: 'days',    group: 'Nutrition',   hint: 'Days with intake within ±10% of target' },
    protein_days:    { label: 'Days hitting protein',   unit: 'days',    group: 'Nutrition',   hint: 'Days reaching 90%+ of protein target' },
    meals_logged:    { label: 'Meals logged',           unit: 'meals',   group: 'Nutrition',   hint: 'Number of meals logged' },
    active_days:     { label: 'Active days',            unit: 'days',    group: 'Consistency', hint: 'Days with any meal, workout or sleep logged' },
    best_streak:     { label: 'Longest streak',         unit: 'days',    group: 'Consistency', hint: 'Longest run of consecutive active days' },
} as const

export type ChallengeMetric = keyof typeof CHALLENGE_METRICS
export const METRIC_KEYS = Object.keys(CHALLENGE_METRICS) as ChallengeMetric[]

export type ChallengeFormat = 'individual' | 'team'
export type TeamLevel = 'section' | 'platoon' | 'wing'

export type Challenge = {
    id: string; title: string; description: string | null
    metric: ChallengeMetric; format: ChallengeFormat; team_level: TeamLevel | null
    scope_wing: string | null; scope_platoon: string | null
    starts_at: string; ends_at: string; bonus_points: number
    created_by: string; created_at: string
    finalized_at: string | null; results: ChallengeResults | null
}

// ── Limits (shared by the create dialog and the API) ─────────────────────────
export const LIMITS = {
    titleMin: 3, titleMax: 80, descriptionMax: 280,
    bonusMin: 0, bonusMax: 200,
    minHours: 1, maxDays: 60,
}
export const AWARD_SHARES = [1, 0.6, 0.3] // places 1–3, as a share of bonus_points

export type ChallengeInput = {
    title: string; description?: string | null
    metric: string; format: string; team_level?: string | null
    scope_wing?: string | null; scope_platoon?: string | null
    starts_at: string; ends_at: string; bonus_points: number
}

/** Field → message. Empty object means valid. Used client-side (inline) and server-side (400). */
export function validateChallenge(c: Partial<ChallengeInput>, now = Date.now()): Record<string, string> {
    const e: Record<string, string> = {}
    const title = (c.title ?? '').trim()
    if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax) e.title = `Title must be ${LIMITS.titleMin}–${LIMITS.titleMax} characters`
    if ((c.description ?? '').length > LIMITS.descriptionMax) e.description = `Description must be at most ${LIMITS.descriptionMax} characters`
    if (!METRIC_KEYS.includes(c.metric as ChallengeMetric)) e.metric = 'Pick what to measure'
    if (c.format !== 'individual' && c.format !== 'team') e.format = 'Pick individual or team'
    if (c.format === 'team') {
        if (!['section', 'platoon', 'wing'].includes(c.team_level ?? '')) e.team_level = 'Pick which units compete'
        else if (c.team_level === 'wing' && c.scope_wing) e.team_level = 'Wing vs wing needs the challenge open to all wings'
        else if (c.team_level === 'platoon' && c.scope_platoon) e.team_level = 'Platoon vs platoon needs the whole wing, not one platoon'
    }
    if (c.scope_platoon && !c.scope_wing) e.scope_platoon = 'Pick a wing before limiting to a platoon'

    const start = Date.parse(c.starts_at ?? ''), end = Date.parse(c.ends_at ?? '')
    if (Number.isNaN(start)) e.starts_at = 'Pick a start time'
    else if (start < now - 24 * 3600_000) e.starts_at = 'Start can be at most 1 day in the past'
    if (Number.isNaN(end)) e.ends_at = 'Pick an end time'
    else if (!Number.isNaN(start)) {
        if (end - start < LIMITS.minHours * 3600_000) e.ends_at = `Must run at least ${LIMITS.minHours} hour`
        else if (end - start > LIMITS.maxDays * 86400_000) e.ends_at = `Can run at most ${LIMITS.maxDays} days`
    }

    const b = Number(c.bonus_points)
    if (!Number.isInteger(b) || b < LIMITS.bonusMin || b > LIMITS.bonusMax) e.bonus_points = `Bonus must be a whole number ${LIMITS.bonusMin}–${LIMITS.bonusMax}`
    return e
}

// ── Status helpers ───────────────────────────────────────────────────────────
export type ChallengeStatus = 'upcoming' | 'live' | 'ended'
export function challengeStatus(c: Pick<Challenge, 'starts_at' | 'ends_at'>, now = Date.now()): ChallengeStatus {
    if (now < Date.parse(c.starts_at)) return 'upcoming'
    if (now < Date.parse(c.ends_at)) return 'live'
    return 'ended'
}

/** Is this cadet auto-enrolled in the challenge? */
export function inScope(c: Pick<Challenge, 'scope_wing' | 'scope_platoon'>, u: { wing: string | null; platoon: string | null }) {
    if (c.scope_wing && u.wing !== c.scope_wing) return false
    if (c.scope_platoon && u.platoon !== c.scope_platoon) return false
    return true
}

/** "Hawk Wing · Platoon 2" / "All wings" — for cards and headers. */
export function scopeLabel(c: Pick<Challenge, 'scope_wing' | 'scope_platoon'>) {
    if (!c.scope_wing) return 'All wings'
    return c.scope_platoon ? `${c.scope_wing} · Platoon ${c.scope_platoon}` : `${c.scope_wing} Wing`
}

export function formatLabel(c: Pick<Challenge, 'format' | 'team_level'>) {
    if (c.format === 'individual') return 'Individual'
    return { section: 'Section vs section', platoon: 'Platoon vs platoon', wing: 'Wing vs wing' }[c.team_level ?? 'section']
}

// ── Scoring ──────────────────────────────────────────────────────────────────
export type Participant = {
    id: string; full_name: string | null; rank: string | null
    wing: string | null; platoon: string | null; section: string | null
    goal_mode: string | null; weight_kg: number | null
}
export type ChallengeLogs = {
    workouts: { user_id: string; logged_at: string; duration_min: number | null; distance_km: number | null }[]
    meals: { user_id: string; logged_at: string }[]
    summaries: { user_id: string; date: string; total_calories: number; total_protein_g: number; calorie_target: number | null }[]
    sleeps: { user_id: string; night_date: string }[]
}

const sgDate = (iso: string) => new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10)
const round1 = (n: number) => Math.round(n * 10) / 10

/** Longest run of consecutive calendar dates in the set. */
function longestStreak(dates: Set<string>) {
    const sorted = [...dates].sort()
    let best = 0, run = 0, prev = ''
    for (const d of sorted) {
        const next = prev ? new Date(Date.parse(prev + 'T00:00:00Z') + 86400_000).toISOString().slice(0, 10) : ''
        run = d === next ? run + 1 : 1
        best = Math.max(best, run)
        prev = d
    }
    return best
}

/**
 * Score every participant for one metric inside [startsAt, endsAt).
 * Logs outside the window or from non-participants are ignored, so callers can
 * pass a superset. Day-based metrics use Singapore calendar dates.
 */
export function scoreParticipants(metric: ChallengeMetric, startsAt: string, endsAt: string, people: Participant[], logs: ChallengeLogs): Map<string, number> {
    const from = Date.parse(startsAt), to = Date.parse(endsAt)
    const inTs = (iso: string) => { const t = Date.parse(iso); return t >= from && t < to }
    const fromDay = sgDate(startsAt), toDay = sgDate(new Date(to - 1).toISOString())
    const inDay = (d: string) => d >= fromDay && d <= toDay

    const score = new Map<string, number>(people.map(p => [p.id, 0]))
    const add = (id: string, n: number) => { if (score.has(id)) score.set(id, score.get(id)! + n) }

    switch (metric) {
        case 'distance_km':
            for (const w of logs.workouts) if (inTs(w.logged_at)) add(w.user_id, Number(w.distance_km ?? 0))
            for (const [k, v] of score) score.set(k, round1(v))
            break
        case 'workout_minutes':
            for (const w of logs.workouts) if (inTs(w.logged_at)) add(w.user_id, w.duration_min ?? 0)
            break
        case 'workouts':
            for (const w of logs.workouts) if (inTs(w.logged_at)) add(w.user_id, 1)
            break
        case 'meals_logged':
            for (const m of logs.meals) if (inTs(m.logged_at)) add(m.user_id, 1)
            break
        case 'calorie_days':
            for (const s of logs.summaries)
                if (inDay(s.date) && s.calorie_target && s.calorie_target > 0 &&
                    Math.abs(s.total_calories - s.calorie_target) / s.calorie_target <= 0.1) add(s.user_id, 1)
            break
        case 'protein_days': {
            const req = new Map(people.map(p => [p.id, p.weight_kg ? calculateProteinRequirement(Number(p.weight_kg), (p.goal_mode ?? 'maintain') as GoalMode) : null]))
            for (const s of logs.summaries) {
                const r = req.get(s.user_id)
                if (r && inDay(s.date) && Number(s.total_protein_g) >= r * 0.9) add(s.user_id, 1)
            }
            break
        }
        case 'active_days':
        case 'best_streak': {
            const days = new Map<string, Set<string>>(people.map(p => [p.id, new Set()]))
            const mark = (id: string, d: string) => { if (inDay(d)) days.get(id)?.add(d) }
            for (const m of logs.meals) mark(m.user_id, sgDate(m.logged_at))
            for (const w of logs.workouts) mark(w.user_id, sgDate(w.logged_at))
            for (const s of logs.sleeps) mark(s.user_id, s.night_date)
            for (const [id, set] of days) score.set(id, metric === 'active_days' ? set.size : longestStreak(set))
            break
        }
    }
    return score
}

// ── Standings ────────────────────────────────────────────────────────────────
export type IndividualRow = {
    id: string; name: string; rank: string; wing: string | null; platoon: string | null; section: string | null
    score: number; place: number
}
export type TeamRow = {
    key: string; label: string; members: number; contributors: number
    score: number; place: number; memberIds: string[]
}
export type Standings =
    | { format: 'individual'; rows: IndividualRow[] }
    | { format: 'team'; rows: TeamRow[] }

/** Competition ranking: ties share a place (1, 2, 2, 4). */
function placed<T extends { score: number }>(rows: T[]): (T & { place: number })[] {
    const sorted = [...rows].sort((a, b) => b.score - a.score)
    let place = 0
    return sorted.map((r, i) => {
        if (i === 0 || r.score !== sorted[i - 1].score) place = i + 1
        return { ...r, place }
    })
}

export function teamKey(level: TeamLevel, p: Pick<Participant, 'wing' | 'platoon' | 'section'>): { key: string; label: string } | null {
    if (!p.wing) return null
    if (level === 'wing') return { key: p.wing, label: `${p.wing} Wing` }
    if (!p.platoon) return null
    if (level === 'platoon') return { key: `${p.wing}|${p.platoon}`, label: `${p.wing} · Platoon ${p.platoon}` }
    if (!p.section) return null
    return { key: `${p.wing}|${p.platoon}|${p.section}`, label: `${p.wing} · P${p.platoon} · Section ${p.section}` }
}

export function buildStandings(c: Pick<Challenge, 'format' | 'team_level'>, people: Participant[], scores: Map<string, number>): Standings {
    if (c.format === 'individual') {
        return {
            format: 'individual',
            rows: placed(people.map(p => ({
                id: p.id, name: p.full_name ?? 'Unknown', rank: p.rank ?? '',
                wing: p.wing, platoon: p.platoon, section: p.section, score: scores.get(p.id) ?? 0,
            }))),
        }
    }
    const teams = new Map<string, { label: string; ids: string[] }>()
    for (const p of people) {
        const t = teamKey(c.team_level!, p)
        if (!t) continue // cadets without a platoon/section can't be placed in a team
        if (!teams.has(t.key)) teams.set(t.key, { label: t.label, ids: [] })
        teams.get(t.key)!.ids.push(p.id)
    }
    return {
        format: 'team',
        rows: placed([...teams.entries()].map(([key, t]) => {
            const vals = t.ids.map(id => scores.get(id) ?? 0)
            return {
                key, label: t.label, members: t.ids.length, memberIds: t.ids,
                contributors: vals.filter(v => v > 0).length,
                score: round1(vals.reduce((a, b) => a + b, 0) / t.ids.length),
            }
        })),
    }
}

// ── Awards ───────────────────────────────────────────────────────────────────
export type Award = { user_id: string; points: number; place: number }

/**
 * Bonus payout when a challenge ends. Places 1–3 earn 100% / 60% / 30% of
 * bonus_points (ties share the place). Only cadets with a score above zero are
 * paid — in team challenges that means contributing members of a top-3 team.
 */
export function computeAwards(bonusPoints: number, standings: Standings, scores: Map<string, number>): Award[] {
    if (bonusPoints <= 0) return []
    const pts = (place: number) => Math.round(bonusPoints * (AWARD_SHARES[place - 1] ?? 0))
    const out: Award[] = []
    if (standings.format === 'individual') {
        for (const r of standings.rows) if (r.place <= 3 && r.score > 0 && pts(r.place) > 0) out.push({ user_id: r.id, points: pts(r.place), place: r.place })
    } else {
        for (const t of standings.rows) {
            if (t.place > 3 || t.score <= 0 || pts(t.place) <= 0) continue
            for (const id of t.memberIds) if ((scores.get(id) ?? 0) > 0) out.push({ user_id: id, points: pts(t.place), place: t.place })
        }
    }
    return out
}

// ── Final snapshot stored on the challenge when it finishes ──────────────────
export type ChallengeResults = {
    participants: number
    podium: { place: number; label: string; score: number }[]
    awarded: number // number of cadets paid
}

export function summariseResults(standings: Standings, participants: number, awards: Award[]): ChallengeResults {
    const podium = standings.format === 'individual'
        ? standings.rows.filter(r => r.place <= 3 && r.score > 0).map(r => ({ place: r.place, label: `${r.rank} ${r.name}`.trim(), score: r.score }))
        : standings.rows.filter(r => r.place <= 3 && r.score > 0).map(r => ({ place: r.place, label: r.label, score: r.score }))
    return { participants, podium, awarded: awards.length }
}
