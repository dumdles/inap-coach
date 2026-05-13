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

export function isInstructor(rank: string): boolean {
    return INSTRUCTOR_RANKS.includes(rank)
}

/** Score from meal logs in a period + all-time streak */
export function computeScore(
    mealsByDay: Record<string, number>,
    streakDays: number,
): number {
    const mealPts = Object.values(mealsByDay).reduce(
        (sum, count) => sum + Math.min(count, MAX_MEALS_PER_DAY) * PTS_PER_MEAL,
        0,
    )
    return mealPts + streakDays * STREAK_BONUS_PER_DAY
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
