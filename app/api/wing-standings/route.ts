import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeScore } from '@/lib/scoring'
import { verifyAuth } from '@/app/api/_lib/auth'
import { challengeBonusSince } from '@/app/api/_lib/challenges'
import { loadUserActivity } from '@/app/api/_lib/leaderboard-inputs'
import { fetchPaged } from '@/app/api/_lib/paged'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/wing-standings?period=week|month
// Returns wings sorted by average score (aggregates only). Signed-in users only.
export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const period = req.nextUrl.searchParams.get('period') ?? 'week'

    const now = new Date()
    const start = period === 'month'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getTime() - 6 * 86400_000)

    // Every user with a wing. Paged: PostgREST caps a single response at 1000 rows.
    let users: { id: string; wing: string }[]
    try {
        users = await fetchPaged<{ id: string; wing: string }>((from, to) => supabaseAdmin
            .from('users').select('id, wing').not('wing', 'is', null).order('id').range(from, to))
    } catch (e) {
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load users' }, { status: 500 })
    }
    if (!users.length) return NextResponse.json([])

    // Meals + streaks only (wing standings don't score workouts/sleep), pre-aggregated
    // in Postgres — see app/api/_lib/leaderboard-inputs.ts. Challenge bonus points
    // awarded this period also count. Both fetched in parallel.
    let activity: Awaited<ReturnType<typeof loadUserActivity>>
    let bonusByUser: Map<string, number>
    try {
        [activity, bonusByUser] = await Promise.all([
            loadUserActivity(users.map(u => u.id), start, false),
            challengeBonusSince(start.toISOString()),
        ])
    } catch (e) {
        console.error('[wing-standings]', e)
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load standings' }, { status: 500 })
    }

    // Aggregate by wing
    const wingMap: Record<string, { total: number; count: number }> = {}
    for (const u of users) {
        const wing = u.wing
        if (!wing) continue
        const a = activity.get(u.id)!
        const score = computeScore(a.mealsByDay, a.streak) + (bonusByUser.get(u.id) ?? 0)
        wingMap[wing] = wingMap[wing] ?? { total: 0, count: 0 }
        wingMap[wing].total += score
        wingMap[wing].count += 1
    }

    const standings = Object.entries(wingMap)
        .map(([wing, { total, count }]) => ({
            wing,
            avgScore: Math.round(total / count),
            memberCount: count,
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .map((w, i) => ({ ...w, position: i + 1 }))

    return NextResponse.json(standings)
}
