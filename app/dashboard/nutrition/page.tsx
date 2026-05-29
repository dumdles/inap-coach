'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { calculateTDEE } from '@/lib/tdee'
import { LogMealDialog, type DailyTotals, type UserTargets } from '@/components/nutrition/log-meal-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
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

function MacroRow({ label, value, unit, pct, color }: { label: string; value: number; unit: string; pct?: number; color: string }) {
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-16 shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                {pct !== undefined && (
                    <div className={cn('h-full rounded-full', color)} style={{ width: `${Math.min(100, pct)}%` }} />
                )}
            </div>
            <span className="text-xs font-semibold text-foreground tabular-nums w-16 text-right">
                {value}{unit}
            </span>
        </div>
    )
}

function FoodItemDialog({ log, onClose, onDeleted, onEdited }: {
    log: MealLog | null
    onClose: () => void
    onDeleted: (id: string) => void
    onEdited: (id: string, qty: number, mealType: MealType) => void
}) {
    const [mode, setMode] = useState<'view' | 'edit' | 'confirm-delete'>('view')
    const [editQty, setEditQty] = useState('')
    const [editMealType, setEditMealType] = useState<MealType>('lunch')
    const [saving, setSaving] = useState(false)

    // Reset mode when log changes
    useEffect(() => {
        setMode('view')
        if (log) {
            setEditQty(log.quantity_g.toString())
            setEditMealType(log.meal_type)
        }
    }, [log])

    if (!log?.food_items) return null
    const currentLog = log!
    const fi = currentLog.food_items!
    const previewQty = parseFloat(editQty) || currentLog.quantity_g
    const f = previewQty / 100
    const macros = {
        calories: Math.round(fi.calories_per_100g * f),
        protein: parseFloat((fi.protein_g * f).toFixed(1)),
        carbs:   parseFloat((fi.carbs_g   * f).toFixed(1)),
        fat:     parseFloat((fi.fat_g     * f).toFixed(1)),
    }
    const loggedAt = new Date(currentLog.logged_at)
    const timeStr = loggedAt.toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' })
    const dateStr = loggedAt.toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })

    async function handleSave() {
        const qty = parseFloat(editQty)
        if (!qty || qty <= 0) return
        setSaving(true)
        await supabase.from('meal_logs').update({ quantity_g: qty, meal_type: editMealType }).eq('id', currentLog.id)
        setSaving(false)
        onEdited(currentLog.id, qty, editMealType)
        onClose()
    }

    async function handleDelete() {
        setSaving(true)
        await supabase.from('meal_logs').delete().eq('id', currentLog.id)
        setSaving(false)
        onDeleted(currentLog.id)
        onClose()
    }

    const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']
    const inputCls = 'h-10 rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 w-full'

    return (
        <Dialog open={!!log} onOpenChange={onClose}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                                <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
                                <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-base leading-tight">{fi.name}</DialogTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">{currentLog.quantity_g}g · {MEAL_LABELS[currentLog.meal_type]}</p>
                        </div>
                    </div>
                </DialogHeader>

                {mode === 'view' && (
                    <>
                        {/* Edit / Delete actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMode('edit')}
                                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border border-border text-[13px] font-medium text-foreground hover:bg-accent transition-colors"
                            >
                                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit
                            </button>
                            <button
                                onClick={() => setMode('confirm-delete')}
                                className="flex-1 flex items-center justify-center gap-2 h-9 rounded-xl border border-danger/30 text-[13px] font-medium text-danger hover:bg-danger/10 transition-colors"
                            >
                                <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                                Delete
                            </button>
                        </div>

                        {/* Calorie headline */}
                        <div className="flex items-center justify-between bg-muted rounded-xl px-4 py-3 mt-1">
                            <span className="text-sm text-muted-foreground">Total calories</span>
                            <span className="font-display font-extrabold text-2xl text-foreground">{macros.calories} <span className="text-sm font-normal text-muted-foreground">kcal</span></span>
                        </div>

                        {/* Macros */}
                        <div className="flex flex-col gap-2.5 mt-1">
                            <MacroRow label="Protein"  value={macros.protein} unit="g" pct={(macros.protein / 50) * 100}  color="bg-blue-500" />
                            <MacroRow label="Carbs"    value={macros.carbs}   unit="g" pct={(macros.carbs   / 120) * 100} color="bg-amber-400" />
                            <MacroRow label="Fat"      value={macros.fat}     unit="g" pct={(macros.fat     / 65)  * 100} color="bg-rose-400" />
                        </div>

                        {/* Per 100g footnote */}
                        <div className="border-t border-border pt-3 mt-1 flex flex-col gap-1">
                            <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">Per 100g</p>
                            <div className="flex gap-4 text-xs text-muted-foreground">
                                <span>{fi.calories_per_100g} kcal</span>
                                <span>{fi.protein_g}g P</span>
                                <span>{fi.carbs_g}g C</span>
                                <span>{fi.fat_g}g F</span>
                            </div>
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-3">
                            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Logged {dateStr} at {timeStr}
                            {currentLog.notes && <span className="italic text-muted-foreground/70 truncate ml-1">{currentLog.notes}</span>}
                        </div>
                    </>
                )}

                {mode === 'edit' && (
                    <div className="space-y-4 mt-1">
                        <div>
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Quantity (g)</label>
                            <input
                                type="number"
                                className={inputCls}
                                value={editQty}
                                onChange={e => setEditQty(e.target.value)}
                                autoFocus
                                min={1}
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Meal type</label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {MEAL_TYPES.map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setEditMealType(t)}
                                        className={cn(
                                            'py-2 rounded-xl text-xs font-medium border transition-colors capitalize',
                                            editMealType === t
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                        )}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {/* Live macro preview */}
                        <div className="bg-muted/50 rounded-xl px-4 py-3 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">{previewQty}g</span>
                            <span className="text-sm font-bold text-foreground">{macros.calories} kcal · {macros.protein}g P</span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setMode('view')} disabled={saving}>Cancel</Button>
                            <Button className="flex-1" onClick={handleSave} disabled={saving || !parseFloat(editQty)}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </div>
                    </div>
                )}

                {mode === 'confirm-delete' && (
                    <div className="space-y-4 mt-2">
                        <div className="bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
                            <p className="text-sm font-medium text-foreground">Delete this entry?</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {fi.name} — {currentLog.quantity_g}g logged at {timeStr}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => setMode('view')} disabled={saving}>Cancel</Button>
                            <Button
                                className="flex-1 bg-danger hover:bg-danger/90 text-white"
                                onClick={handleDelete}
                                disabled={saving}
                            >
                                {saving ? 'Deleting…' : 'Delete'}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}

