'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { calculateTDEE } from '@/lib/tdee'
import { LogMealDialog, type DailyTotals, type UserTargets } from '@/components/nutrition/log-meal-dialog'
import { Button } from '@/components/ui/button'
import { cn, fmt } from '@/lib/utils'

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

type MealLog = {
    id: string
    meal_type: MealType
    quantity_g: number
    logged_at: string
    notes: string | null
    food_items: {
        id: string
        name: string
        calories_per_100g: number
        protein_g: number
        carbs_g: number
        fat_g: number
    } | null
}

type UserProfile = {
    gender: string
    weight_kg: number
    height_cm: number
    date_of_birth: string
    activity_level: string
    goal_mode: string
}

function calcMacros(log: MealLog) {
    if (!log.food_items) return { calories: 0, protein: 0, carbs: 0, fat: 0 }
    const f = log.quantity_g / 100
    const fi = log.food_items
    return {
        calories: Math.round(fi.calories_per_100g * f),
        protein: parseFloat((fi.protein_g * f).toFixed(1)),
        carbs:   parseFloat((fi.carbs_g   * f).toFixed(1)),
        fat:     parseFloat((fi.fat_g     * f).toFixed(1)),
    }
}

const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
const MEAL_LABELS: Record<MealType, string> = {
    breakfast: 'Breakfast',
    lunch:     'Lunch',
    dinner:    'Dinner',
    snack:     'Snack',
}
const MEAL_ICONS: Record<MealType, React.ReactNode> = {
    breakfast: <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    lunch:     <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    dinner:    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>,
    snack:     <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
}

function ProgressBar({
    value,
    max,
    colorClass = 'bg-primary',
    animated = true,
}: {
    value: number
    max: number
    colorClass?: string
    animated?: boolean
}) {
    const [width, setWidth] = useState(0)
    const target = max > 0 ? Math.min(100, (value / max) * 100) : 0

    useEffect(() => {
        const t = setTimeout(() => setWidth(target), 80)
        return () => clearTimeout(t)
    }, [target])

    return (
        <div className="h-2 bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
            <div
                className={cn('h-full rounded-full', colorClass, animated && 'transition-all duration-700 ease-out')}
                style={{ width: `${width}%` }}
            />
        </div>
    )
}

const FALLBACK_TARGETS: UserTargets = { calories: 2400, protein: 160 }

