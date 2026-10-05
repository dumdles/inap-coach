import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeScore } from '@/lib/scoring'
import { requireRole } from '@/app/api/_lib/roles'
import { isSuperadmin } from '@/lib/roles'
import { challengeBonusSince } from '@/app/api/_lib/challenges'
import { loadUserActivity } from '@/app/api/_lib/leaderboard-inputs'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

function windowStart(period: string): Date {
    const now = new Date()
    if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
    const d = new Date(now)
    d.setDate(d.getDate() - 6)
    d.setHours(0, 0, 0, 0)
    return d
}

/** Only the days on/after `startDay` ('YYYY-MM-DD' keys compare as strings). */
function inPeriod<T>(byDay: Record<string, T>, startDay: string): Record<string, T> {
    const out: Record<string, T> = {}
    for (const [day, v] of Object.entries(byDay)) if (day >= startDay) out[day] = v
    return out
}

/** The last n UTC dates, oldest first, ending today (same day keys as leaderboard_inputs). */
function lastNDays(n: number): string[] {
    const now = Date.now()
    return Array.from({ length: n }, (_, i) => new Date(now - (n - 1 - i) * 86400_000).toISOString().slice(0, 10))
}

// GET /api/leaderboard?scope=wing|section|friends&wing=Alpha&period=week|month
// The caller comes from the Bearer token. Wing boards are limited to the
// caller's own wing (superadmins may pass any ?wing=).
export async function GET(req: NextRequest) {
    const auth = await requireRole(req)
    if (auth.error) return auth.error
    const userId = auth.requester.id

    const { searchParams } = req.nextUrl
    const scope = searchParams.get('scope') ?? 'wing'
    const period = searchParams.get('period') ?? 'week'
    const requestedWing = searchParams.get('wing')
    const wing = isSuperadmin(auth.requester.role) ? (requestedWing ?? auth.requester.wing) : auth.requester.wing
    if (requestedWing && requestedWing !== wing)
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    // Resolve user list
    const USER_FIELDS = 'id, full_name, rank, wing, platoon, section, goal_mode'
    let users: { id: string; full_name: string; rank: string; wing: string; platoon: string | null; section: string | null; goal_mode: string | null }[] = []

    if (scope === 'wing' && wing) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select(USER_FIELDS)
            .eq('wing', wing)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        users = data ?? []
    } else if (scope === 'section') {
        // Section numbers repeat in every platoon and wing ("Section 2" exists
        // everywhere), so a section is only unique within wing + platoon.
        // requireRole already loaded the caller's wing/platoon/section.
        const me = auth.requester
        if (me.section && me.wing) {
            let q = supabaseAdmin
                .from('users')
                .select(USER_FIELDS)
                .eq('wing', me.wing)
                .eq('section', me.section)
            if (me.platoon) q = q.eq('platoon', me.platoon)
            const { data } = await q
            users = data ?? []
        }
    } else if (scope === 'friends') {
        const { data: rows } = await supabaseAdmin
            .from('friendships')
            .select('requester_id, addressee_id')
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            .eq('status', 'accepted')

        const ids = [userId, ...(rows ?? []).map(r =>
            r.requester_id === userId ? r.addressee_id : r.requester_id,
        )]
        const { data } = await supabaseAdmin
            .from('users')
            .select(USER_FIELDS)
            .in('id', ids)
        users = data ?? []
    }

    if (users.length === 0) return NextResponse.json([])

    const userIds = users.map(u => u.id)
    const start = windowStart(period)
    // Always load at least the last 7 days, so every row can carry its 7-day
    // log history (`last7`, used by My Wing) even early in a "month" period.
    // Scoring below only counts days inside the period itself.
    const sevenDaysAgo = windowStart('week')
    const loadFrom = start < sevenDaysAgo ? start : sevenDaysAgo
    const startDay = start.toISOString().slice(0, 10)

    // Both are independent → fetch in parallel. Activity is pre-aggregated in
    // Postgres (see app/api/_lib/leaderboard-inputs.ts); challenge bonus points
    // are those won during this period (see lib/challenges.ts).
    let activity: Awaited<ReturnType<typeof loadUserActivity>>
    let bonusByUser: Map<string, number>
    try {
        [activity, bonusByUser] = await Promise.all([
            loadUserActivity(userIds, loadFrom),
            challengeBonusSince(start.toISOString()),
        ])
    } catch (e) {
        console.error('[leaderboard]', e)
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load leaderboard' }, { status: 500 })
    }

    const today = new Date().toISOString().slice(0, 10)
    const last7Days = lastNDays(7)
    const ranked = users
        .map(u => {
            const a = activity.get(u.id)!
            const streak = a.streak
            const challengeBonus = bonusByUser.get(u.id) ?? 0
            const score = computeScore(
                inPeriod(a.mealsByDay, startDay), streak,
                inPeriod(a.workoutKcalByDay, startDay), inPeriod(a.sleepByDay, startDay),
            ) + challengeBonus
            const mealsToday = a.mealsByDay[today] ?? 0
            // Meals logged on each of the last 7 days (oldest → today), for My Wing's
            // "last 7 days" strips and "silent for N days" flags (lib/wing-overview.ts).
            const last7 = last7Days.map(d => a.mealsByDay[d] ?? 0)
            return { ...u, score, streak, mealsToday, last7, challengeBonus }
        })
        .sort((a, b) => b.score - a.score)
        .map((u, i) => ({ ...u, position: i + 1 }))

    return NextResponse.json(ranked)
}
