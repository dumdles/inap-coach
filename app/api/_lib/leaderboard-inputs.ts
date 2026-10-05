import { supabaseAdmin } from '@/app/api/cron/_lib'

// Per-user, per-day activity in the shape lib/scoring.ts computeScore() expects.
// The heavy lifting (grouping a year of meals into streaks, summing workout
// calories per day) happens in Postgres via leaderboard_inputs() — see
// docs/performance_migration.sql — so the API only receives a small summary
// instead of thousands of raw log rows. Used by /api/leaderboard and /api/wing-standings.

type SleepNight = { durationMin: number; sleepScore: number | null; ansStatus: number | null }

export type UserActivity = {
    mealsByDay: Record<string, number>       // 'YYYY-MM-DD' → meals logged
    workoutKcalByDay: Record<string, number> // 'YYYY-MM-DD' → workout kcal
    sleepByDay: Record<string, SleepNight>   // night_date → sleep record
    streak: number                           // consecutive days with ≥1 meal, ending today
}

type RpcResult = {
    meals: [string, string, number][]
    workouts: [string, string, number][]
    sleep: [string, string, number, number | null, number | null][]
    streaks: Record<string, number>
}

/**
 * Activity for `userIds` since `since`. Pass includeActivity=false when only
 * meals + streaks are needed (wing standings) to skip workouts and sleep.
 * Every requested user gets an entry, even with no logs.
 */
export async function loadUserActivity(userIds: string[], since: Date, includeActivity = true): Promise<Map<string, UserActivity>> {
    const out = new Map<string, UserActivity>()
    for (const id of userIds) out.set(id, { mealsByDay: {}, workoutKcalByDay: {}, sleepByDay: {}, streak: 0 })
    if (!userIds.length) return out

    const { data, error } = await supabaseAdmin.rpc('leaderboard_inputs', {
        p_user_ids: userIds,
        p_since: since.toISOString(),
        p_since_date: since.toISOString().slice(0, 10),
        p_include_activity: includeActivity,
    })
    if (error) {
        // PGRST202 = function not found → the migration hasn't been run on this database.
        const hint = error.code === 'PGRST202' ? ' — run docs/performance_migration.sql in Supabase' : ''
        throw new Error(`leaderboard_inputs failed: ${error.message}${hint}`)
    }

    const r = data as RpcResult
    for (const [id, day, n] of r.meals) { const u = out.get(id); if (u) u.mealsByDay[day] = n }
    for (const [id, day, kcal] of r.workouts) { const u = out.get(id); if (u) u.workoutKcalByDay[day] = Number(kcal) }
    for (const [id, night, durationMin, sleepScore, ansStatus] of r.sleep) {
        const u = out.get(id)
        if (u) u.sleepByDay[night] = { durationMin, sleepScore: sleepScore ?? null, ansStatus: ansStatus ?? null }
    }
    for (const [id, streak] of Object.entries(r.streaks)) { const u = out.get(id); if (u) u.streak = streak }
    return out
}
