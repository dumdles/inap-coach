// GET  /api/achievements?userId=<uuid>[&position=<n>]
//   Computes all earned achievements for a user, persists newly unlocked ones,
//   and returns the full achievement list with unlocked status.
//
// POST /api/achievements
//   Body: { userId: string, achievementIds: string[] }
//   Directly unlocks specific achievements (used for leaderboard-position badges).

import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { computeAchievements, ACHIEVEMENTS, ACHIEVEMENT_MAP, RARITY_ORDER, type AchievementInput } from '@/lib/achievements'
import { computeStreak } from '@/lib/scoring'
import { insertNotif } from '@/app/api/cron/_lib'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// ── Helpers ────────────────────────────────────────────────────────────────

// Longest consecutive run of nights where sleep was 6–9 h.
function maxOptimalSleepStreak(nights: { night_date: string; duration_min: number }[]): number {
    const optimal = nights
        .filter(n => { const h = n.duration_min / 60; return h >= 6 && h <= 9 })
        .sort((a, b) => a.night_date.localeCompare(b.night_date))

    if (optimal.length === 0) return 0
    let max = 1, cur = 1
    for (let i = 1; i < optimal.length; i++) {
        const prev = new Date(optimal[i - 1].night_date)
        prev.setDate(prev.getDate() + 1)
        if (prev.toISOString().slice(0, 10) === optimal[i].night_date) {
            cur++
            if (cur > max) max = cur
        } else {
            cur = 1
        }
    }
    return max
}

// True if any 7-consecutive-night window had all nights ≥ 7 h (no sleep debt).
function hasSleepDebtFree7Days(nights: { night_date: string; duration_min: number }[]): boolean {
    const byDate: Record<string, number> = {}
    for (const n of nights) byDate[n.night_date] = n.duration_min

    for (const start of Object.keys(byDate).sort()) {
        let allGood = true
        for (let i = 0; i < 7; i++) {
            const d = new Date(start)
            d.setDate(d.getDate() + i)
            if ((byDate[d.toISOString().slice(0, 10)] ?? 0) < 7 * 60) { allGood = false; break }
        }
        if (allGood) return true
    }
    return false
}

