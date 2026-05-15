// OCT and ME4T are cadets; everything else (officers, WOSpec, ME4A+) are instructors
export const INSTRUCTOR_RANKS = [
    // Officers
    '2LT', 'LTA', 'CPT', 'MAJ', 'LTC', 'SLTC', 'COL',
    // WOSpec
    '3SG', 'SSG', 'MSG', '1WO', '2WO', 'MWO', 'SWO', 'CWO',
    // ME (senior)
    'ME4A', 'ME5', 'ME6', 'ME7', 'ME8', 'ME9',
]

export const PTS_PER_MEAL = 40
export const MAX_MEALS_PER_DAY = 3
export const STREAK_BONUS_PER_DAY = 5
export const PTS_PER_10_KCAL = 1
export const MAX_WORKOUT_KCAL_PER_DAY = 1000   // cap at 100 pts to prevent outliers
export const CONSISTENCY_MULTIPLIER = 1.5       // applied to a day's total when both meal + workout logged

export function isInstructor(rank: string): boolean {
    return INSTRUCTOR_RANKS.includes(rank)
}

/**
 * Score from meal logs, workout logs, and all-time streak.
 * Days with both a meal and workout logged get a 1.5× consistency multiplier.
 */
export function computeScore(
    mealsByDay: Record<string, number>,
    streakDays: number,
    workoutKcalByDay: Record<string, number> = {},
): number {
    const allDays = new Set([...Object.keys(mealsByDay), ...Object.keys(workoutKcalByDay)])

    const dayPts = [...allDays].reduce((sum, day) => {
        const meals = mealsByDay[day] ?? 0
        const kcal = workoutKcalByDay[day] ?? 0
        const mealPts = Math.min(meals, MAX_MEALS_PER_DAY) * PTS_PER_MEAL
        const workoutPts = Math.floor(Math.min(kcal, MAX_WORKOUT_KCAL_PER_DAY) / 10) * PTS_PER_10_KCAL
        const dayTotal = mealPts + workoutPts
        const hasConsistency = meals > 0 && kcal > 0
        return sum + (hasConsistency ? Math.round(dayTotal * CONSISTENCY_MULTIPLIER) : dayTotal)
    }, 0)

    return dayPts + streakDays * STREAK_BONUS_PER_DAY
}

export function computeStreak(daysWithMeals: Set<string>): number {
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 365; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        if (daysWithMeals.has(key)) streak++
        else break
    }
    return streak
}
