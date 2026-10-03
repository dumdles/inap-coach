// ── Command analytics (Admin console) ────────────────────────────────────────
// Pure, deterministic maths behind /api/admin/analytics. The route fetches raw
// rows; this file turns them into the KPIs, trends, per-wing comparisons,
// watchlist flags and plain-English findings the Admin console renders.
// Kept free of Supabase/Next imports so it is easy to read and unit-test.
//
// Conventions
//  • All dates are Singapore calendar dates ('YYYY-MM-DD').
//  • A "window" is the last N days ending today; the "previous window" is the
//    N days before that, used for the deltas on each KPI.
//  • Only users with role = 'cadet' are counted.

import { calculateProteinRequirement, type GoalMode } from '@/lib/tdee'

// ── Input row shapes (exactly what the route selects) ────────────────────────
export type AUser = {
    id: string; full_name: string | null; rank: string | null; wing: string | null
    platoon: string | null; section: string | null; role: string
    goal_mode: string | null; weight_kg: number | null; ippt_date: string | null
}
export type ASummary = { user_id: string; date: string; total_calories: number; total_protein_g: number; calorie_target: number | null }
export type AWorkout = { user_id: string; logged_at: string; duration_min: number | null }
export type ASleep = { user_id: string; night_date: string; duration_min: number }
export type AIppt = { user_id: string; test_date: string; total_points: number; award: string | null }

// ── Output shapes ────────────────────────────────────────────────────────────
export type Severity = 'critical' | 'serious' | 'warning'
export type FlagKey = 'inactive' | 'low_sleep' | 'under_fuelling' | 'low_protein' | 'low_training' | 'ippt_risk'
export type Flag = { key: FlagKey; severity: Severity; label: string }

export type IpptTier = 'gold' | 'silver' | 'pass' | 'fail' | 'none'

export type CadetInsight = {
    id: string; full_name: string; rank: string; wing: string; platoon: string | null; section: string | null
    goal_mode: string | null
    lastActive: string | null; daysInactive: number | null
    activeDays: number              // days in window with any log
    adherencePct: number | null     // logged days within ±10% of calorie target
    proteinHitPct: number | null    // logged days reaching ≥90% of protein requirement
    avgSleepH: number | null; sleepNights: number
    trainingMinWk: number           // logged workout minutes per week
    ippt: { points: number; tier: IpptTier; date: string } | null
    ipptDate: string | null; daysToIppt: number | null
    flags: Flag[]; riskScore: number
}

export type Kpi = { value: number | null; prev: number | null }

export type WingInsight = {
    wing: string; cadets: number
    activePct: number | null; adherencePct: number | null; proteinHitPct: number | null
    avgSleepH: number | null; trainingMinWk: number | null; ipptPassPct: number | null
    atRisk: number; atRiskPct: number
    tiers: Record<IpptTier, number>
    upcomingIppt: number
    prevActivePct: number | null
}

export type Finding = { severity: Severity | 'good'; title: string; detail: string; href?: string }

export type CommandAnalytics = {
    windowDays: number
    generatedAt: string
    dates: string[]                              // window dates, oldest → newest
    totals: { cadets: number; wings: number }
    kpis: {
        dailyActivePct: Kpi; adherencePct: Kpi; proteinHitPct: Kpi
        avgSleepH: Kpi; trainingMinWk: Kpi; ipptPassPct: Kpi; atRisk: Kpi
    }
    daily: { date: string; activePct: number; avgSleepH: number | null; trainingMin: number }[]
    dailyByWing: Record<string, number[]>       // daily active % per wing, aligned to `dates`
    wings: WingInsight[]
    riskDrivers: { key: FlagKey; label: string; count: number }[]
    sleepBuckets: { label: string; count: number; below6: boolean }[]
    ipptUpcoming: { within14: number; within30: number; notReady30: number }
    cadets: CadetInsight[]
    findings: Finding[]
}

// ── Thresholds (single place to tune what counts as "at risk") ───────────────
export const THRESHOLDS = {
    inactiveSerious: 4,        // days without any log
    inactiveCritical: 7,
    lowSleepH: 6,              // avg hours (needs ≥3 nights)
    veryLowSleepH: 5,
    underFuelPct: 0.8,         // avg intake below 80% of calorie target
    lowProteinHitPct: 40,      // <40% of logged days reach the protein target
    lowTrainingMinWk: 60,
    ipptHorizonDays: 30,
    minSamples: 3,
}