export default function NutritionPage() {
    const { user } = useAuth()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [meals, setMeals] = useState<MealLog[]>([])
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    const todayStr = new Date().toLocaleDateString('en-CA')

    const fetchMeals = useCallback(async () => {
        if (!user) return
        const startOfDay = new Date(todayStr)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(todayStr)
        endOfDay.setHours(23, 59, 59, 999)

        const { data } = await supabase
            .from('meal_logs')
            .select('id, meal_type, quantity_g, logged_at, notes, food_items (id, name, calories_per_100g, protein_g, carbs_g, fat_g)')
            .eq('user_id', user.id)
            .gte('logged_at', startOfDay.toISOString())
            .lte('logged_at', endOfDay.toISOString())
            .order('logged_at', { ascending: true })

        setMeals((data as unknown as MealLog[]) ?? [])
        setLoading(false)
    }, [user, todayStr])

    useEffect(() => {
        if (!user) return
        supabase
            .from('users')
            .select('gender, weight_kg, height_cm, date_of_birth, activity_level, goal_mode')
            .eq('id', user.id)
            .single()
            .then(({ data }) => { if (data) setProfile(data) })
        fetchMeals()
    }, [user, fetchMeals])

    const targets: UserTargets = profile
        ? calculateTDEE({
              gender:         profile.gender as 'Male' | 'Female',
              weight_kg:      profile.weight_kg,
              height_cm:      profile.height_cm,
              date_of_birth:  profile.date_of_birth,
              activity_level: profile.activity_level as Parameters<typeof calculateTDEE>[0]['activity_level'],
              goal_mode:      profile.goal_mode as Parameters<typeof calculateTDEE>[0]['goal_mode'],
          })
        : FALLBACK_TARGETS

    const totals: DailyTotals = meals.reduce(
        (acc, log) => {
            const m = calcMacros(log)
            return {
                calories: acc.calories + m.calories,
                protein:  parseFloat((acc.protein + m.protein).toFixed(1)),
                carbs:    parseFloat((acc.carbs   + m.carbs).toFixed(1)),
                fat:      parseFloat((acc.fat     + m.fat).toFixed(1)),
            }
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )

    const calPct  = Math.min(100, Math.round((totals.calories / targets.calories) * 100))
    const protPct = Math.min(100, Math.round((totals.protein  / targets.protein)  * 100))

    const mealsByType = MEAL_ORDER.map(type => ({
        type,
        logs: meals.filter(m => m.meal_type === type),
    })).filter(g => g.logs.length > 0)

    return (
        <div className="min-h-screen px-4 sm:px-8 pt-8 pb-12">
            <div className="w-full max-w-2xl mx-auto space-y-7">

                {/* ── Header ── */}
                <div className="flex items-start justify-between animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <div>
                        <h1 className="font-display text-3xl font-extrabold text-foreground mb-0.5">Nutrition</h1>
                        <p className="text-sm text-muted-foreground">
                            {new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })}
                        </p>
                    </div>
                    <Button onClick={() => setDialogOpen(true)} className="shrink-0 mt-1 shadow-sm">
                        Log meal
                    </Button>
                </div>

                {/* ── Daily progress card ── */}
                <div
                    className="rounded-2xl p-5 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300 delay-75"
                    style={{
                        background: 'linear-gradient(135deg, var(--color-primary) 0%, #0041a8 100%)',
                        boxShadow: '0 4px 24px rgba(0, 82, 204, 0.25)',
                    }}
                >
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-widest text-white/70">Today&rsquo;s progress</p>
                        <span className="text-xs font-semibold text-white/80 bg-white/10 px-2.5 py-1 rounded-full">
                            {calPct}% calories
                        </span>
                    </div>

                    {/* Calories */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm font-medium text-white/80">Calories</span>
                            <span className="text-sm font-semibold text-white">
                                {totals.calories.toLocaleString()}
                                <span className="text-white/60 font-normal"> / {targets.calories.toLocaleString()} kcal</span>
                            </span>
                        </div>
                        <ProgressBar value={totals.calories} max={targets.calories} colorClass="bg-white" />
                    </div>

                    {/* Protein */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-baseline">
                            <span className="text-sm font-medium text-white/80">Protein</span>
                            <span className="text-sm font-semibold text-white">
                                {fmt(totals.protein)}g
                                <span className="text-white/60 font-normal"> / {targets.protein}g</span>
                            </span>
                        </div>
                        <ProgressBar value={totals.protein} max={targets.protein} colorClass="bg-green-300" />
                    </div>

                    {/* Carbs + Fat */}
                    <div className="grid grid-cols-2 gap-4 pt-1 border-t border-white/15">
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-white/60">Carbs</span>
                                <span className="text-xs font-medium text-white/80">{fmt(totals.carbs)}g</span>
                            </div>
                            <ProgressBar value={totals.carbs} max={400} colorClass="bg-yellow-300" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-white/60">Fats</span>
                                <span className="text-xs font-medium text-white/80">{fmt(totals.fat)}g</span>
                            </div>
                            <ProgressBar value={totals.fat} max={80} colorClass="bg-orange-300" />
                        </div>
                    </div>

                    {/* Macro summary row */}
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/15">
                        {[
                            { label: 'Protein', value: `${fmt(totals.protein)}g`, pct: protPct },
                            { label: 'Carbs',   value: `${fmt(totals.carbs)}g`,   pct: null },
                            { label: 'Fats',    value: `${fmt(totals.fat)}g`,     pct: null },
                        ].map(({ label, value, pct }) => (
                            <div key={label} className="text-center">
                                <div className="text-base font-bold text-white">{value}</div>
                                <div className="text-[10px] text-white/50 uppercase tracking-wide">
                                    {label}{pct !== null ? ` · ${pct}%` : ''}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── Meal list ── */}
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                ) : mealsByType.length === 0 ? (
                    <div
                        className={cn(
                            'bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-3',
                            'animate-in fade-in slide-in-from-bottom-2 duration-400 delay-150'
                        )}
                        style={{ boxShadow: '0 1px 4px rgba(9,30,66,0.06)' }}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                            <svg className="w-7 h-7 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">No meals logged yet</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                                Tap &ldquo;Log meal&rdquo; to track your first entry today.
                            </p>
                        </div>
                        <Button variant="outline" size="sm" className="mt-1" onClick={() => setDialogOpen(true)}>
                            Log your first meal
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {mealsByType.map(({ type, logs }, groupIdx) => {
                            const groupTotal = logs.reduce(
                                (acc, l) => {
                                    const m = calcMacros(l)
                                    return { calories: acc.calories + m.calories, protein: parseFloat((acc.protein + m.protein).toFixed(1)) }
                                },
                                { calories: 0, protein: 0 }
                            )

                            return (
                                <div
                                    key={type}
                                    className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                                    style={{ animationDelay: `${150 + groupIdx * 60}ms`, animationFillMode: 'both' }}
                                >
                                    {/* Group header */}
                                    <div className="flex items-center gap-2 mb-2.5">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            {MEAL_ICONS[type]}
                                            <h3 className="text-xs font-bold uppercase tracking-widest">
                                                {MEAL_LABELS[type]}
                                            </h3>
                                        </div>
                                        <div className="flex-1 h-px bg-border" />
                                        <span className="text-xs text-muted-foreground">
                                            {groupTotal.calories} kcal · {fmt(groupTotal.protein)}g P
                                        </span>
                                    </div>

                                    {/* Meal items */}
                                    <div className="space-y-2">
                                        {logs.map((log, i) => {
                                            const m = calcMacros(log)
                                            return (
                                                <div
                                                    key={log.id}
                                                    className={cn(
                                                        'bg-card border border-border rounded-xl px-4 py-3.5',
                                                        'flex items-center justify-between gap-4',
                                                        'hover:border-primary/30 hover:shadow-sm transition-all duration-150',
                                                        'animate-in fade-in slide-in-from-left-2 duration-200'
                                                    )}
                                                    style={{ animationDelay: `${200 + groupIdx * 60 + i * 40}ms`, animationFillMode: 'both', boxShadow: '0 1px 3px rgba(9,30,66,0.05)' }}
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-medium text-foreground truncate">
                                                            {log.food_items?.name ?? '—'}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-2">
                                                            <span>{log.quantity_g}g</span>
                                                            <span className="text-border">·</span>
                                                            <span>{fmt(m.protein)}g P</span>
                                                            <span className="text-border">·</span>
                                                            <span>{fmt(m.carbs)}g C</span>
                                                            <span className="text-border">·</span>
                                                            <span>{fmt(m.fat)}g F</span>
                                                        </div>
                                                        {log.notes && (
                                                            <div className="text-[11px] text-muted-foreground/60 mt-0.5 italic truncate">
                                                                {log.notes}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-base font-bold text-foreground tabular-nums">
                                                            {m.calories}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground uppercase tracking-wide">kcal</div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            <LogMealDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                dailyTotals={totals}
                targets={targets}
                onLogged={fetchMeals}
            />
        </div>
    )
}
