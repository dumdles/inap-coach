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
        const { data: me } = await supabaseAdmin.from('users').select('section').eq('id', userId).single()
        if (me?.section) {
            const { data } = await supabaseAdmin
                .from('users')
                .select(USER_FIELDS)
                .eq('section', me.section)
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

    const startDate = start.toISOString().slice(0, 10)
    const [{ data: periodLogs }, { data: allLogs }, { data: workoutLogs }, { data: sleepLogs }] = await Promise.all([
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
        supabaseAdmin
            .from('workout_logs')
            .select('user_id, calories, logged_at')
            .in('user_id', userIds)
            .gte('logged_at', start.toISOString()),
        supabaseAdmin
            .from('sleep_logs')
            .select('user_id, night_date, duration_min, sleep_score, ans_charge_status')
            .in('user_id', userIds)
            .gte('night_date', startDate),
    ])

    // Aggregate meals, workout kcal, and sleep by user+day
    const mealsByUserDay: Record<string, Record<string, number>> = {}
    const allDaysByUser: Record<string, Set<string>> = {}
    const workoutKcalByUserDay: Record<string, Record<string, number>> = {}
    const sleepByUserDay: Record<string, Record<string, { durationMin: number; sleepScore: number | null; ansStatus: number | null }>> = {}
    for (const u of users) {
        mealsByUserDay[u.id] = {}
        allDaysByUser[u.id] = new Set()
        workoutKcalByUserDay[u.id] = {}
        sleepByUserDay[u.id] = {}
    }
    for (const log of periodLogs ?? []) {
        const day = log.logged_at.slice(0, 10)
        mealsByUserDay[log.user_id][day] = (mealsByUserDay[log.user_id][day] ?? 0) + 1
    }
    for (const log of allLogs ?? []) {
        allDaysByUser[log.user_id]?.add(log.logged_at.slice(0, 10))
    }
    for (const log of workoutLogs ?? []) {
        if (!log.calories) continue
        const day = log.logged_at.slice(0, 10)
        workoutKcalByUserDay[log.user_id][day] = (workoutKcalByUserDay[log.user_id][day] ?? 0) + log.calories
    }
    for (const log of sleepLogs ?? []) {
        if (!log.duration_min || !sleepByUserDay[log.user_id]) continue
        sleepByUserDay[log.user_id][log.night_date] = {
            durationMin: log.duration_min,
            sleepScore: log.sleep_score ?? null,
            ansStatus: log.ans_charge_status ?? null,
        }
    }

    const ranked = users
        .map(u => {
            const streak = computeStreak(allDaysByUser[u.id])
            const score = computeScore(mealsByUserDay[u.id], streak, workoutKcalByUserDay[u.id], sleepByUserDay[u.id])
            const mealsToday = mealsByUserDay[u.id][new Date().toISOString().slice(0, 10)] ?? 0
            return { ...u, score, streak, mealsToday }
        })
        .sort((a, b) => b.score - a.score)
        .map((u, i) => ({ ...u, position: i + 1 }))

    return NextResponse.json(ranked)
}
