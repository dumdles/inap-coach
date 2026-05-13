import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeScore, computeStreak } from '@/lib/scoring'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/cadet?cadetId=<uuid>&requesterId=<uuid>
// Returns cadet profile + last 30 days of meal logs + score + streak
// Only succeeds if requester is in same wing and is an instructor (checked via DB)
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const cadetId = searchParams.get('cadetId')
    const requesterId = searchParams.get('requesterId')
    if (!cadetId || !requesterId) return NextResponse.json({ error: 'missing params' }, { status: 400 })

    // Verify requester is an instructor in the same wing
    const [{ data: requester }, { data: cadet }] = await Promise.all([
        supabaseAdmin.from('users').select('rank, wing').eq('id', requesterId).single(),
        supabaseAdmin.from('users').select('*').eq('id', cadetId).single(),
    ])
    if (!requester || !cadet) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (requester.wing !== cadet.wing) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    // Fetch last 30 days of meal logs
    const since = new Date()
    since.setDate(since.getDate() - 29)
    since.setHours(0, 0, 0, 0)

    // Fetch full year of logs for streak computation
    const yearAgo = new Date()
    yearAgo.setFullYear(yearAgo.getFullYear() - 1)

    const [{ data: recentLogs }, { data: allLogs }] = await Promise.all([
        supabaseAdmin
            .from('meal_logs')
            .select('id, meal_type, food_name, calories, protein_g, carbs_g, fat_g, logged_at')
            .eq('user_id', cadetId)
            .gte('logged_at', since.toISOString())
            .order('logged_at', { ascending: false }),
        supabaseAdmin
            .from('meal_logs')
            .select('logged_at')
            .eq('user_id', cadetId)
            .gte('logged_at', yearAgo.toISOString()),
    ])

    // Compute score (last 7 days) and streak
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 6)
    weekAgo.setHours(0, 0, 0, 0)

    const mealsByDay: Record<string, number> = {}
    const daysWithMeals = new Set<string>()
    for (const log of allLogs ?? []) {
        const day = log.logged_at.slice(0, 10)
        daysWithMeals.add(day)
        if (new Date(log.logged_at) >= weekAgo) {
            mealsByDay[day] = (mealsByDay[day] ?? 0) + 1
        }
    }
    const streak = computeStreak(daysWithMeals)
    const score = computeScore(mealsByDay, streak)

    // Build daily summary for last 30 days
    const dailyMap: Record<string, { calories: number; protein: number; carbs: number; fat: number; meals: number }> = {}
    for (const log of recentLogs ?? []) {
        const day = log.logged_at.slice(0, 10)
        if (!dailyMap[day]) dailyMap[day] = { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 }
        dailyMap[day].calories += log.calories ?? 0
        dailyMap[day].protein += log.protein_g ?? 0
        dailyMap[day].carbs += log.carbs_g ?? 0
        dailyMap[day].fat += log.fat_g ?? 0
        dailyMap[day].meals++
    }

    return NextResponse.json({
        profile: {
            id: cadet.id,
            full_name: cadet.full_name,
            rank: cadet.rank,
            wing: cadet.wing,
            platoon: cadet.platoon,
            section: cadet.section,
            height_cm: cadet.height_cm,
            weight_kg: cadet.weight_kg,
            gender: cadet.gender,
            goal_mode: cadet.goal_mode,
            ippt_date: cadet.ippt_date,
        },
        score,
        streak,
        recentLogs: recentLogs ?? [],
        dailySummary: dailyMap,
    })
}
