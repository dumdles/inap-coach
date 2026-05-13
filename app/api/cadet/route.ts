import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeScore, computeStreak } from '@/lib/scoring'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/cadet?cadetId=<uuid>&requesterId=<uuid>
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

    const yearAgo = new Date()
    yearAgo.setFullYear(yearAgo.getFullYear() - 1)

    // Fetch last 30 days of daily_summaries + full year of days-with-meals for streak
    const [{ data: summaries }, { data: allLogDays }] = await Promise.all([
        supabaseAdmin
            .from('daily_summaries')
            .select('date, total_calories, total_protein_g, total_carbs_g, total_fat_g, calorie_target')
            .eq('user_id', cadetId)
            .gte('date', new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10))
            .order('date', { ascending: false }),
        supabaseAdmin
            .from('daily_summaries')
            .select('date')
            .eq('user_id', cadetId)
            .gte('date', yearAgo.toISOString().slice(0, 10)),
    ])

    // Compute score (last 7 days) and streak from daily_summaries
    const weekAgoDate = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
    const daysWithMeals = new Set<string>((allLogDays ?? []).map(r => r.date))
    const mealsByDay: Record<string, number> = {}
    for (const day of daysWithMeals) {
        if (day >= weekAgoDate) mealsByDay[day] = 1  // presence = logged that day
    }
    const streak = computeStreak(daysWithMeals)
    const score = computeScore(mealsByDay, streak)

    // Shape daily summaries into the map the cadet page expects
    const dailySummary: Record<string, {
        calories: number; protein: number; carbs: number; fat: number; calorie_target: number
    }> = {}
    for (const row of summaries ?? []) {
        dailySummary[row.date] = {
            calories: row.total_calories,
            protein:  row.total_protein_g,
            carbs:    row.total_carbs_g,
            fat:      row.total_fat_g,
            calorie_target: row.calorie_target ?? 2400,
        }
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
        dailySummary,
    })
}
