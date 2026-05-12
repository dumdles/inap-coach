type Gender = 'Male' | 'Female'
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
type GoalMode = 'bulk' | 'cut' | 'maintain' | 'ippt'

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
}): { calories: number; protein: number } {
    const { gender, weight_kg, height_cm, date_of_birth, activity_level, goal_mode } = params

    const ageMs = Date.now() - new Date(date_of_birth).getTime()
    const age = Math.floor(ageMs / (365.25 * 24 * 3600 * 1000))

    const bmr =
        gender === 'Male'
            ? 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
            : 10 * weight_kg + 6.25 * height_cm - 5 * age - 161

    const tdee = bmr * ACTIVITY_MULTIPLIERS[activity_level]
    const calories = Math.round(tdee + GOAL_CALORIE_ADJUSTMENTS[goal_mode])
    const protein = Math.round(weight_kg * GOAL_PROTEIN_MULTIPLIERS[goal_mode])

    return { calories, protein }
}

export function detectMealType(): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
    const hour = new Date().getHours()
    if (hour >= 5 && hour < 10) return 'breakfast'
    if (hour >= 11 && hour < 14) return 'lunch'
    if (hour >= 17 && hour < 21) return 'dinner'
    return 'snack'
}
