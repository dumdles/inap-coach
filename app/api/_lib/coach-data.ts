// Data fetchers for the AI coach chat tools. Every function is scoped to a
// single userId (passed by the route handler from the authed session), so the
// model can only ever see the data of the cadet it is talking to.
//
// Results are kept compact — raw rows plus pre-computed stats from
// lib/analytics.ts — because they are serialised straight into the model
// context as tool outputs.

import { supabaseAdmin } from '@/app/api/cron/_lib'
import {
    computeNutritionStats, computeWeightStats, computeSleepStats,
    computeWorkoutStats, proteinPerKg,
    type DailySummaryRow, type WeightLogRow, type SleepLogRow, type WorkoutLogRow,
} from '@/lib/analytics'
import { calculateTDEE, type Gender, type ActivityLevel, type GoalMode } from '@/lib/tdee'
import type { CoachUserProfile } from './coach-prompt'

export async function getCoachProfile(userId: string): Promise<CoachUserProfile | null> {
    const { data } = await supabaseAdmin
        .from('users')
        .select('full_name, rank, wing, service, gender, date_of_birth, height_cm, weight_kg, goal_mode, activity_level, calorie_target, ippt_date')
        .eq('id', userId)
        .single()
    return data as (CoachUserProfile & { activity_level: string | null }) | null
}

export async function getNutritionSummary(userId: string, days: number) {
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
    const { data } = await supabaseAdmin
        .from('daily_summaries')
        .select('date, total_calories, total_protein_g, total_carbs_g, total_fat_g, calorie_target')
        .eq('user_id', userId)
        .gte('date', since)
        .order('date', { ascending: false })
    const rows = (data ?? []) as DailySummaryRow[]

    const { data: user } = await supabaseAdmin
        .from('users').select('weight_kg').eq('id', userId).single()
    const stats = computeNutritionStats(rows)

    return {
        windowDays: days,
        stats: { ...stats, proteinPerKgBodyweight: proteinPerKg(stats.avgProteinG, user?.weight_kg ?? null) },
        days: rows,
        note: rows.length < days ? 'Unlogged weekdays are likely untracked cookhouse meals, not skipped food.' : undefined,
    }
}

export async function getMealsForDate(userId: string, date: string) {
    const { data } = await supabaseAdmin
        .from('meal_logs')
        .select('quantity_g, meal_type, logged_at, notes, food_items(name, calories_per_100g, protein_g, carbs_g, fat_g)')
        .eq('user_id', userId)
        .gte('logged_at', `${date}T00:00:00+08:00`)
        .lt('logged_at', `${date}T23:59:59+08:00`)
        .order('logged_at', { ascending: true })

    const meals = (data ?? []).map(m => {
        const food = m.food_items as unknown as { name: string; calories_per_100g: number; protein_g: number; carbs_g: number; fat_g: number } | null
        const factor = Number(m.quantity_g) / 100
        return {
            mealType: m.meal_type,
            food: food?.name ?? 'unknown',
            quantityG: Number(m.quantity_g),
            calories: food ? Math.round(Number(food.calories_per_100g) * factor) : null,
            proteinG: food ? Math.round(Number(food.protein_g) * factor) : null,
            carbsG: food ? Math.round(Number(food.carbs_g) * factor) : null,
            fatG: food ? Math.round(Number(food.fat_g) * factor) : null,
            notes: m.notes,
        }
    })
    return { date, meals, totalCalories: meals.reduce((a, m) => a + (m.calories ?? 0), 0) }
}

export async function getWorkouts(userId: string, days: number) {
    const since = new Date(Date.now() - days * 86400_000).toISOString()
    const { data } = await supabaseAdmin
        .from('workout_logs')
        .select('name, sport, duration_min, calories, distance_km, sets, reps, heart_rate_avg, training_load, source, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', since)
        .order('logged_at', { ascending: false })
        .limit(50)
    const rows = (data ?? []) as (WorkoutLogRow & Record<string, unknown>)[]
    return { windowDays: days, stats: computeWorkoutStats(rows), workouts: rows }
}

