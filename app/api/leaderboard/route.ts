import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeScore, computeStreak } from '@/lib/scoring'

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

// GET /api/leaderboard?scope=wing|friends&wing=Alpha&period=week|month&userId=<uuid>
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const scope = searchParams.get('scope') ?? 'wing'
    const wing = searchParams.get('wing')
    const period = searchParams.get('period') ?? 'week'
    const userId = searchParams.get('userId')

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Resolve user list
    let users: { id: string; full_name: string; rank: string; wing: string }[] = []

    if (scope === 'wing' && wing) {
        const { data, error } = await supabaseAdmin
            .from('users')
            .select('id, full_name, rank, wing')
            .eq('wing', wing)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        users = data ?? []
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
            .select('id, full_name, rank, wing')
            .in('id', ids)
        users = data ?? []
    }

    if (users.length === 0) return NextResponse.json([])

    const userIds = users.map(u => u.id)
    const start = windowStart(period)

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

    // Aggregate meals by user+day
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

    const ranked = users
        .map(u => {
            const streak = computeStreak(allDaysByUser[u.id])
            const score = computeScore(mealsByUserDay[u.id], streak)
            const mealsToday = mealsByUserDay[u.id][new Date().toISOString().slice(0, 10)] ?? 0
            return { ...u, score, streak, mealsToday }
        })
        .sort((a, b) => b.score - a.score)
        .map((u, i) => ({ ...u, position: i + 1 }))

    return NextResponse.json(ranked)
}