// True if any N-consecutive-day window had all 3 habits logged every day.
function hasPerfectWindow(allHabitDays: Set<string>, windowDays: number): boolean {
    for (const start of allHabitDays) {
        let full = true
        for (let i = 0; i < windowDays; i++) {
            const d = new Date(start)
            d.setDate(d.getDate() + i)
            if (!allHabitDays.has(d.toISOString().slice(0, 10))) { full = false; break }
        }
        if (full) return true
    }
    return false
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const userId   = searchParams.get('userId')
    const position = searchParams.get('position') ? parseInt(searchParams.get('position')!) : undefined

    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    // Fetch all required data in parallel
    const [
        { data: mealLogs },
        { data: workoutLogs },
        { data: sleepLogs },
        { data: weightLogs },
        { data: userRow },
        { data: friendships },
        { data: polarWorkout },
        { data: polarSleep },
    ] = await Promise.all([
        supabaseAdmin
            .from('meal_logs')
            .select('logged_at, meal_type')
            .eq('user_id', userId),
        supabaseAdmin
            .from('workout_logs')
            .select('id, calories, distance_km, logged_at')
            .eq('user_id', userId),
        supabaseAdmin
            .from('sleep_logs')
            .select('night_date, duration_min, sleep_score, ans_charge_status')
            .eq('user_id', userId)
            .order('night_date'),
        supabaseAdmin
            .from('weight_logs')
            .select('weight_kg, logged_at')
            .eq('user_id', userId)
            .order('logged_at'),
        supabaseAdmin
            .from('users')
            .select('target_weight_kg, weight_kg, ippt_date, height_cm')
            .eq('id', userId)
            .single(),
        supabaseAdmin
            .from('friendships')
            .select('id')
            .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)
            .eq('status', 'accepted'),
        supabaseAdmin
            .from('workout_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('source', 'polar')
            .limit(1),
        supabaseAdmin
            .from('sleep_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('source', 'polar')
            .limit(1),
    ])

    // ── Nutrition ──────────────────────────────────────────────────────────
    const mealDaysSet = new Set((mealLogs ?? []).map(l => l.logged_at.slice(0, 10)))
    const mealStreak  = computeStreak(mealDaysSet)

    const mealTypesByDay: Record<string, Set<string>> = {}
    for (const log of mealLogs ?? []) {
        const day = log.logged_at.slice(0, 10)
        if (!mealTypesByDay[day]) mealTypesByDay[day] = new Set()
        mealTypesByDay[day].add(log.meal_type)
    }
    const daysWithAllMealTypes = Object.values(mealTypesByDay)
        .filter(t => t.has('breakfast') && t.has('lunch') && t.has('dinner'))
        .length

    // ── Fitness ────────────────────────────────────────────────────────────
    const workoutsArr          = workoutLogs ?? []
    const totalWorkouts        = workoutsArr.length
    const maxSingleWorkoutKcal = Math.max(0, ...workoutsArr.map(w => w.calories ?? 0))
    const totalKcalBurned      = workoutsArr.reduce((s, w) => s + (w.calories ?? 0), 0)
    const hasPolarSync         = (polarWorkout ?? []).length > 0 || (polarSleep ?? []).length > 0

    // ── IPPT & Running ─────────────────────────────────────────────────────
    // Any workout with distance_km > 0 is treated as a running/cardio session.
    const runs             = workoutsArr.filter(w => (w.distance_km ?? 0) > 0)
    const totalRuns        = runs.length
    const maxRunDistanceKm = Math.max(0, ...runs.map(w => w.distance_km ?? 0))
    const runDaysSet       = new Set(runs.map(w => w.logged_at.slice(0, 10)))
    const runDays          = runDaysSet.size
    const hasIpptDate      = !!(userRow?.ippt_date)

    // ── Sleep ──────────────────────────────────────────────────────────────
    const sleepArr           = sleepLogs ?? []
    const sleepNightSet      = new Set(sleepArr.map(s => s.night_date))
    const sleepStreak        = computeStreak(sleepNightSet)
    const optimalSleepStreak = maxOptimalSleepStreak(sleepArr)
    const maxSleepScore      = Math.max(0, ...sleepArr.map(s => s.sleep_score ?? 0))
    const hasGoReadiness     = sleepArr.some(s => {
        const h = (s.duration_min ?? 0) / 60
        return (s.ans_charge_status ?? 0) >= 4
            && (s.sleep_score == null || s.sleep_score >= 75)
            && h >= 7
    })
    const sleepDebtFree7Days = hasSleepDebtFree7Days(sleepArr)

    // ── Consistency ────────────────────────────────────────────────────────
    const workoutDaySet = new Set(workoutsArr.map(w => w.logged_at.slice(0, 10)))
    const allHabitDays  = new Set<string>()
    for (const day of mealDaysSet) {
        if (workoutDaySet.has(day) && sleepNightSet.has(day)) allHabitDays.add(day)
    }

    // ── Progress ───────────────────────────────────────────────────────────
    const weightArr            = (weightLogs ?? []).sort((a, b) =>
        (a.logged_at ?? '').localeCompare(b.logged_at ?? ''))
    const firstWeightKg        = weightArr[0]?.weight_kg ?? null
    const latestWeightKg       = weightArr[weightArr.length - 1]?.weight_kg ?? null
    const weightChangeSinceStart = (firstWeightKg != null && latestWeightKg != null && weightArr.length >= 2)
        ? latestWeightKg - firstWeightKg
        : 0

    const hasWeightGoal = !!(userRow?.target_weight_kg)
    const goalAchieved  = hasWeightGoal
        && userRow?.weight_kg != null
        && Math.abs(userRow.weight_kg - userRow!.target_weight_kg!) <= 1.0

    // ── Build input ────────────────────────────────────────────────────────
    const input: AchievementInput = {
        totalMealLogs:          (mealLogs ?? []).length,
        mealStreak,
        daysWithAllMealTypes,
        totalWorkouts,
        maxSingleWorkoutKcal,
        totalKcalBurned,
        hasPolarSync,
        hasIpptDate,
        totalRuns,
        maxRunDistanceKm,
        runDays,
        totalSleepLogs:         sleepArr.length,
        sleepStreak,
        optimalSleepStreak,
        maxSleepScore,
        hasGoReadiness,
        sleepDebtFree7Days,
        daysWithAllHabits:      allHabitDays.size,
        perfectWeeks:           hasPerfectWindow(allHabitDays, 7)  ? 1 : 0,
        perfectFortnight:       hasPerfectWindow(allHabitDays, 14) ? 1 : 0,
        totalFriends:           (friendships ?? []).length,
        totalWeightLogs:        (weightLogs ?? []).length,
        hasWeightGoal,
        goalAchieved:           !!goalAchieved,
        weightChangeSinceStart,
        leaderboardPosition:    position,
    }

    const computedIds = new Set(computeAchievements(input))

    // ── Read already-stored achievements (persisted from past sessions) ────
    const { data: stored, error: storedErr } = await supabaseAdmin
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', userId)

    const storedIds = storedErr ? [] : (stored ?? []).map(r => r.achievement_id as string)
    const storedSet = new Set(storedIds)

    // Union: once earned, a badge is never lost
    const allUnlockedIds = new Set([...storedIds, ...computedIds])

    // Upsert newly computed achievements that aren't yet in the DB
    const newlyUnlocked = [...computedIds].filter(id => !storedSet.has(id))
    if (newlyUnlocked.length > 0) {
        await supabaseAdmin
            .from('user_achievements')
            .upsert(
                newlyUnlocked.map(id => ({ user_id: userId, achievement_id: id })),
                { onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
            )

        // Notify for rare+ only — common badges are too frequent to notify about
        const notifTargets = newlyUnlocked
            .map(id => ACHIEVEMENT_MAP[id])
            .filter(a => a && RARITY_ORDER[a.rarity] >= 2)
        for (const a of notifTargets) {
            await insertNotif(
                userId,
                'achievement_unlocked',
                `🏅 Achievement unlocked: ${a.name}`,
                a.description,
            ).catch(() => {})
        }
    }

    const result = ACHIEVEMENTS.map(a => ({ ...a, unlocked: allUnlockedIds.has(a.id) }))
    return NextResponse.json(result)
}

// ── POST ───────────────────────────────────────────────────────────────────
// Called by the leaderboard page after it resolves the user's wing position,
// to unlock top_3_wing / rank_1_wing which can't be derived from raw DB data.

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null)
    if (!body?.userId || !Array.isArray(body?.achievementIds)) {
        return NextResponse.json({ error: 'userId and achievementIds required' }, { status: 400 })
    }

    const { userId, achievementIds } = body as { userId: string; achievementIds: string[] }
    const valid = achievementIds.filter(id => ACHIEVEMENT_MAP[id])
    if (valid.length === 0) return NextResponse.json({ ok: true })

    const { error } = await supabaseAdmin
        .from('user_achievements')
        .upsert(
            valid.map(id => ({ user_id: userId, achievement_id: id })),
            { onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
        )

    if (!error) {
        for (const id of valid) {
            const a = ACHIEVEMENT_MAP[id]
            if (a && RARITY_ORDER[a.rarity] >= 2) {
                await insertNotif(
                    userId,
                    'achievement_unlocked',
                    `🏅 Achievement unlocked: ${a.name}`,
                    a.description,
                ).catch(() => {})
            }
        }
    }

    return NextResponse.json({ ok: !error, error: error?.message })
}