export async function getWeightTrend(userId: string, days: number) {
    const since = new Date(Date.now() - days * 86400_000).toISOString()
    const { data } = await supabaseAdmin
        .from('weight_logs')
        .select('weight_kg, body_fat_pct, logged_at')
        .eq('user_id', userId)
        .gte('logged_at', since)
        .order('logged_at', { ascending: true })
    const rows = (data ?? []) as WeightLogRow[]

    const { data: user } = await supabaseAdmin
        .from('users').select('target_weight_kg, weight_goal_date, goal_mode').eq('id', userId).single()

    return {
        windowDays: days,
        stats: computeWeightStats(rows),
        logs: rows.map(r => ({ date: r.logged_at.slice(0, 10), weightKg: Number(r.weight_kg), bodyFatPct: r.body_fat_pct })),
        goal: user ? { targetWeightKg: user.target_weight_kg, goalDate: user.weight_goal_date, goalMode: user.goal_mode } : null,
    }
}

export async function getSleep(userId: string, days: number) {
    const since = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10)
    const { data } = await supabaseAdmin
        .from('sleep_logs')
        .select('night_date, duration_min, sleep_score, ans_charge_status, deep_min, rem_min, hrv_avg')
        .eq('user_id', userId)
        .gte('night_date', since)
        .order('night_date', { ascending: false })
    const rows = (data ?? []) as (SleepLogRow & Record<string, unknown>)[]
    return { windowDays: days, stats: computeSleepStats(rows), nights: rows }
}

export async function getLeaderboard(userId: string) {
    const { data: scores } = await supabaseAdmin
        .from('leaderboard_scores')
        .select('week_start, consistency_score, improvement_score, total_score')
        .eq('user_id', userId)
        .order('week_start', { ascending: false })
        .limit(6)
    return { recentWeeks: scores ?? [] }
}

export async function getIpptResults(userId: string) {
    const [{ data: results }, { data: user }] = await Promise.all([
        supabaseAdmin
            .from('ippt_results')
            .select('test_date, pushup_reps, situp_reps, run_time_seconds, total_points, award')
            .eq('user_id', userId)
            .order('test_date', { ascending: false })
            .limit(5),
        supabaseAdmin.from('users').select('ippt_date').eq('id', userId).single(),
    ])
    return { upcomingIpptDate: user?.ippt_date ?? null, pastResults: results ?? [] }
}

/**
 * Writes the cadet's upcoming IPPT date to their profile. The only mutating
 * coach tool — used when the cadet asks the coach to log/update their next
 * IPPT. Scoped to the authed userId, so a cadet can only set their own date.
 * Rejects malformed dates and anything more than ~2 years out as a guard
 * against the model passing a bad value.
 */
export async function setIpptDate(userId: string, date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return { error: 'Date must be in YYYY-MM-DD format.' }
    }
    const parsed = new Date(`${date}T00:00:00+08:00`)
    if (Number.isNaN(parsed.getTime())) {
        return { error: 'That is not a valid calendar date.' }
    }
    const twoYears = Date.now() + 2 * 365.25 * 86400_000
    if (parsed.getTime() > twoYears) {
        return { error: 'IPPT date looks too far in the future — please confirm the year.' }
    }

    const { error } = await supabaseAdmin
        .from('users')
        .update({ ippt_date: date })
        .eq('id', userId)
    if (error) return { error: 'Could not save the IPPT date — please try again.' }
    return { saved: true, ipptDate: date }
}

/** Recomputes the cadet's recommended calorie/protein targets from their profile. */
export async function getTargets(userId: string) {
    const { data: user } = await supabaseAdmin
        .from('users')
        .select('gender, weight_kg, height_cm, date_of_birth, activity_level, goal_mode, service, calorie_target')
        .eq('id', userId)
        .single()
    if (!user?.gender || !user.weight_kg || !user.height_cm || !user.date_of_birth) {
        return { error: 'Profile incomplete — cadet needs to fill in gender, weight, height, and date of birth in Settings.' }
    }
    const computed = calculateTDEE({
        gender: user.gender as Gender,
        weight_kg: Number(user.weight_kg),
        height_cm: Number(user.height_cm),
        date_of_birth: user.date_of_birth,
        activity_level: (user.activity_level ?? 'moderate') as ActivityLevel,
        goal_mode: (user.goal_mode ?? 'maintain') as GoalMode,
        service: user.service ?? undefined,
    })
    return {
        recommendedCalories: computed.calories,
        recommendedProteinG: computed.protein,
        currentCalorieTarget: user.calorie_target,
        goalMode: user.goal_mode,
    }
}