const FLAG_LABEL: Record<FlagKey, string> = {
    inactive: 'Not logging',
    low_sleep: 'Short sleep',
    under_fuelling: 'Under-fuelling',
    low_protein: 'Low protein',
    low_training: 'Low logged training',
    ippt_risk: 'IPPT at risk',
}
const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 3, serious: 2, warning: 1 }

// ── Date helpers (SGT = UTC+8, no DST) ───────────────────────────────────────
const DAY = 86400_000
export const sgDate = (d: Date | string) => new Date(new Date(d).getTime() + 8 * 3600_000).toISOString().slice(0, 10)
const addDays = (date: string, n: number) => new Date(new Date(date + 'T00:00:00Z').getTime() + n * DAY).toISOString().slice(0, 10)
const diffDays = (a: string, b: string) => Math.round((new Date(a + 'T00:00:00Z').getTime() - new Date(b + 'T00:00:00Z').getTime()) / DAY)

const pct = (num: number, den: number) => (den ? Math.round((num / den) * 100) : null)
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)
const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10)

function tierOf(award: string | null, points: number): IpptTier {
    const a = award?.toLowerCase()
    if (a === 'gold' || a === 'silver' || a === 'pass' || a === 'fail') return a
    // Fall back to SAF thresholds when the award wasn't recorded
    if (points >= 85) return 'gold'
    if (points >= 75) return 'silver'
    if (points >= 51) return 'pass'
    return 'fail'
}

// ── Per-window maths for one cadet ───────────────────────────────────────────
type CadetLogs = { summaries: ASummary[]; workouts: AWorkout[]; sleeps: ASleep[]; activeDates: Set<string> }

function windowStats(u: AUser, logs: CadetLogs, from: string, to: string, days: number) {
    const inWin = (d: string) => d >= from && d <= to
    const sums = logs.summaries.filter(s => inWin(s.date))
    const withTarget = sums.filter(s => s.calorie_target && s.calorie_target > 0)
    const onTarget = withTarget.filter(s => Math.abs(s.total_calories - s.calorie_target!) / s.calorie_target! <= 0.1).length
    const proteinReq = u.weight_kg ? calculateProteinRequirement(Number(u.weight_kg), (u.goal_mode ?? 'maintain') as GoalMode) : null
    const proteinHit = proteinReq ? sums.filter(s => Number(s.total_protein_g) >= proteinReq * 0.9).length : 0
    const sleeps = logs.sleeps.filter(s => inWin(s.night_date))
    const trainingMin = logs.workouts.filter(w => inWin(sgDate(w.logged_at))).reduce((a, w) => a + (w.duration_min ?? 0), 0)
    const avgIntakeRatio = withTarget.length ? mean(withTarget.map(s => s.total_calories / s.calorie_target!)) : null
    return {
        activeDays: [...logs.activeDates].filter(inWin).length,
        nutritionDays: sums.length,
        targetDays: withTarget.length,
        onTarget,
        proteinDays: proteinReq ? sums.length : 0,
        proteinHit,
        sleepMins: sleeps.map(s => s.duration_min),
        trainingMin,
        trainingMinWk: Math.round(trainingMin / (days / 7)),
        avgIntakeRatio,
    }
}

function latestIppt(results: AIppt[], asOf: string) {
    const r = results.filter(x => x.test_date <= asOf).sort((a, b) => b.test_date.localeCompare(a.test_date))[0]
    return r ? { points: Number(r.total_points), tier: tierOf(r.award, Number(r.total_points)), date: r.test_date } : null
}

