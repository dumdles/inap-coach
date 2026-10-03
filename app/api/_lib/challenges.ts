import { supabaseAdmin } from '@/app/api/cron/_lib'
import type { Requester } from '@/app/api/_lib/roles'
import { isSuperadmin } from '@/lib/roles'
import { fetchPaged } from '@/app/api/_lib/paged'
import {
    buildStandings, challengeStatus, computeAwards, inScope, scoreParticipants, summariseResults,
    type Challenge, type ChallengeLogs, type Participant, type Standings,
} from '@/lib/challenges'

// Server-side glue for challenges: who's in a challenge, fetching the logs in
// its window, and paying out bonus points exactly once when it ends.
// All scoring rules live in lib/challenges.ts.

/** Can this user see the challenge? Superadmins: all. Others: if they're in its scope or created it. */
export function canSeeChallenge(r: Requester, c: Challenge) {
    if (isSuperadmin(r.role) || c.created_by === r.id) return true
    // Instructors see every challenge for their wing, even platoon-limited ones.
    if (r.role === 'instructor') return !c.scope_wing || c.scope_wing === r.wing
    return inScope(c, { wing: r.wing, platoon: r.platoon })
}

/** Creator or superadmin may cancel (delete) a challenge that hasn't been paid out. */
export function canManageChallenge(r: Requester, c: Challenge) {
    return isSuperadmin(r.role) || c.created_by === r.id
}

/** Every cadet auto-enrolled in the challenge. */
export async function loadParticipants(c: Pick<Challenge, 'scope_wing' | 'scope_platoon'>): Promise<Participant[]> {
    return fetchPaged<Participant>((from, to) => {
        let q = supabaseAdmin.from('users')
            .select('id, full_name, rank, wing, platoon, section, goal_mode, weight_kg')
            .eq('role', 'cadet')
        if (c.scope_wing) q = q.eq('wing', c.scope_wing)
        if (c.scope_platoon) q = q.eq('platoon', c.scope_platoon)
        return q.order('id').range(from, to)
    })
}

/** All logs inside the challenge window (filtered to participants later, in memory). */
async function loadLogs(c: Pick<Challenge, 'starts_at' | 'ends_at'>): Promise<ChallengeLogs> {
    // Day-based tables use SGT dates; pad a day each side and let the scorer trim.
    const dayFrom = new Date(Date.parse(c.starts_at) - 86400_000).toISOString().slice(0, 10)
    const dayTo = new Date(Date.parse(c.ends_at) + 86400_000).toISOString().slice(0, 10)
    const [workouts, meals, summaries, sleeps] = await Promise.all([
        fetchPaged<ChallengeLogs['workouts'][number]>((f, t) => supabaseAdmin.from('workout_logs')
            .select('user_id, logged_at, duration_min, distance_km')
            .gte('logged_at', c.starts_at).lt('logged_at', c.ends_at).order('id').range(f, t)),
        fetchPaged<ChallengeLogs['meals'][number]>((f, t) => supabaseAdmin.from('meal_logs')
            .select('user_id, logged_at')
            .gte('logged_at', c.starts_at).lt('logged_at', c.ends_at).order('id').range(f, t)),
        fetchPaged<ChallengeLogs['summaries'][number]>((f, t) => supabaseAdmin.from('daily_summaries')
            .select('user_id, date, total_calories, total_protein_g, calorie_target')
            .gte('date', dayFrom).lte('date', dayTo).order('user_id').order('date').range(f, t)),
        fetchPaged<ChallengeLogs['sleeps'][number]>((f, t) => supabaseAdmin.from('sleep_logs')
            .select('user_id, night_date')
            .gte('night_date', dayFrom).lte('night_date', dayTo).order('id').range(f, t)),
    ])
    return { workouts, meals, summaries, sleeps }
}

export type ComputedChallenge = { participants: Participant[]; scores: Map<string, number>; standings: Standings }

