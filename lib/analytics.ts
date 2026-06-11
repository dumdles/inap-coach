// Deterministic analytics helpers shared by the dashboard, AI insights, and
// the AI coach chat tools. All trend/average maths lives here so the LLM is
// never asked to do arithmetic — we compute the numbers and let the model
// interpret them.

export type DailySummaryRow = {
    date: string
    total_calories: number
    total_protein_g: number
    total_carbs_g: number
    total_fat_g: number
    calorie_target: number | null
}

export type WeightLogRow = {
    weight_kg: number
    body_fat_pct: number | null
    logged_at: string
}

export type SleepLogRow = {
    night_date: string
    duration_min: number
    sleep_score: number | null
    deep_min: number | null
    rem_min: number | null
}

export type WorkoutLogRow = {
    name: string
    duration_min: number | null
    calories: number | null
    distance_km: number | null
    logged_at: string
    sport: string | null
}

const DAY_MS = 24 * 3600 * 1000

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Least-squares slope of value over time, in units per day.
 * Returns null when there are fewer than 3 points (a "trend" from 2 points
 * is noise, not signal — especially with sparse cadet logging).
 */
export function linearTrendPerDay(points: { date: string; value: number }[]): number | null {
    if (points.length < 3) return null
    const xs = points.map(p => new Date(p.date).getTime() / DAY_MS)
    const ys = points.map(p => p.value)
    const n = xs.length
    const meanX = xs.reduce((a, b) => a + b, 0) / n
    const meanY = ys.reduce((a, b) => a + b, 0) / n
    let num = 0, den = 0
    for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (ys[i] - meanY)
        den += (xs[i] - meanX) ** 2
    }
    return den === 0 ? null : Math.round((num / den) * 100) / 100 // 2dp
}

function avg(values: number[]): number | null {
    if (!values.length) return null
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

/**
 * Nutrition stats over a window of daily summaries.
 * `adherencePct` = share of logged days within ±10% of the calorie target.
 * Days with no log at all are excluded — in camp, an unlogged day usually
 * means cookhouse meals weren't tracked, not that the cadet didn't eat.
 */
export function computeNutritionStats(summaries: DailySummaryRow[]) {
    const daysLogged = summaries.length
    const withTarget = summaries.filter(s => s.calorie_target != null && s.calorie_target > 0)
    const onTarget = withTarget.filter(s =>
        Math.abs(s.total_calories - s.calorie_target!) / s.calorie_target! <= 0.10
    ).length

    return {
        daysLogged,
        avgCalories: avg(summaries.map(s => Number(s.total_calories))),
        avgProteinG: avg(summaries.map(s => Number(s.total_protein_g))),
        avgCarbsG: avg(summaries.map(s => Number(s.total_carbs_g))),
        avgFatG: avg(summaries.map(s => Number(s.total_fat_g))),
        avgCalorieTarget: avg(withTarget.map(s => Number(s.calorie_target))),
        adherencePct: withTarget.length ? Math.round((onTarget / withTarget.length) * 100) : null,
        calorieTrendPerDay: linearTrendPerDay(
            summaries.map(s => ({ date: s.date, value: Number(s.total_calories) }))
        ),
    }
}

/** Weight change and weekly trend from weight logs (any order). */
export function computeWeightStats(logs: WeightLogRow[]) {
    if (!logs.length) return null
    const sorted = [...logs].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    const trendPerDay = linearTrendPerDay(
        sorted.map(l => ({ date: l.logged_at, value: Number(l.weight_kg) }))
    )
    const latestBf = [...sorted].reverse().find(l => l.body_fat_pct != null)?.body_fat_pct ?? null

    return {
        entries: sorted.length,
        currentKg: round1(Number(last.weight_kg)),
        changeKg: round1(Number(last.weight_kg) - Number(first.weight_kg)),
        trendKgPerWeek: trendPerDay == null ? null : round1(trendPerDay * 7),
        latestBodyFatPct: latestBf == null ? null : Number(latestBf),
        firstDate: first.logged_at.slice(0, 10),
        lastDate: last.logged_at.slice(0, 10),
    }
}

/** Sleep duration/quality averages and the duration trend across the window. */
export function computeSleepStats(logs: SleepLogRow[]) {
    if (!logs.length) return null
    const hours = logs.map(l => l.duration_min / 60)
    const scores = logs.filter(l => l.sleep_score != null).map(l => l.sleep_score!)

    return {
        nights: logs.length,
        avgHours: round1(hours.reduce((a, b) => a + b, 0) / hours.length),
        avgScore: scores.length ? avg(scores) : null,
        avgDeepMin: avg(logs.filter(l => l.deep_min != null).map(l => l.deep_min!)),
        avgRemMin: avg(logs.filter(l => l.rem_min != null).map(l => l.rem_min!)),
        hoursTrendPerNight: linearTrendPerDay(
            logs.map(l => ({ date: l.night_date, value: l.duration_min / 60 }))
        ),
    }
}

/** Workout volume totals plus a per-sport breakdown. */
export function computeWorkoutStats(logs: WorkoutLogRow[]) {
    const bySport: Record<string, { count: number; totalMin: number }> = {}
    for (const l of logs) {
        const key = l.sport ?? l.name ?? 'other'
        bySport[key] ??= { count: 0, totalMin: 0 }
        bySport[key].count += 1
        bySport[key].totalMin += l.duration_min ?? 0
    }
    return {
        count: logs.length,
        totalDurationMin: logs.reduce((a, l) => a + (l.duration_min ?? 0), 0),
        totalCalories: logs.reduce((a, l) => a + (l.calories ?? 0), 0),
        totalDistanceKm: round1(logs.reduce((a, l) => a + Number(l.distance_km ?? 0), 0)),
        bySport,
    }
}

/** Grams of protein per kg bodyweight — the number coaches actually reason in. */
export function proteinPerKg(avgProteinG: number | null, weightKg: number | null): number | null {
    if (avgProteinG == null || !weightKg) return null
    return round1(avgProteinG / weightKg)
}
