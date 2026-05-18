'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { calculateTDEE } from '@/lib/tdee'
import { LogMealDialog } from '@/components/nutrition/log-meal-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
    PlusIcon, MoonIcon, DumbbellIcon, ChevronRightIcon, FlameIcon,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type MealLog = {
    id: string
    meal_type: MealType
    quantity_g: number
    logged_at: string
    food_items: {
        name: string
        calories_per_100g: number
        protein_g: number
        carbs_g: number
        fat_g: number
    } | null
}

type UserProfile = {
    full_name: string | null
    rank: string | null
    wing: string | null
    gender: string
    weight_kg: number
    height_cm: number
    date_of_birth: string
    activity_level: string
    goal_mode: string
    ippt_date: string | null
}

type LeaderboardEntry = {
    id: string
    full_name: string
    rank: string
    score: number
    position: number
}

type SleepSummary = {
    night_date: string
    duration_min: number
    sleep_score: number | null
    ans_charge_status: number | null
}

type WorkoutEntry = {
    id: string
    name: string
    duration_min: number | null
    calories: number | null
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function calcMacros(log: MealLog) {
    if (!log.food_items) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const f = log.quantity_g / 100
    const fi = log.food_items
    return {
        calories: Math.round(fi.calories_per_100g * f),
        protein:  Math.round(fi.protein_g * f * 10) / 10,
        carbs:    Math.round(fi.carbs_g   * f * 10) / 10,
        fat:      Math.round(fi.fat_g     * f * 10) / 10,
    }
}

function durationLabel(min: number): string {
    const h = Math.floor(min / 60)
    const m = min % 60
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function todayStr(): string {
    return new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_LABELS: Record<MealType, string> = {
    breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
}

// Derive macro gram targets from calorie target + protein target
function deriveMacroTargets(calTarget: number, proteinTarget: number) {
    const proteinCals = proteinTarget * 4
    const remaining = Math.max(0, calTarget - proteinCals)
    return {
        carbs: Math.round(remaining * 0.55 / 4),
        fat:   Math.round(remaining * 0.30 / 9),
    }
}

// Contextual nutrition tip based on remaining calories
function nutritionTip(calLeft: number, proteinLeft: number): string {
    const hour = new Date().getHours()
    const meal = hour < 11 ? 'breakfast' : hour < 15 ? 'lunch' : 'dinner'
    if (calLeft <= -200) return `You're ${Math.abs(calLeft)} kcal over target — keep tomorrow lighter.`
    if (calLeft <= 100)  return `You're right on target. Great discipline today.`
    if (calLeft <= 500)  return `A light snack (~${calLeft} kcal) will get you to goal.`
    const protHint = proteinLeft > 15 ? ` with ${Math.round(proteinLeft)}g+ protein` : ''
    return `Aim for a ~${calLeft} kcal ${meal}${protHint} to hit today's target.`
}

// ── Count-up animation ─────────────────────────────────────────────────────────
// Animates a number from 0 to `target` with an ease-out cubic curve.
// `ready` is the trigger — the animation fires once when it first becomes true.
function useCountUp(target: number, ready: boolean, duration = 900): number {
    const [display, setDisplay] = useState(0)
    const rafRef    = useRef<number>(0)
    const hasRun    = useRef(false)
    const targetRef = useRef(target)
    targetRef.current = target

    useEffect(() => {
        if (!ready || hasRun.current) return
        hasRun.current = true
        const final     = targetRef.current
        const startTime = performance.now()
        const animate   = (now: number) => {
            const p     = Math.min((now - startTime) / duration, 1)
            const eased = 1 - (1 - p) ** 3          // ease-out cubic
            setDisplay(Math.round(final * eased))
            if (p < 1) rafRef.current = requestAnimationFrame(animate)
        }
        rafRef.current = requestAnimationFrame(animate)
        return () => cancelAnimationFrame(rafRef.current)
    }, [ready, duration])

    return display
}

// ── Calorie donut ring ─────────────────────────────────────────────────────────

function CalorieRing({ consumed, target }: { consumed: number; target: number }) {
    const r = 46
    const circumference = 2 * Math.PI * r
    const pct = Math.min(1, target > 0 ? consumed / target : 0)
    const offset = circumference * (1 - pct)

    return (
        <div className="relative flex items-center justify-center shrink-0">
            <svg width={116} height={116} viewBox="0 0 116 116" className="-rotate-90">
                <circle cx={58} cy={58} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={9} />
                <circle
                    cx={58} cy={58} r={r} fill="none"
                    stroke="var(--color-primary)" strokeWidth={9}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: 'stroke-dashoffset 0.7s ease' }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-[20px] font-bold tracking-tight text-foreground tabular-nums leading-none">
                    {consumed.toLocaleString()}
                </span>
                <span className="text-[9px] text-muted-foreground mt-0.5 uppercase tracking-wide">
                    of {target.toLocaleString()} kcal
                </span>
            </div>
        </div>
    )
}

// ── Macro progress bar ─────────────────────────────────────────────────────────

function MacroBar({ label, consumed, target, colorClass }: {
    label: string; consumed: number; target: number; colorClass: string
}) {
    const pct = Math.min(100, target > 0 ? (consumed / target) * 100 : 0)
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between">
                <span className="text-[12px] font-medium text-foreground">{label}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                    {consumed} / {target}g
                </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                    className={cn('h-full rounded-full transition-all duration-500', colorClass)}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    )
}

// ── Wing rank card ─────────────────────────────────────────────────────────────

function WingRankCard({
    userId, wing, leaderboard, loading,
}: {
    userId: string
    wing: string | null
    leaderboard: LeaderboardEntry[]
    loading: boolean
}) {
    const me = leaderboard.find(e => e.id === userId)
    const next = me ? leaderboard.find(e => e.position === me.position - 1) : null
    const top5 = leaderboard.slice(0, 5)

    return (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {/* Rank header */}
            <div className="px-5 pt-5 pb-4 flex items-start gap-4 border-b border-border">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <span className="text-[18px] font-extrabold text-white">
                        {wing ? wing[0].toUpperCase() : '?'}
                    </span>
                </div>
                <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Wing Rank{wing ? ` · ${wing}` : ''}
                    </div>
                    {loading ? (
                        <Skeleton className="h-8 w-16 mt-1" />
                    ) : me ? (
                        <>
                            <div className="text-[28px] font-extrabold font-display text-foreground leading-none mt-0.5">
                                #{me.position}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5">
                                {next
                                    ? `${next.score - me.score} pts behind ${next.full_name.split(' ')[0]}`
                                    : 'Leading the wing!'}
                            </p>
                        </>
                    ) : (
                        <div className="text-[13px] text-muted-foreground mt-1">No data yet</div>
                    )}
                </div>
            </div>

            {/* Mini leaderboard */}
            <div className="divide-y divide-border">
                {loading ? (
                    [0, 1, 2, 3].map(i => (
                        <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                            <Skeleton className="h-4 w-6" />
                            <Skeleton className="h-4 flex-1" />
                            <Skeleton className="h-4 w-10" />
                        </div>
                    ))
                ) : top5.length === 0 ? (
                    <div className="px-5 py-4 text-[12px] text-muted-foreground">No leaderboard data</div>
                ) : (
                    top5.map(entry => {
                        const isMe = entry.id === userId
                        return (
                            <div
                                key={entry.id}
                                className={cn(
                                    'flex items-center gap-2.5 py-2.5',
                                    isMe
                                        ? 'bg-primary/10 pl-4 pr-5 border-l-2 border-primary'
                                        : 'px-5'
                                )}
                            >
                                <span className={cn(
                                    'text-[11px] font-semibold w-5 text-center shrink-0',
                                    isMe ? 'text-primary' : 'text-muted-foreground'
                                )}>
                                    #{entry.position}
                                </span>
                                <span className={cn(
                                    'text-[13px] flex-1 truncate',
                                    isMe ? 'font-semibold text-foreground' : 'text-foreground'
                                )}>
                                    {entry.full_name}
                                </span>
                                <span className={cn(
                                    'text-[12px] tabular-nums shrink-0',
                                    isMe ? 'font-semibold text-primary' : 'text-muted-foreground'
                                )}>
                                    {entry.score}
                                </span>
                            </div>
                        )
                    })
                )}
            </div>

            {/* Link to full leaderboard */}
            <a
                href="/dashboard/friends"
                className="flex items-center justify-between px-5 py-3 text-[12px] font-semibold text-primary hover:bg-muted/30 transition-colors border-t border-border"
            >
                <span>Full wing standings</span>
                <ChevronRightIcon className="w-3.5 h-3.5" />
            </a>
        </div>
    )
}

// ── Activity snapshot card ─────────────────────────────────────────────────────

function ActivityCard({
    sleep, workouts, workoutsLoading, sleepLoading,
}: {
    sleep: SleepSummary | null
    workouts: WorkoutEntry[]
    workoutsLoading: boolean
    sleepLoading: boolean
}) {
    const totalWorkoutMin = workouts.reduce((s, w) => s + (w.duration_min ?? 0), 0)
    const totalWorkoutCal = workouts.reduce((s, w) => s + (w.calories ?? 0), 0)

    return (
        <div className="bg-card border border-border rounded-2xl divide-y divide-border">
            {/* Sleep row */}
            <div className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-sleep-deep)]/10 flex items-center justify-center shrink-0">
                    <MoonIcon className="w-4 h-4 text-[var(--color-sleep-deep)]" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Last night</div>
                    {sleepLoading ? (
                        <Skeleton className="h-4 w-24 mt-1" />
                    ) : sleep ? (
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-[15px] font-bold text-foreground">{durationLabel(sleep.duration_min)}</span>
                            {sleep.sleep_score != null && (
                                <span className="text-[11px] text-muted-foreground">Score {sleep.sleep_score}</span>
                            )}
                        </div>
                    ) : (
                        <span className="text-[12px] text-muted-foreground mt-0.5 block">No sleep logged</span>
                    )}
                </div>
                <a href="/dashboard/sleep" className="text-[11px] text-primary font-semibold hover:underline shrink-0">
                    View
                </a>
            </div>

            {/* Workouts row */}
            <div className="px-5 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-warning-light flex items-center justify-center shrink-0">
                    <DumbbellIcon className="w-4 h-4 text-warning-dark" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Today's training</div>
                    {workoutsLoading ? (
                        <Skeleton className="h-4 w-24 mt-1" />
                    ) : workouts.length > 0 ? (
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="text-[15px] font-bold text-foreground">
                                {workouts.length} session{workouts.length !== 1 ? 's' : ''}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                                {totalWorkoutMin > 0 && `${durationLabel(totalWorkoutMin)}`}
                                {totalWorkoutCal > 0 && ` · ${totalWorkoutCal} kcal`}
                            </span>
                        </div>
                    ) : (
                        <span className="text-[12px] text-muted-foreground mt-0.5 block">No sessions logged yet</span>
                    )}
                </div>
                <a href="/dashboard/workouts" className="text-[11px] text-primary font-semibold hover:underline shrink-0">
                    View
                </a>
            </div>
        </div>
    )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DashboardPage() {
    const { user } = useAuth()
    const [logMealOpen, setLogMealOpen] = useState(false)

    const [profile, setProfile]               = useState<UserProfile | null>(null)
    const [meals, setMeals]                   = useState<MealLog[]>([])
    const [leaderboard, setLeaderboard]       = useState<LeaderboardEntry[]>([])
    const [sleep, setSleep]                   = useState<SleepSummary | null>(null)
    const [workouts, setWorkouts]             = useState<WorkoutEntry[]>([])

    const [profileLoading, setProfileLoading] = useState(true)
    const [mealsLoading, setMealsLoading]     = useState(true)
    const [lbLoading, setLbLoading]           = useState(true)
    const [sleepLoading, setSleepLoading]     = useState(true)
    const [workoutsLoading, setWorkoutsLoading] = useState(true)

    // Fetch user profile
    useEffect(() => {
        if (!user) return
        supabase
            .from('users')
            .select('full_name, rank, wing, gender, weight_kg, height_cm, date_of_birth, activity_level, goal_mode, ippt_date')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                setProfile(data as UserProfile)
                setProfileLoading(false)
            })
    }, [user])

    // Fetch today's meals
    const fetchMeals = useCallback(async () => {
        if (!user) return
        const day = todayStr()
        const start = new Date(day); start.setHours(0, 0, 0, 0)
        const end   = new Date(day); end.setHours(23, 59, 59, 999)
        const { data } = await supabase
            .from('meal_logs')
            .select('id, meal_type, quantity_g, logged_at, food_items(name, calories_per_100g, protein_g, carbs_g, fat_g)')
            .eq('user_id', user.id)
            .gte('logged_at', start.toISOString())
            .lte('logged_at', end.toISOString())
            .order('logged_at', { ascending: true })
        setMeals((data as unknown as MealLog[]) ?? [])
        setMealsLoading(false)
    }, [user])

    useEffect(() => { fetchMeals() }, [fetchMeals])

    // Fetch wing leaderboard once profile (with wing) is loaded
    useEffect(() => {
        if (!user || !profile?.wing) { setLbLoading(false); return }
        fetch(`/api/leaderboard?scope=wing&wing=${encodeURIComponent(profile.wing)}&userId=${user.id}&period=week`)
            .then(r => r.json())
            .then((data: LeaderboardEntry[]) => { setLeaderboard(Array.isArray(data) ? data : []) })
            .finally(() => setLbLoading(false))
    }, [user, profile?.wing])

    // Fetch last night's sleep
    useEffect(() => {
        if (!user) return
        supabase
            .from('sleep_logs')
            .select('night_date, duration_min, sleep_score, ans_charge_status')
            .eq('user_id', user.id)
            .order('night_date', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data }) => { setSleep(data as SleepSummary | null) })
            .then(() => setSleepLoading(false), () => setSleepLoading(false))
    }, [user])

    // Fetch today's workouts
    useEffect(() => {
        if (!user) return
        const day = todayStr()
        const start = new Date(day); start.setHours(0, 0, 0, 0)
        const end   = new Date(day); end.setHours(23, 59, 59, 999)
        supabase
            .from('workout_logs')
            .select('id, name, duration_min, calories')
            .eq('user_id', user.id)
            .gte('logged_at', start.toISOString())
            .lte('logged_at', end.toISOString())
            .then(({ data }) => { setWorkouts((data as WorkoutEntry[]) ?? []) })
            .then(() => setWorkoutsLoading(false), () => setWorkoutsLoading(false))
    }, [user])

    // Compute targets + totals
    const targets = profile
        ? calculateTDEE({
              gender:         profile.gender as 'Male' | 'Female',
              weight_kg:      profile.weight_kg,
              height_cm:      profile.height_cm,
              date_of_birth:  profile.date_of_birth,
              activity_level: profile.activity_level as Parameters<typeof calculateTDEE>[0]['activity_level'],
              goal_mode:      profile.goal_mode as Parameters<typeof calculateTDEE>[0]['goal_mode'],
          })
        : { calories: 2400, protein: 160 }

    const macroTargets = deriveMacroTargets(targets.calories, targets.protein)

    const totals = meals.reduce(
        (acc, log) => {
            const m = calcMacros(log)
            return {
                calories: acc.calories + m.calories,
                protein:  Math.round((acc.protein + m.protein) * 10) / 10,
                carbs:    Math.round((acc.carbs   + m.carbs)   * 10) / 10,
                fat:      Math.round((acc.fat     + m.fat)     * 10) / 10,
            }
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    const calLeft     = targets.calories - totals.calories
    const proteinLeft = targets.protein  - totals.protein

    // Animated headline numbers — count up once data is ready
    const statsReady      = !mealsLoading && !profileLoading
    const calDisplayed    = useCountUp(calLeft > 0 ? calLeft : 0, statsReady)
    const proteinDisplayed = useCountUp(proteinLeft > 0 ? Math.round(proteinLeft) : 0, statsReady)

    // IPPT countdown
    const ipptDaysLeft = profile?.ippt_date
        ? Math.ceil((new Date(profile.ippt_date).getTime() - Date.now()) / 86_400_000)
        : null

    // Hero text
    const firstName   = profile?.full_name?.split(' ')[0] ?? user?.user_metadata?.full_name?.split(' ')[0] ?? 'Soldier'
    const dateLabel   = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }).toUpperCase()
    const hour        = new Date().getHours()
    const greeting    = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

    // Wing rank coaching hint
    const me   = leaderboard.find(e => e.id === user?.id)
    const next = me ? leaderboard.find(e => e.position === me.position - 1) : null
    const wingHint = me
        ? next
            ? `You're #${me.position} in ${profile?.wing ?? 'your wing'} — ${next.full_name.split(' ')[0]} is ${next.score - me.score} pts ahead.`
            : `You're leading ${profile?.wing ?? 'your wing'}! Keep it up.`
        : null

    // Group meals by type
    const mealsByType = meals.reduce<Record<MealType, MealLog[]>>((acc, log) => {
        if (!acc[log.meal_type]) acc[log.meal_type] = []
        acc[log.meal_type].push(log)
        return acc
    }, {} as Record<MealType, MealLog[]>)

    return (
        <div className="px-4 sm:px-6 lg:px-10 pt-8 pb-12 max-w-5xl mx-auto space-y-6">

            {/* ── Hero ─────────────────────────────────────────────────────── */}
            <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    {greeting}, {firstName} · Daily Brief — {dateLabel}
                </p>
                {mealsLoading || profileLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-3/4" />
                        <Skeleton className="h-10 w-1/2" />
                    </div>
                ) : (
                    <h1 className="font-display text-[32px] sm:text-[38px] font-extrabold text-foreground leading-[1.1]">
                        You have{' '}
                        <span className="text-primary tabular-nums">{calDisplayed.toLocaleString()} kcal</span>
                        {' '}and{' '}
                        <span className="text-success tabular-nums">{proteinDisplayed}g protein</span>
                        {' '}left today.
                    </h1>
                )}
                <div className="mt-3 space-y-0.5">
                    {mealsLoading || profileLoading ? (
                        <Skeleton className="h-4 w-80 mt-3" />
                    ) : (
                        <p className="text-[14px] text-muted-foreground">{nutritionTip(calLeft, proteinLeft)}</p>
                    )}
                    {!lbLoading && wingHint && (
                        <p className="text-[14px] text-muted-foreground">{wingHint}</p>
                    )}
                </div>
            </div>

            {/* ── Main content grid ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 items-start">

                {/* Left column */}
                <div className="space-y-4">

                    {/* Macro card */}
                    <div className="bg-card border border-border rounded-2xl p-5">
                        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                            Today's intake
                        </div>
                        <div className="flex items-center gap-6">
                            <CalorieRing consumed={totals.calories} target={targets.calories} />
                            <div className="flex-1 space-y-4 min-w-0">
                                <MacroBar
                                    label="Protein"
                                    consumed={totals.protein}
                                    target={targets.protein}
                                    colorClass="bg-success-dark"
                                />
                                <MacroBar
                                    label="Carbs"
                                    consumed={totals.carbs}
                                    target={macroTargets.carbs}
                                    colorClass="bg-primary"
                                />
                                <MacroBar
                                    label="Fat"
                                    consumed={totals.fat}
                                    target={macroTargets.fat}
                                    colorClass="bg-warning"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Meals card */}
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        {/* Header */}
                        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
                            <div>
                                <h2 className="text-[14px] font-semibold text-foreground">Today's logged meals</h2>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    {totals.calories > 0
                                        ? `${totals.calories.toLocaleString()} kcal logged so far`
                                        : 'Nothing logged yet'}
                                </p>
                            </div>
                            <button
                                onClick={() => setLogMealOpen(true)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-primary text-primary px-4 py-1.5 text-[12px] font-semibold hover:bg-primary/5 transition-colors"
                            >
                                <PlusIcon className="w-3.5 h-3.5" />
                                Log a meal
                            </button>
                        </div>

                        {/* Meal rows */}
                        {mealsLoading ? (
                            <div className="px-5 py-4 space-y-3">
                                {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
                            </div>
                        ) : meals.length === 0 ? (
                            <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
                                <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center">
                                    <FlameIcon className="w-4 h-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <div className="text-[13px] font-semibold text-foreground">No meals logged today</div>
                                    <p className="text-[12px] text-muted-foreground mt-0.5">Start tracking to see your daily intake.</p>
                                </div>
                                <button
                                    onClick={() => setLogMealOpen(true)}
                                    className="rounded-full bg-primary px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-primary/90 transition-colors"
                                >
                                    Log your first meal
                                </button>
                            </div>
                        ) : (
                            MEAL_ORDER
                                .filter(type => mealsByType[type]?.length)
                                .map(type => {
                                    const typeMeals = mealsByType[type]
                                    const typeTotal = typeMeals.reduce((s, l) => s + calcMacros(l).calories, 0)
                                    return (
                                        <div key={type} className="border-b border-border last:border-0">
                                            <div className="px-5 pt-3 pb-0.5 flex items-center justify-between">
                                                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                                    {MEAL_LABELS[type]}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {fmtTime(typeMeals[0].logged_at)}
                                                </span>
                                            </div>
                                            {typeMeals.map(log => {
                                                const m = calcMacros(log)
                                                return (
                                                    <div key={log.id} className="px-5 py-2.5 flex items-center justify-between gap-3">
                                                        <span className="text-[13px] font-medium text-foreground truncate">
                                                            {log.food_items?.name ?? 'Unknown item'}
                                                        </span>
                                                        <span className="text-[13px] font-semibold text-foreground tabular-nums shrink-0">
                                                            {m.calories.toLocaleString()} kcal
                                                        </span>
                                                    </div>
                                                )
                                            })}
                                            {typeMeals.length > 1 && (
                                                <div className="px-5 pb-3 text-right">
                                                    <span className="text-[11px] text-muted-foreground">{typeTotal} kcal total</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })
                        )}

                        {/* Footer: link to full nutrition page */}
                        {meals.length > 0 && (
                            <a
                                href="/dashboard/nutrition"
                                className="flex items-center justify-between px-5 py-3 text-[12px] font-semibold text-primary hover:bg-muted/30 transition-colors border-t border-border"
                            >
                                <span>Full nutrition breakdown</span>
                                <ChevronRightIcon className="w-3.5 h-3.5" />
                            </a>
                        )}
                    </div>
                </div>

                {/* Right column */}
                <div className="space-y-4">
                    <WingRankCard
                        userId={user?.id ?? ''}
                        wing={profile?.wing ?? null}
                        leaderboard={leaderboard}
                        loading={lbLoading || profileLoading}
                    />
                    <ActivityCard
                        sleep={sleep}
                        workouts={workouts}
                        sleepLoading={sleepLoading}
                        workoutsLoading={workoutsLoading}
                    />

                    {/* IPPT countdown */}
                    {!profileLoading && ipptDaysLeft !== null && ipptDaysLeft >= 0 && (
                        <div
                            className="rounded-2xl p-5 flex items-center gap-4"
                            style={{
                                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                            }}
                        >
                            <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-white/70">IPPT Countdown</div>
                                <div className="font-display text-[22px] font-extrabold text-white leading-tight mt-0.5">
                                    {ipptDaysLeft === 0 ? 'Today!' : `${ipptDaysLeft} day${ipptDaysLeft !== 1 ? 's' : ''}`}
                                </div>
                                <div className="text-[11px] text-white/60 mt-0.5">
                                    {ipptDaysLeft === 0 ? "Good luck — you've got this" :
                                     ipptDaysLeft <= 7 ? 'Final week — dial in nutrition' :
                                     ipptDaysLeft <= 30 ? 'Last stretch — stay consistent' :
                                     'Keep training consistent'}
                                </div>
                            </div>
                            <div className="font-display font-extrabold text-white/20 text-[36px] shrink-0 tabular-nums">
                                {ipptDaysLeft === 0 ? '!' : ipptDaysLeft > 99 ? ipptDaysLeft : ipptDaysLeft}
                            </div>
                        </div>
                    )}

                    {/* Prompt to set IPPT date if not set */}
                    {!profileLoading && ipptDaysLeft === null && (
                        <a
                            href="/dashboard/settings#goal"
                            className="flex items-center gap-3 bg-card border border-dashed border-border rounded-2xl p-4 hover:border-primary/40 hover:bg-muted/20 transition-colors group"
                        >
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-semibold text-foreground">Set your IPPT date</div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">Enable the countdown timer</div>
                            </div>
                            <ChevronRightIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </a>
                    )}
                </div>
            </div>

            <LogMealDialog open={logMealOpen} onOpenChange={open => { setLogMealOpen(open); if (!open) fetchMeals() }} />
        </div>
    )
}