/** Live standings, computed from logs. While upcoming, everyone is on 0. */
export async function computeChallenge(c: Challenge): Promise<ComputedChallenge> {
    const empty: ChallengeLogs = { workouts: [], meals: [], summaries: [], sleeps: [] }
    // Only score up to "now" for a live challenge, so the window never includes the future.
    const endsAt = new Date(Math.min(Date.now(), Date.parse(c.ends_at))).toISOString()
    // Participants and logs don't depend on each other — fetch both at once.
    const [participants, logs] = await Promise.all([
        loadParticipants(c),
        challengeStatus(c) === 'upcoming' ? empty : loadLogs({ starts_at: c.starts_at, ends_at: endsAt }),
    ])
    const scores = scoreParticipants(c.metric, c.starts_at, endsAt, participants, logs)
    return { participants, scores, standings: buildStandings(c, participants, scores) }
}

/**
 * Pay out a finished challenge exactly once. Safe to call from many places at
 * the same time (detail page, list, cron): the `finalized_at is null` guard on
 * the UPDATE means only one caller wins the claim and inserts awards; the
 * unique (challenge_id, user_id) index is a second line of defence.
 * Returns the (possibly updated) challenge.
 */
export async function finalizeIfDue(c: Challenge, computed?: ComputedChallenge): Promise<Challenge> {
    if (c.finalized_at || challengeStatus(c) !== 'ended') return c

    const { participants, scores, standings } = computed ?? await computeChallenge(c)
    const awards = computeAwards(c.bonus_points, standings, scores)
    const results = summariseResults(standings, participants.length, awards)

    const { data: claimed, error } = await supabaseAdmin
        .from('challenges')
        .update({ finalized_at: new Date().toISOString(), results })
        .eq('id', c.id)
        .is('finalized_at', null)
        .select('*')
        .maybeSingle()
    if (error) throw new Error(error.message)
    if (!claimed) {
        // Someone else finalized it first — return their version.
        const { data } = await supabaseAdmin.from('challenges').select('*').eq('id', c.id).single()
        return (data as Challenge) ?? c
    }

    if (awards.length) {
        const { error: awardErr } = await supabaseAdmin
            .from('challenge_awards')
            .upsert(awards.map(a => ({ ...a, challenge_id: c.id })), { onConflict: 'challenge_id,user_id', ignoreDuplicates: true })
        if (awardErr) console.error('[challenges] award insert failed', c.id, awardErr.message)
    }

    // Tell everyone how it went (one batched insert).
    const paid = new Map(awards.map(a => [a.user_id, a]))
    const notifs = participants.map(p => {
        const a = paid.get(p.id)
        return {
            user_id: p.id, type: 'challenge', read: false,
            title: a ? `🏆 ${ordinal(a.place)} place in "${c.title}"` : `Challenge finished: ${c.title}`,
            body: a ? `+${a.points} bonus points added to your leaderboard score.` : (results.podium[0] ? `Winner: ${results.podium[0].label}` : null),
        }
    })
    for (let i = 0; i < notifs.length; i += 500) {
        await supabaseAdmin.from('notifications').insert(notifs.slice(i, i + 500))
    }
    return claimed as Challenge
}

/** Finalize every challenge that has ended but not been paid out (cron + list view). */
export async function finalizeAllDue(): Promise<number> {
    const { data } = await supabaseAdmin
        .from('challenges').select('*')
        .is('finalized_at', null).lte('ends_at', new Date().toISOString())
        .limit(20)
    let n = 0
    for (const c of (data ?? []) as Challenge[]) {
        try { await finalizeIfDue(c); n++ } catch (e) { console.error('[challenges] finalize failed', c.id, e) }
    }
    return n
}

function ordinal(n: number) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th` }

/**
 * Challenge bonus points per user awarded since `sinceIso` — added on top of the
 * regular leaderboard score (see SCORING_SYSTEM.md → Challenge bonus).
 * Awards are few, so fetch by date and filter in memory.
 */
export async function challengeBonusSince(sinceIso: string): Promise<Map<string, number>> {
    const { data, error } = await supabaseAdmin
        .from('challenge_awards')
        .select('user_id, points')
        .gte('awarded_at', sinceIso)
    const out = new Map<string, number>()
    if (error) { console.error('[challenges] bonus lookup failed', error.message); return out } // e.g. table not migrated yet
    for (const a of data ?? []) out.set(a.user_id, (out.get(a.user_id) ?? 0) + a.points)
    return out
}