function flagsFor(c: Omit<CadetInsight, 'flags' | 'riskScore'>, intakeRatio: number | null, targetDays: number, proteinDays: number): Flag[] {
    const T = THRESHOLDS
    const f: Flag[] = []
    if (c.daysInactive == null || c.daysInactive >= T.inactiveCritical)
        f.push({ key: 'inactive', severity: 'critical', label: c.daysInactive == null ? 'No logs on record' : `No logs for ${c.daysInactive} days` })
    else if (c.daysInactive >= T.inactiveSerious)
        f.push({ key: 'inactive', severity: 'serious', label: `No logs for ${c.daysInactive} days` })

    if (c.avgSleepH != null && c.sleepNights >= T.minSamples && c.avgSleepH < T.lowSleepH)
        f.push({ key: 'low_sleep', severity: c.avgSleepH < T.veryLowSleepH ? 'critical' : 'serious', label: `Averaging ${c.avgSleepH}h sleep` })

    if (intakeRatio != null && targetDays >= T.minSamples && intakeRatio < T.underFuelPct)
        f.push({ key: 'under_fuelling', severity: 'serious', label: `Eating ${Math.round(intakeRatio * 100)}% of calorie target` })

    if (c.proteinHitPct != null && proteinDays >= T.minSamples && c.proteinHitPct < T.lowProteinHitPct)
        f.push({ key: 'low_protein', severity: 'warning', label: `Protein target hit on ${c.proteinHitPct}% of days` })

    if (c.activeDays > 0 && c.trainingMinWk < T.lowTrainingMinWk)
        f.push({ key: 'low_training', severity: 'warning', label: `${c.trainingMinWk} min/week training logged` })

    if (c.daysToIppt != null && c.daysToIppt >= 0 && c.daysToIppt <= T.ipptHorizonDays) {
        if (!c.ippt) f.push({ key: 'ippt_risk', severity: 'serious', label: `IPPT in ${c.daysToIppt}d, no result on record` })
        else if (c.ippt.tier === 'fail') f.push({ key: 'ippt_risk', severity: 'critical', label: `IPPT in ${c.daysToIppt}d, last result ${c.ippt.points} pts (fail)` })
    }
    return f
}

const isAtRisk = (flags: Flag[]) => flags.some(f => f.severity !== 'warning')

