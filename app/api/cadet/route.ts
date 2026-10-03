import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeScore, computeStreak } from '@/lib/scoring'
import { hasInstructorAccess, isSuperadmin } from '@/lib/roles'
import { requireRole } from '@/app/api/_lib/roles'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/cadet?cadetId=<uuid>   (Authorization: Bearer <token>)
// The requester is taken from the verified session, never from the query.
export async function GET(req: NextRequest) {
    const auth = await requireRole(req)
    if (auth.error) return auth.error
    const requester = auth.requester
    const requesterId = requester.id

    const cadetId = req.nextUrl.searchParams.get('cadetId')
    if (!cadetId) return NextResponse.json({ error: 'missing params' }, { status: 400 })

    const { data: cadet } = await supabaseAdmin.from('users').select('*').eq('id', cadetId).single()
    if (!cadet) return NextResponse.json({ error: 'not found' }, { status: 404 })

    // Full access: verified instructor in the same wing, or a superadmin (any wing).
    const isInstructorInSameWing =
        isSuperadmin(requester.role) ||
        (hasInstructorAccess(requester.role) && requester.wing === cadet.wing)
    if (!isInstructorInSameWing) {
        const { data: friendship } = await supabaseAdmin
            .from('friendships')
            .select('id')
            .or(
                `and(requester_id.eq.${requesterId},addressee_id.eq.${cadetId}),` +
                `and(requester_id.eq.${cadetId},addressee_id.eq.${requesterId})`
            )
            .eq('status', 'accepted')
            .maybeSingle()
        if (!friendship) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

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

    const profile = isInstructorInSameWing
        ? {
            id: cadet.id, full_name: cadet.full_name, rank: cadet.rank, wing: cadet.wing,
            platoon: cadet.platoon, section: cadet.section,
            height_cm: cadet.height_cm, weight_kg: cadet.weight_kg,
            gender: cadet.gender, goal_mode: cadet.goal_mode, ippt_date: cadet.ippt_date,
        }
        : {
            // Friend view — omit biometric/sensitive fields
            id: cadet.id, full_name: cadet.full_name, rank: cadet.rank, wing: cadet.wing,
            platoon: cadet.platoon, section: cadet.section,
            goal_mode: cadet.goal_mode, ippt_date: cadet.ippt_date,
        }

    return NextResponse.json({
        profile,
        score,
        streak,
        dailySummary,
        accessLevel: isInstructorInSameWing ? 'instructor' : 'friend',
    })
}
