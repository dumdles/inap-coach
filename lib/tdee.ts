import { SERVICE_CALORIE_OFFSET, SERVICE_PROTEIN_BOOST } from './service'

export type Gender = 'Male' | 'Female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
export type GoalMode = 'bulk' | 'cut' | 'maintain' | 'ippt'

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
}

const GOAL_CALORIE_ADJUSTMENTS: Record<GoalMode, number> = {
    bulk: 300,
    cut: -500,
    maintain: 0,
    ippt: 0,
}

const GOAL_PROTEIN_MULTIPLIERS: Record<GoalMode, number> = {
    bulk: 2.0,
    cut: 2.2,
    maintain: 1.8,
    ippt: 2.0,
}

export function calculateTDEE(params: {
    gender: Gender
    weight_kg: number
    height_cm: number
    date_of_birth: string
    activity_level: ActivityLevel
    goal_mode: GoalMode
    service?: string
}): { calories: number; protein: number } {
    const { gender, weight_kg, height_cm, date_of_birth, activity_level, goal_mode, service } = params

    const ageMs = Date.now() - new Date(date_of_birth).getTime()
    const age = Math.floor(ageMs / (365.25 * 24 * 3600 * 1000))

    const bmr =
        gender === 'Male'
            ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
            : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

    const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level]

    // Apply per-service calorie and protein adjustments on top of the base formula.
    // These offsets account for training load differences between services that
    // the generic activity multiplier doesn't capture (e.g. Army route marches).
    const calorieOffset = service ? (SERVICE_CALORIE_OFFSET[service] ?? 0) : 0
    const proteinBoost  = service ? (SERVICE_PROTEIN_BOOST[service] ?? 0) : 0

    const calories = Math.round(tdee + GOAL_CALORIE_ADJUSTMENTS[goal_mode] + calorieOffset)
    const protein  = Math.round(weight_kg * (GOAL_PROTEIN_MULTIPLIERS[goal_mode] + proteinBoost))

    return { calories, protein }
}

// ── Standalone nutrition calculator helpers ───────────────────────────────────

/** Mifflin-St Jeor RMR. If body_fat_pct is provided, uses the more accurate Katch-McArdle formula instead. */
export function calculateRMR(params: {
    gender: Gender
    weight_kg: number
    height_cm: number
    age: number
    body_fat_pct?: number | null
}): number {
    const { gender, weight_kg, height_cm, age, body_fat_pct } = params
    if (body_fat_pct != null && body_fat_pct > 0) {
        // Katch-McArdle: more accurate when body composition is known
        const lbm = weight_kg * (1 - body_fat_pct / 100)
        return Math.round(370 + 21.6 * lbm)
    }
    return Math.round(gender === 'Male'
        ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
        : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161)
}

/** Calories burned through activity on top of RMR (TDEE − RMR). */
export function calculateAEE(rmr: number, activity_level: ActivityLevel): number {
    return Math.round(rmr * (ACTIVITY_MULTIPLIERS[activity_level] - 1))
}

/** Total daily calorie target (RMR × activity multiplier + goal adjustment). */
export function calculateEER(rmr: number, activity_level: ActivityLevel, goal_mode: GoalMode): number {
    return Math.round(rmr * ACTIVITY_MULTIPLIERS[activity_level] + GOAL_CALORIE_ADJUSTMENTS[goal_mode])
}

/** Daily protein target in grams based on goal mode. */
export function calculateProteinRequirement(weight_kg: number, goal_mode: GoalMode): number {
    return Math.round(weight_kg * GOAL_PROTEIN_MULTIPLIERS[goal_mode])
}

export function calculateBMI(weight_kg: number, height_cm: number): number {
    if (!height_cm) return 0
    return parseFloat((weight_kg / Math.pow(height_cm / 100, 2)).toFixed(1))
}

export function ageFromDob(dob: string): number {
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000))
}

export function detectMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 10) return 'breakfast'
    if (hour >= 11 && hour < 14) return 'lunch'
    if (hour >= 17 && hour < 21) return 'dinner'
    return 'snack'
}
