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

// ── Sleep scoring ────────────────────────────────────────────────────────
// Sleep contributes points based on duration (the dominant factor),
// with bonuses for high Polar sleep score and good ANS recharge.
export const SLEEP_PTS_OPTIMAL    = 30   // 6h–9h slept
export const SLEEP_PTS_OK         = 20   // 5h–6h or 9h–10h
export const SLEEP_PTS_POOR       = 10   // anything else (still rewards logging it)
export const SLEEP_BONUS_HIGH_SCORE = 10 // Polar sleep_score >= 80
export const SLEEP_BONUS_GOOD_ANS   = 10 // Polar ans_charge_status >= 4 (above usual or better)

export function isInstructor(rank: string): boolean {
    return INSTRUCTOR_RANKS.includes(rank)
}

/**
 * Points for a single night's sleep.
 *
 * @param durationMin Total time slept, in minutes
 * @param sleepScore  Polar sleep score (0-100), or null
 * @param ansStatus   Polar ANS / nightly recharge status (1-5), or null
 */
export function sleepPointsForNight(
    durationMin: number,
    sleepScore: number | null = null,
    ansStatus: number | null = null,
): number {
    if (!durationMin || durationMin <= 0) return 0

    const hours = durationMin / 60
    let base: number
    if (hours >= 6 && hours <= 9)               base = SLEEP_PTS_OPTIMAL
    else if (hours >= 5 && hours <= 10)         base = SLEEP_PTS_OK
    else                                        base = SLEEP_PTS_POOR

    let bonus = 0
    if (sleepScore != null && sleepScore >= 80) bonus += SLEEP_BONUS_HIGH_SCORE
    if (ansStatus  != null && ansStatus  >= 4)  bonus += SLEEP_BONUS_GOOD_ANS

    return base + bonus
}

/**
 * Score from meal logs, workout logs, sleep logs, and all-time streak.
 *
 * Days with at least two of {meal, workout, sleep} logged get the 1.5×
 * consistency multiplier — encourages full-spectrum recovery, not just one habit.
 */
export function computeScore(
    mealsByDay: Record<string, number>,
    streakDays: number,
    workoutKcalByDay: Record<string, number> = {},
    sleepByDay: Record<string, { durationMin: number; sleepScore: number | null; ansStatus: number | null }> = {},
): number {
    const allDays = new Set([
        ...Object.keys(mealsByDay),
        ...Object.keys(workoutKcalByDay),
        ...Object.keys(sleepByDay),
    ])

    const dayPts = [...allDays].reduce((sum, day) => {
        const meals = mealsByDay[day] ?? 0
        const kcal = workoutKcalByDay[day] ?? 0
        const sleep = sleepByDay[day]

        const mealPts    = Math.min(meals, MAX_MEALS_PER_DAY) * PTS_PER_MEAL
        const workoutPts = Math.floor(Math.min(kcal, MAX_WORKOUT_KCAL_PER_DAY) / 10) * PTS_PER_10_KCAL
        const sleepPts   = sleep ? sleepPointsForNight(sleep.durationMin, sleep.sleepScore, sleep.ansStatus) : 0

        const dayTotal = mealPts + workoutPts + sleepPts
        const habits = (meals > 0 ? 1 : 0) + (kcal > 0 ? 1 : 0) + (sleep ? 1 : 0)
        const hasConsistency = habits >= 2
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

// ── Recovery readiness ────────────────────────────────────────────────────
// Translates last night's sleep into a single training recommendation.

export type ReadinessLevel = 'go' | 'normal' | 'caution' | 'rest'

export type ReadinessAssessment = {
    level: ReadinessLevel
    headline: string
    detail: string
}

/**
 * Translate a sleep record into a training-readiness recommendation.
 * Designed to give cadets one clear action, not a wall of numbers.
 */
export function recoveryReadiness(
    durationMin: number | null,
    sleepScore: number | null,
    ansStatus: number | null,
): ReadinessAssessment {
    const hours = durationMin ? durationMin / 60 : 0

    // Worst signal wins — if anything points to "rest", we recommend rest.
    if (ansStatus === 1 || (durationMin != null && hours < 4)) {
        return {
            level: 'rest',
            headline: 'Rest day — protect tonight\'s sleep',
            detail: 'Your nervous system is depleted. Hydrate, eat well, and prioritise an early bedtime. High-intensity training now will set you back.',
        }
    }

    if (ansStatus === 2 || (sleepScore != null && sleepScore < 50) || hours < 5.5) {
        return {
            level: 'caution',
            headline: 'Active recovery only',
            detail: 'Stick to light cardio, mobility, or technique work. Skip PR attempts and high-intensity intervals — you\'ll get more out of them once you\'re recharged.',
        }
    }

    if ((ansStatus != null && ansStatus >= 4) && (sleepScore == null || sleepScore >= 75) && hours >= 7) {
        return {
            level: 'go',
            headline: 'Push hard — your body is primed',
            detail: 'ANS recharge above usual and solid sleep duration. Great window for high-intensity intervals, strength PRs, or your hardest run of the week.',
        }
    }

    return {
        level: 'normal',
        headline: 'Normal training day',
        detail: 'You\'re recovered enough for a regular session. Save your hardest efforts for days when sleep and ANS both look strong.',
    }
}

/**
 * Cumulative sleep debt vs a daily target, looking back N nights.
 * Returns the number of hours short. Negative means you've banked extra sleep.
 */
export function sleepDebtHours(
    nightlyDurations: number[],     // minutes, most recent last
    targetHoursPerNight = 7.5,
): number {
    const targetMin = targetHoursPerNight * 60
    const totalShort = nightlyDurations.reduce((s, d) => s + (targetMin - (d ?? 0)), 0)
    return parseFloat((totalShort / 60).toFixed(1))
}