const FALLBACK_TARGETS: UserTargets = { calories: 2400, protein: 160 }

function deriveMacroTargets(calTarget: number, proteinTarget: number) {
    const remaining = Math.max(0, calTarget - proteinTarget * 4)
    return {
        carbs: Math.round(remaining * 0.55 / 4),
        fat:   Math.round(remaining * 0.30 / 9),
    }
}

type HistoryDay = { date: string; logs: MealLog[]; totals: DailyTotals }
type HistoryRange = 7 | 14 | 30
const HISTORY_RANGES: { value: HistoryRange; label: string }[] = [
    { value: 7,  label: 'Last 7 days' },
    { value: 14, label: 'Last 14 days' },
    { value: 30, label: 'Last 30 days' },
]

function fmtHistoryDate(dateStr: string) {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function NutritionPage() {
    const { user } = useAuth()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [selectedLog, setSelectedLog] = useState<MealLog | null>(null)
    const [meals, setMeals] = useState<MealLog[]>([])
    const [profile, setProfile] = useState<UserProfile | null>(null)
    const [loading, setLoading] = useState(true)

    // History tab state
    const [tab, setTab] = useState<'today' | 'history'>('today')
    const [historyRange, setHistoryRange] = useState<HistoryRange>(7)
    const [historyDays, setHistoryDays] = useState<HistoryDay[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)

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

    const fetchHistory = useCallback(async (days: HistoryRange) => {
        if (!user) return
        setHistoryLoading(true)
        const from = new Date()
        from.setDate(from.getDate() - days)
        from.setHours(0, 0, 0, 0)
        // Exclude today — it's shown in the Today tab
        const endOfYesterday = new Date(todayStr)
        endOfYesterday.setHours(0, 0, 0, 0)
        endOfYesterday.setMilliseconds(-1)

        const { data } = await supabase
            .from('meal_logs')
            .select('id, meal_type, quantity_g, logged_at, notes, food_items (id, name, calories_per_100g, protein_g, carbs_g, fat_g)')
            .eq('user_id', user.id)
            .gte('logged_at', from.toISOString())
            .lte('logged_at', endOfYesterday.toISOString())
            .order('logged_at', { ascending: false })

        const logs = (data as unknown as MealLog[]) ?? []

        // Group by local date (en-CA gives YYYY-MM-DD)
        const byDate: Record<string, MealLog[]> = {}
        for (const log of logs) {
            const dateKey = new Date(log.logged_at).toLocaleDateString('en-CA')
            if (!byDate[dateKey]) byDate[dateKey] = []
            byDate[dateKey].push(log)
        }

        const grouped: HistoryDay[] = Object.entries(byDate)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, dayLogs]) => ({
                date,
                logs: dayLogs,
                totals: dayLogs.reduce(
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
                ),
            }))

        setHistoryDays(grouped)
        setHistoryLoading(false)
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

    // Fetch history whenever the history tab is active or range changes
    useEffect(() => {
        if (tab === 'history') fetchHistory(historyRange)
    }, [tab, historyRange, fetchHistory])

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

    const macroTargets = deriveMacroTargets(targets.calories, targets.protein)
    const calPct = Math.min(100, Math.round((totals.calories / targets.calories) * 100))

    const mealsByType = MEAL_ORDER.map(type => ({
        type,
        logs: meals.filter(m => m.meal_type === type),
    })).filter(g => g.logs.length > 0)

    return (
        <div className="min-h-screen px-4 sm:px-6 lg:px-10 pt-8 pb-12 max-w-5xl mx-auto">
            <div className="w-full space-y-7">

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

                {/* ── Tab toggle: Today / History ── */}
                <div className="flex gap-1 bg-muted rounded-xl p-1 w-fit animate-in fade-in duration-300">
                    {(['today', 'history'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={cn(
                                'px-5 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize',
                                tab === t
                                    ? 'bg-background text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground'
                            )}
                        >
                            {t === 'today' ? 'Today' : 'History'}
                        </button>
                    ))}
                </div>

                {tab === 'today' && (<>

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
                                <span className="text-xs font-medium text-white/80">
                                    {fmt(totals.carbs)}<span className="text-white/40">/{macroTargets.carbs}g</span>
                                </span>
                            </div>
                            <ProgressBar value={totals.carbs} max={macroTargets.carbs} colorClass="bg-yellow-300" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-white/60">Fat</span>
                                <span className="text-xs font-medium text-white/80">
                                    {fmt(totals.fat)}<span className="text-white/40">/{macroTargets.fat}g</span>
                                </span>
                            </div>
                            <ProgressBar value={totals.fat} max={macroTargets.fat} colorClass="bg-orange-300" />
                        </div>
                    </div>
                </div>

                {/* ── Meal list ── */}
                {loading ? (
                    <div className="flex flex-col gap-6">
                        {[0, 1].map(g => (
                            <div key={g}>
                                <div className="flex items-center gap-2 mb-2.5">
                                    <Skeleton className="w-24 h-3" />
                                    <div className="flex-1 h-px bg-border" />
                                    <Skeleton className="w-20 h-3" />
                                </div>
                                <div className="space-y-2">
                                    {[0, 1, 2].map(i => (
                                        <div key={i} className="bg-card border border-border rounded-xl px-4 py-3.5 flex items-center gap-4">
                                            <div className="flex-1 space-y-2">
                                                <Skeleton className="h-3.5 w-36" />
                                                <Skeleton className="h-2.5 w-48" />
                                            </div>
                                            <div className="text-right space-y-1">
                                                <Skeleton className="h-5 w-10 ml-auto" />
                                                <Skeleton className="h-2.5 w-8 ml-auto" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
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
                                                    onClick={() => setSelectedLog(log)}
                                                    className={cn(
                                                        'bg-card border border-border rounded-xl px-4 py-3.5',
                                                        'flex items-center justify-between gap-4',
                                                        'hover:border-primary/30 hover:shadow-sm transition-all duration-150 cursor-pointer',
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

                </>)}

                {/* ── History tab ── */}
                {tab === 'history' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                        {/* Range pills */}
                        <div className="flex gap-2 flex-wrap">
                            {HISTORY_RANGES.map(({ value, label }) => (
                                <button
                                    key={value}
                                    onClick={() => setHistoryRange(value)}
                                    className={cn(
                                        'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
                                        historyRange === value
                                            ? 'bg-primary text-white border-primary'
                                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                    )}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>

                        {historyLoading ? (
                            <div className="space-y-4">
                                {[0, 1, 2].map(i => (
                                    <div key={i}>
                                        <Skeleton className="h-4 w-32 mb-3" />
                                        <div className="space-y-2">
                                            {[0, 1].map(j => <Skeleton key={j} className="h-14 rounded-xl" />)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : historyDays.length === 0 ? (
                            <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                                    <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                                    </svg>
                                </div>
                                <div>
                                    <p className="font-semibold text-foreground text-sm">No meals in this period</p>
                                    <p className="text-xs text-muted-foreground mt-1">Start logging meals to see your history here.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {historyDays.map(({ date, logs, totals: dayTotals }) => {
                                    const dayMealsByType = MEAL_ORDER.map(type => ({
                                        type,
                                        logs: logs.filter(l => l.meal_type === type),
                                    })).filter(g => g.logs.length > 0)

                                    const calPctDay = targets.calories
                                        ? Math.min(100, Math.round((dayTotals.calories / targets.calories) * 100))
                                        : 0

                                    return (
                                        <div key={date}>
                                            {/* Day header */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-foreground">{fmtHistoryDate(date)}</span>
                                                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                        {calPctDay}% of target
                                                    </span>
                                                </div>
                                                <span className="text-xs font-semibold text-foreground tabular-nums">
                                                    {dayTotals.calories.toLocaleString()} kcal
                                                    <span className="font-normal text-muted-foreground ml-1">· {fmt(dayTotals.protein)}g P</span>
                                                </span>
                                            </div>

                                            {/* Meals grouped by type */}
                                            <div className="space-y-4">
                                                {dayMealsByType.map(({ type, logs: typeLogs }) => (
                                                    <div key={type}>
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                                                {MEAL_ICONS[type]}
                                                                <span className="text-[10px] font-bold uppercase tracking-widest">{MEAL_LABELS[type]}</span>
                                                            </div>
                                                            <div className="flex-1 h-px bg-border" />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {typeLogs.map(log => {
                                                                const m = calcMacros(log)
                                                                return (
                                                                    <div
                                                                        key={log.id}
                                                                        onClick={() => setSelectedLog(log)}
                                                                        className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-4 hover:border-primary/30 transition-colors cursor-pointer"
                                                                    >
                                                                        <div className="min-w-0 flex-1">
                                                                            <div className="text-sm font-medium text-foreground truncate">{log.food_items?.name ?? '—'}</div>
                                                                            <div className="text-[11px] text-muted-foreground mt-0.5 flex gap-2">
                                                                                <span>{log.quantity_g}g</span>
                                                                                <span className="text-border">·</span>
                                                                                <span>{fmt(m.protein)}g P</span>
                                                                                <span className="text-border">·</span>
                                                                                <span>{fmt(m.carbs)}g C</span>
                                                                                <span className="text-border">·</span>
                                                                                <span>{fmt(m.fat)}g F</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right shrink-0">
                                                                            <div className="text-sm font-bold text-foreground tabular-nums">{m.calories}</div>
                                                                            <div className="text-[10px] text-muted-foreground uppercase">kcal</div>
                                                                        </div>
                                                                    </div>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
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
            <FoodItemDialog
                log={selectedLog}
                onClose={() => setSelectedLog(null)}
                onDeleted={id => setMeals(prev => prev.filter(m => m.id !== id))}
                onEdited={(id, qty, mealType) => setMeals(prev => prev.map(m =>
                    m.id === id ? { ...m, quantity_g: qty, meal_type: mealType } : m
                ))}
            />
        </div>
    )
}