// ── Main entry ───────────────────────────────────────────────────────────────
export function buildCommandAnalytics(input: {
    days: number; today: string
    users: AUser[]; summaries: ASummary[]; workouts: AWorkout[]; sleeps: ASleep[]; ippt: AIppt[]
}): CommandAnalytics {
    const { days, today } = input
    const from = addDays(today, -(days - 1))
    const prevTo = addDays(from, -1)
    const prevFrom = addDays(prevTo, -(days - 1))
    const dates = Array.from({ length: days }, (_, i) => addDays(from, i))

    const cadets = input.users.filter(u => u.role === 'cadet')

    // Index every log by cadet so each per-cadet pass is O(own logs).
    const logs = new Map<string, CadetLogs>(cadets.map(u => [u.id, { summaries: [], workouts: [], sleeps: [], activeDates: new Set() }]))
    for (const s of input.summaries) { const l = logs.get(s.user_id); if (l) { l.summaries.push(s); l.activeDates.add(s.date) } }
    for (const w of input.workouts) { const l = logs.get(w.user_id); if (l) { l.workouts.push(w); l.activeDates.add(sgDate(w.logged_at)) } }
    for (const s of input.sleeps) { const l = logs.get(s.user_id); if (l) { l.sleeps.push(s); l.activeDates.add(s.night_date) } }
    const ipptBy = new Map<string, AIppt[]>()
    for (const r of input.ippt) { if (!ipptBy.has(r.user_id)) ipptBy.set(r.user_id, []); ipptBy.get(r.user_id)!.push(r) }

    // ── Per-cadet insight (current window) + the same stats for the previous window
    type Row = { insight: CadetInsight; cur: ReturnType<typeof windowStats>; prev: ReturnType<typeof windowStats>; prevIppt: ReturnType<typeof latestIppt>; prevFlags: Flag[] }
    const rows: Row[] = cadets.map(u => {
        const l = logs.get(u.id)!
        const cur = windowStats(u, l, from, today, days)
        const prev = windowStats(u, l, prevFrom, prevTo, days)
        const lastActive = [...l.activeDates].filter(d => d <= today).sort().pop() ?? null
        const ippt = latestIppt(ipptBy.get(u.id) ?? [], today)
        const avgSleep = mean(cur.sleepMins)
        const base: Omit<CadetInsight, 'flags' | 'riskScore'> = {
            id: u.id, full_name: u.full_name ?? 'Unknown', rank: u.rank ?? '', wing: u.wing ?? 'Unassigned',
            platoon: u.platoon, section: u.section, goal_mode: u.goal_mode,
            lastActive, daysInactive: lastActive ? diffDays(today, lastActive) : null,
            activeDays: cur.activeDays,
            adherencePct: pct(cur.onTarget, cur.targetDays),
            proteinHitPct: pct(cur.proteinHit, cur.proteinDays),
            avgSleepH: r1(avgSleep == null ? null : avgSleep / 60), sleepNights: cur.sleepMins.length,
            trainingMinWk: cur.trainingMinWk,
            ippt, ipptDate: u.ippt_date, daysToIppt: u.ippt_date ? diffDays(u.ippt_date, today) : null,
        }
        const flags = flagsFor(base, cur.avgIntakeRatio, cur.targetDays, cur.proteinDays)

        // Previous-window flags, so the "at-risk" KPI has a delta too.
        const prevLast = [...l.activeDates].filter(d => d <= prevTo).sort().pop() ?? null
        const prevSleep = mean(prev.sleepMins)
        const prevIppt = latestIppt(ipptBy.get(u.id) ?? [], prevTo)
        const prevFlags = flagsFor({
            ...base,
            daysInactive: prevLast ? diffDays(prevTo, prevLast) : null,
            activeDays: prev.activeDays,
            proteinHitPct: pct(prev.proteinHit, prev.proteinDays),
            avgSleepH: r1(prevSleep == null ? null : prevSleep / 60), sleepNights: prev.sleepMins.length,
            trainingMinWk: prev.trainingMinWk,
            ippt: prevIppt, daysToIppt: u.ippt_date ? diffDays(u.ippt_date, prevTo) : null,
        }, prev.avgIntakeRatio, prev.targetDays, prev.proteinDays)

        return {
            insight: { ...base, flags, riskScore: flags.reduce((a, f) => a + SEVERITY_WEIGHT[f.severity], 0) },
            cur, prev, prevIppt, prevFlags,
        }
    })

    // ── Aggregate helpers over any subset of rows
    const activeOn = (r: Row, d: string) => logs.get(r.insight.id)!.activeDates.has(d)
    const dailyActivePct = (subset: Row[], ds: string[]) =>
        ds.map(d => (subset.length ? Math.round((subset.filter(r => activeOn(r, d)).length / subset.length) * 100) : 0))
    const prevDates = Array.from({ length: days }, (_, i) => addDays(prevFrom, i))

    function aggregate(subset: Row[]) {
        const sum = (f: (r: Row) => number) => subset.reduce((a, r) => a + f(r), 0)
        const sleepAll = (w: 'cur' | 'prev') => subset.flatMap(r => r[w].sleepMins)
        const passPct = (pick: (r: Row) => ReturnType<typeof latestIppt>) => {
            const tested = subset.map(pick).filter(Boolean)
            return pct(tested.filter(t => t!.tier !== 'fail').length, tested.length)
        }
        const cur = {
            dailyActivePct: mean(dailyActivePct(subset, dates)),
            adherencePct: pct(sum(r => r.cur.onTarget), sum(r => r.cur.targetDays)),
            proteinHitPct: pct(sum(r => r.cur.proteinHit), sum(r => r.cur.proteinDays)),
            avgSleepH: (() => { const m = mean(sleepAll('cur')); return m == null ? null : r1(m / 60) })(),
            trainingMinWk: subset.length ? Math.round(sum(r => r.cur.trainingMin) / subset.length / (days / 7)) : null,
            ipptPassPct: passPct(r => r.insight.ippt),
            atRisk: subset.filter(r => isAtRisk(r.insight.flags)).length,
        }
        const prev = {
            dailyActivePct: mean(dailyActivePct(subset, prevDates)),
            adherencePct: pct(sum(r => r.prev.onTarget), sum(r => r.prev.targetDays)),
            proteinHitPct: pct(sum(r => r.prev.proteinHit), sum(r => r.prev.proteinDays)),
            avgSleepH: (() => { const m = mean(sleepAll('prev')); return m == null ? null : r1(m / 60) })(),
            trainingMinWk: subset.length ? Math.round(sum(r => r.prev.trainingMin) / subset.length / (days / 7)) : null,
            ipptPassPct: passPct(r => r.prevIppt),
            atRisk: subset.filter(r => isAtRisk(r.prevFlags)).length,
        }
        return { cur, prev }
    }

    const all = aggregate(rows)
    const roundOrNull = (n: number | null) => (n == null ? null : Math.round(n))
    const kpi = (k: keyof typeof all.cur, round = false): Kpi => ({
        value: round ? roundOrNull(all.cur[k]) : all.cur[k],
        prev: round ? roundOrNull(all.prev[k]) : all.prev[k],
    })

    // ── Daily trend (whole OCS)
    const activeSeries = dailyActivePct(rows, dates)
    const daily = dates.map((d, i) => {
        const nightMins = rows.flatMap(r => logs.get(r.insight.id)!.sleeps.filter(s => s.night_date === d).map(s => s.duration_min))
        const trainingMin = rows.reduce((a, r) => a + logs.get(r.insight.id)!.workouts.filter(w => sgDate(w.logged_at) === d).reduce((x, w) => x + (w.duration_min ?? 0), 0), 0)
        const m = mean(nightMins)
        return {
            date: d, activePct: activeSeries[i], avgSleepH: m == null ? null : r1(m / 60),
            trainingMin: rows.length ? Math.round(trainingMin / rows.length) : 0, // minutes per cadet that day
        }
    })

    // ── Per wing
    const byWing = new Map<string, Row[]>()
    for (const r of rows) { const w = r.insight.wing; if (!byWing.has(w)) byWing.set(w, []); byWing.get(w)!.push(r) }
    const dailyByWing: Record<string, number[]> = {}
    const wings: WingInsight[] = [...byWing.entries()].map(([wing, subset]) => {
        const a = aggregate(subset)
        dailyByWing[wing] = dailyActivePct(subset, dates)
        const tiers: Record<IpptTier, number> = { gold: 0, silver: 0, pass: 0, fail: 0, none: 0 }
        for (const r of subset) tiers[r.insight.ippt?.tier ?? 'none']++
        return {
            wing, cadets: subset.length,
            activePct: roundOrNull(a.cur.dailyActivePct), prevActivePct: roundOrNull(a.prev.dailyActivePct),
            adherencePct: a.cur.adherencePct, proteinHitPct: a.cur.proteinHitPct,
            avgSleepH: a.cur.avgSleepH, trainingMinWk: a.cur.trainingMinWk, ipptPassPct: a.cur.ipptPassPct,
            atRisk: a.cur.atRisk, atRiskPct: Math.round((a.cur.atRisk / subset.length) * 100),
            tiers,
            upcomingIppt: subset.filter(r => r.insight.daysToIppt != null && r.insight.daysToIppt >= 0 && r.insight.daysToIppt <= THRESHOLDS.ipptHorizonDays).length,
        }
    }).sort((a, b) => a.wing.localeCompare(b.wing))

    // ── Risk drivers: how many cadets carry each flag (at any severity)
    const riskDrivers = (Object.keys(FLAG_LABEL) as FlagKey[])
        .map(key => ({ key, label: FLAG_LABEL[key], count: rows.filter(r => r.insight.flags.some(f => f.key === key)).length }))
        .sort((a, b) => b.count - a.count)

    // ── Sleep distribution (cadets with ≥ minSamples nights)
    const buckets = [
        { label: '<5h', min: 0, max: 5 }, { label: '5–6h', min: 5, max: 6 }, { label: '6–7h', min: 6, max: 7 },
        { label: '7–8h', min: 7, max: 8 }, { label: '8h+', min: 8, max: 99 },
    ]
    const sleepers = rows.map(r => r.insight).filter(c => c.avgSleepH != null && c.sleepNights >= THRESHOLDS.minSamples)
    const sleepBuckets = buckets.map(b => ({
        label: b.label, below6: b.max <= 6,
        count: sleepers.filter(c => c.avgSleepH! >= b.min && c.avgSleepH! < b.max).length,
    }))

    // ── IPPT horizon
    const upcoming = (n: number) => rows.filter(r => r.insight.daysToIppt != null && r.insight.daysToIppt >= 0 && r.insight.daysToIppt <= n)
    const ipptUpcoming = {
        within14: upcoming(14).length,
        within30: upcoming(30).length,
        notReady30: upcoming(30).filter(r => !r.insight.ippt || r.insight.ippt.tier === 'fail').length,
    }

    const cadetInsights = rows.map(r => r.insight).sort((a, b) => b.riskScore - a.riskScore || a.full_name.localeCompare(b.full_name))

    const result: CommandAnalytics = {
        windowDays: days,
        generatedAt: new Date().toISOString(),
        dates,
        totals: { cadets: cadets.length, wings: wings.length },
        kpis: {
            dailyActivePct: kpi('dailyActivePct', true),
            adherencePct: kpi('adherencePct'),
            proteinHitPct: kpi('proteinHitPct'),
            avgSleepH: kpi('avgSleepH'),
            trainingMinWk: kpi('trainingMinWk'),
            ipptPassPct: kpi('ipptPassPct'),
            atRisk: kpi('atRisk'),
        },
        daily, dailyByWing, wings, riskDrivers, sleepBuckets, ipptUpcoming,
        cadets: cadetInsights,
        findings: [],
    }
    result.findings = buildFindings(result)
    return result
}

