import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeScore, computeStreak } from '@/lib/scoring'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/wing-standings?period=week|month
// Returns wings sorted by average score
export async function GET(req: NextRequest) {
    const period = req.nextUrl.searchParams.get('period') ?? 'week'

    const now = new Date()
    const start = period === 'month'
        ? new Date(now.getFullYear(), now.getMonth(), 1)
        : new Date(now.getTime() - 6 * 86400_000)

    const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, wing')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (!users?.length) return NextResponse.json([])

    const userIds = users.map(u => u.id)

    const [{ data: periodLogs }, { data: allLogs }] = await Promise.all([
        supabaseAdmin
            .from('meal_logs')
            .select('user_id, logged_at')
            .in('user_id', userIds)
            .gte('logged_at', start.toISOString()),
        supabaseAdmin
            .from('meal_logs')
            .select('user_id, logged_at')
            .in('user_id', userIds)
            .gte('logged_at', new Date(Date.now() - 365 * 86400_000).toISOString()),
    ])

    const mealsByUserDay: Record<string, Record<string, number>> = {}
    const allDaysByUser: Record<string, Set<string>> = {}
    for (const u of users) {
        mealsByUserDay[u.id] = {}
        allDaysByUser[u.id] = new Set()
    }
    for (const log of periodLogs ?? []) {
        const day = log.logged_at.slice(0, 10)
        mealsByUserDay[log.user_id][day] = (mealsByUserDay[log.user_id][day] ?? 0) + 1
    }
    for (const log of allLogs ?? []) {
        allDaysByUser[log.user_id]?.add(log.logged_at.slice(0, 10))
    }

    // Aggregate by wing
    const wingMap: Record<string, { total: number; count: number }> = {}
    for (const u of users) {
        const wing = u.wing
        if (!wing) continue
        const streak = computeStreak(allDaysByUser[u.id])
        const score = computeScore(mealsByUserDay[u.id], streak)
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