// ── Findings: the 3–6 sentences a commander should read first ────────────────
// Each is computed from the numbers above (never from an LLM) and links to the
// tab where the commander can act on it.
function buildFindings(a: CommandAnalytics): Finding[] {
    const out: Finding[] = []
    const T = THRESHOLDS
    const enc = encodeURIComponent

    // 1. Biggest drop in logging, by wing
    const drops = a.wings
        .filter(w => w.activePct != null && w.prevActivePct != null && w.cadets >= 3)
        .map(w => ({ w, delta: w.activePct! - w.prevActivePct! }))
        .sort((x, y) => x.delta - y.delta)
    if (drops[0] && drops[0].delta <= -10)
        out.push({
            severity: drops[0].delta <= -20 ? 'critical' : 'serious',
            title: `${drops[0].w.wing} logging fell ${Math.abs(drops[0].delta)} pts`,
            detail: `Daily logging rate is ${drops[0].w.activePct}%, down from ${drops[0].w.prevActivePct}% in the previous ${a.windowDays} days.`,
            href: `/dashboard/admin/wings?wing=${enc(drops[0].w.wing)}`,
        })

    // 2. IPPT readiness
    if (a.ipptUpcoming.notReady30 > 0)
        out.push({
            severity: 'critical',
            title: `${a.ipptUpcoming.notReady30} cadet${a.ipptUpcoming.notReady30 === 1 ? '' : 's'} not IPPT-ready`,
            detail: `IPPT within ${T.ipptHorizonDays} days and their latest result is a fail or missing.`,
            href: '/dashboard/admin/watchlist?flag=ippt_risk',
        })

    // 3. Sleep — where it's worst
    const shortSleepers = a.cadets.filter(c => c.flags.some(f => f.key === 'low_sleep'))
    if (shortSleepers.length) {
        const worst = topWing(shortSleepers)
        out.push({
            severity: 'serious',
            title: `${shortSleepers.length} cadets averaging under ${T.lowSleepH}h sleep`,
            detail: worst ? `${worst.count} of them are in ${worst.wing}.` : 'Spread across wings.',
            href: '/dashboard/admin/watchlist?flag=low_sleep',
        })
    }

    // 4. Under-fuelling
    const underFuel = a.cadets.filter(c => c.flags.some(f => f.key === 'under_fuelling'))
    if (underFuel.length)
        out.push({
            severity: 'serious',
            title: `${underFuel.length} cadets under-fuelling`,
            detail: `Eating below ${Math.round(T.underFuelPct * 100)}% of their calorie target on logged days — a performance and injury risk during training.`,
            href: '/dashboard/admin/watchlist?flag=under_fuelling',
        })

    // 5. Gone quiet
    const quiet = a.cadets.filter(c => c.flags.some(f => f.key === 'inactive' && f.severity === 'critical'))
    if (quiet.length)
        out.push({
            severity: 'warning',
            title: `${quiet.length} cadets haven't logged in ${T.inactiveCritical}+ days`,
            detail: 'Their data on every other chart is stale — consider a nudge through their instructors.',
            href: '/dashboard/admin/watchlist?flag=inactive',
        })

    // 6. Something going right: best-improving wing
    const best = drops[drops.length - 1]
    if (best && best.delta >= 10)
        out.push({
            severity: 'good',
            title: `${best.w.wing} logging up ${best.delta} pts`,
            detail: `Now at ${best.w.activePct}% daily — worth asking what their instructors changed.`,
            href: `/dashboard/admin/wings?wing=${enc(best.w.wing)}`,
        })

    return out.slice(0, 6)
}

function topWing(cs: CadetInsight[]) {
    const counts: Record<string, number> = {}
    for (const c of cs) counts[c.wing] = (counts[c.wing] ?? 0) + 1
    const [wing, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? []
    return wing ? { wing, count } : null
}
