'use client'

import React, { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import {
    calculateRMR, calculateAEE, calculateEER,
    calculateProteinRequirement, calculateBMI, ageFromDob,
} from '@/lib/tdee'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'
import { Label } from '@/components/ui/label'
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { NumberPopIn, Shimmer, SlidingTabs } from '@/components/ui/transitions'

// ── Types ─────────────────────────────────────────────────────────────────────
type GoalMode      = 'bulk' | 'cut' | 'maintain' | 'ippt'
type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'

type MealOption = {
    name: string
    description: string
    macros: { calories: number; protein: number; carbs: number; fat: number }
    tip: string
}

type MealSlot = {
    slot: string
    time: string
    options: MealOption[]
}

type CachedPlan = {
    plan: MealSlot[]
    eer: number
    protein: number
    goalMode: GoalMode
    activity: ActivityLevel
    generatedAt: string  // ISO timestamp
}

// ── localStorage helpers ──────────────────────────────────────────────────────
function cacheKey(userId: string) { return `inap_meal_plan_${userId}` }

function savePlan(userId: string, data: CachedPlan) {
    try { localStorage.setItem(cacheKey(userId), JSON.stringify(data)) } catch { /* storage full or unavailable */ }
}

function loadPlan(userId: string): CachedPlan | null {
    try {
        const raw = localStorage.getItem(cacheKey(userId))
        return raw ? (JSON.parse(raw) as CachedPlan) : null
    } catch { return null }
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
    { value: 'sedentary',   label: 'Sedentary' },
    { value: 'light',       label: 'Light (1–3×/wk)' },
    { value: 'moderate',    label: 'Moderate (3–5×/wk)' },
    { value: 'active',      label: 'Active (6–7×/wk)' },
    { value: 'very_active', label: 'Very active (2×/day)' },
]

const GOAL_OPTIONS: { value: GoalMode; label: string; color: string }[] = [
    { value: 'bulk',     label: 'Bulk',     color: '#0052CC' },
    { value: 'cut',      label: 'Cut',      color: '#DE350B' },
    { value: 'maintain', label: 'Maintain', color: '#00875A' },
    { value: 'ippt',     label: 'IPPT',     color: '#FF991F' },
]

const BMI_CATEGORY: { max: number; label: string; color: string }[] = [
    { max: 18.5,     label: 'Underweight', color: '#FF991F' },
    { max: 23.0,     label: 'Healthy',     color: '#00875A' },
    { max: 27.5,     label: 'Overweight',  color: '#FF991F' },
    { max: Infinity, label: 'Obese',       color: '#DE350B' },
]

// Shimmer loading phrases — cycles while the AI is generating the plan
const LOADING_PHRASES = [
    'Crunching your macros…',
    'Plotting your gains…',
    'Fuelling your training day…',
    'Building your battle plan…',
    'Optimising for peak performance…',
    'Analysing your energy needs…',
    'Crafting your perfect day…',
]

// Metadata for each meal slot: label, badge colours, icon
const SLOT_META: Record<string, {
    label: string
    bgClass: string
    textClass: string
    Icon: () => React.ReactElement
}> = {
    breakfast:       { label: 'Breakfast',       bgClass: 'bg-warning-light',  textClass: 'text-warning-dark',  Icon: SunIcon },
    morning_snack:   { label: 'Morning snack',   bgClass: 'bg-primary-light',  textClass: 'text-primary-dark',  Icon: ZapIcon },
    lunch:           { label: 'Lunch',           bgClass: 'bg-success-light',  textClass: 'text-success-dark',  Icon: UtensilsIcon },
    afternoon_snack: { label: 'Afternoon snack', bgClass: 'bg-primary-light',  textClass: 'text-primary-dark',  Icon: ZapIcon },
    dinner:          { label: 'Dinner',          bgClass: 'bg-muted',          textClass: 'text-foreground',    Icon: MoonIcon },
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────
function SunIcon()      { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg> }
function ZapIcon()      { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> }
function UtensilsIcon() { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.7 1.3 3 3 3s3-1.3 3-3V2"/><line x1="6" y1="12" x2="6" y2="22"/><path d="M20 5c0-1.7-1.3-3-3-3s-3 1.3-3 3c0 1.4.8 2.6 2 3.1V22h2V8.1c1.2-.5 2-1.7 2-3.1z"/></svg> }
function MoonIcon()     { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg> }
function InfoIcon()     { return <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> }
function ChevronIcon()  { return <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg> }

// ── SCard ─────────────────────────────────────────────────────────────────────
function SCard({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('bg-card border border-border rounded-xl p-5 sm:p-6', className)}>
            {children}
        </div>
    )
}

// ── Stat tile with tooltip ────────────────────────────────────────────────────
// Shows a metric value (animated pop-in on mount/change) with an explanatory
// tooltip on hover. Used for BMI, RMR, AEE in the results card.
function StatTile({
    label, value, sub, accent, tooltip,
}: {
    label: string
    value: string
    sub: string
    accent?: string
    tooltip?: string
}) {
    return (
        <div className="relative group flex flex-col gap-0.5 p-3 bg-muted rounded-lg cursor-default select-none">
            {/* Label row — question mark badge appears when tooltip exists */}
            <div className="flex items-center gap-1 mb-0.5">
                <span className="text-[9px] font-semibold tracking-[0.12em] uppercase text-muted-foreground">{label}</span>
                {tooltip && (
                    <span className="w-3.5 h-3.5 rounded-full border border-muted-foreground/35 text-muted-foreground/55 flex items-center justify-center text-[8px] font-bold leading-none flex-shrink-0">?</span>
                )}
            </div>

            {/* Value — remounting via key triggers pop-in animation on every change */}
            <span className="font-display text-[20px] font-bold leading-none tabular-nums" style={{ color: accent ?? 'var(--foreground)' }}>
                <NumberPopIn key={value} value={value} />
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{sub}</span>

            {/* Hover tooltip — appears above the tile */}
            {tooltip && (
                <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-56 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <div className="bg-popover border border-border rounded-xl shadow-xl p-3 text-[11px] text-popover-foreground leading-relaxed">
                        <div className="font-semibold text-foreground text-[12px] mb-1">{label}</div>
                        {tooltip}
                    </div>
                    {/* Arrow pointing down */}
                    <div className="flex justify-center">
                        <div className="w-2.5 h-2.5 -mt-1.5 rotate-45 bg-popover border-b border-r border-border" />
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Single meal option card ───────────────────────────────────────────────────
// Rendered inside SlotSection. The Option A/B label lives in the tab switcher above,
// so this card only shows the meal content.
function OptionCard({ option }: { option: MealOption }) {
    return (
        <div className={cn(
            'flex flex-col rounded-xl border border-border bg-background overflow-hidden',
            'transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-border/60',
            // fade + slide up on every mount (triggered by key change when tab switches)
            'animate-in fade-in slide-in-from-bottom-2 duration-200',
        )}>
            <div className="px-4 pt-4 pb-3 flex-1">
                <div className="font-display text-[15px] font-bold text-foreground leading-snug">{option.name}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5 leading-snug">{option.description}</div>
            </div>

            {/* Colour-coded macro pills */}
            <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold tabular-nums">
                    {option.macros.calories} kcal
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-success-light text-success-dark text-[11px] font-semibold tabular-nums">
                    {option.macros.protein}g P
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-warning-light text-warning-dark text-[11px] font-semibold tabular-nums">
                    {option.macros.carbs}g C
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold tabular-nums">
                    {option.macros.fat}g F
                </span>
            </div>

            {option.tip && (
                <div className="px-4 pb-4">
                    <div className="flex items-start gap-1.5 bg-primary/5 rounded-lg px-3 py-2 text-[11px] text-primary font-medium leading-snug">
                        <span className="flex-shrink-0 mt-0.5"><InfoIcon /></span>
                        {option.tip}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Meal slot section ─────────────────────────────────────────────────────────
// Sliding tabs (A / B) to switch between the two meal options for this time slot.
function SlotSection({ slot, slotIndex }: { slot: MealSlot; slotIndex: number }) {
    const [activeOption, setActiveOption] = useState(0)
    const meta = SLOT_META[slot.slot] ?? { label: slot.slot, bgClass: 'bg-muted', textClass: 'text-foreground', Icon: UtensilsIcon }
    const hasTwo = slot.options.length >= 2

    return (
        <div
            className="animate-in fade-in slide-in-from-bottom-3 duration-500"
            style={{ animationDelay: `${slotIndex * 100}ms`, animationFillMode: 'both' }}
        >
            {/* Slot header: time badge + name + rule line */}
            <div className="flex items-center gap-2.5 mb-3">
                <span className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold shrink-0', meta.bgClass, meta.textClass)}>
                    <meta.Icon />
                    {slot.time}
                </span>
                <span className="font-display text-[15px] font-bold text-foreground">{meta.label}</span>
                <div className="flex-1 h-px bg-border" />
            </div>

            {/* Sliding tab switcher — only shown when there are 2 options */}
            {hasTwo && (
                <div className="mb-3">
                    <SlidingTabs
                        tabs={['Option A', 'Option B']}
                        active={activeOption}
                        onChange={setActiveOption}
                    />
                </div>
            )}

            {/* Active option card — key causes remount → fade-in animation on switch */}
            {slot.options[activeOption] && (
                <OptionCard key={`${slot.slot}-${activeOption}`} option={slot.options[activeOption]} />
            )}
        </div>
    )
}

// ── Full day plan ─────────────────────────────────────────────────────────────
function DayPlan({ plan }: { plan: MealSlot[] }) {
    return (
        <div className="flex flex-col gap-7">
            {plan.map((slot, i) => (
                <SlotSection key={slot.slot} slot={slot} slotIndex={i} />
            ))}
        </div>
    )
}

// ── Skeleton shown while AI generates ────────────────────────────────────────
function PlanSkeleton() {
    return (
        <div className="flex flex-col gap-7">
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse" style={{ animationDelay: `${i * 60}ms` }}>
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-24 h-6 rounded-lg bg-muted" />
                        <div className="w-20 h-5 rounded-md bg-muted" />
                        <div className="flex-1 h-px bg-muted" />
                    </div>
                    <div className="w-32 h-7 rounded-full bg-muted mb-3" />
                    <div className="rounded-xl border border-border overflow-hidden">
                        <div className="p-4 flex flex-col gap-2">
                            <div className="h-4 w-2/3 bg-muted rounded-md" />
                            <div className="h-3 w-full bg-muted rounded-md" />
                            <div className="flex gap-1.5 mt-1">
                                <div className="h-5 w-16 bg-muted rounded-full" />
                                <div className="h-5 w-12 bg-muted rounded-full" />
                                <div className="h-5 w-12 bg-muted rounded-full" />
                                <div className="h-5 w-10 bg-muted rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function NutritionCalculatorPage() {
    const { user, session } = useAuth()

    // Body metrics — pre-filled from user profile on load
    const [weight, setWeight]       = useState('')
    const [height, setHeight]       = useState('')
    const [dob, setDob]             = useState('')
    const [gender, setGender]       = useState<'Male' | 'Female' | ''>('')
    const [bodyFat, setBodyFat]     = useState('')
    const [waist, setWaist]         = useState('')
    // Goal & activity — also pre-filled from profile
    const [activity, setActivity]   = useState<ActivityLevel>('moderate')
    const [goalMode, setGoalMode]   = useState<GoalMode>('maintain')
    const [goalNotes, setGoalNotes] = useState('')
    const [service, setService]     = useState('')
    const [profileLoaded, setProfileLoaded] = useState(false)

    // AI state
    const [plan, setPlan]           = useState<MealSlot[] | null>(null)
    const [cachedMeta, setCachedMeta] = useState<Omit<CachedPlan, 'plan'> | null>(null)
    const [aiLoading, setAiLoading] = useState(false)
    const [aiError, setAiError]     = useState<string | null>(null)
    // Cycles through creative phrases while generating
    const [phraseIdx, setPhraseIdx] = useState(0)

    // Load user profile once on mount, then restore any cached plan
    useEffect(() => {
        if (!user || profileLoaded) return
        supabase
            .from('users')
            .select('weight_kg, height_cm, date_of_birth, gender, activity_level, goal_mode, service')
            .eq('id', user.id)
            .single()
            .then(({ data }) => {
                if (!data) return
                if (data.weight_kg)      setWeight(String(data.weight_kg))
                if (data.height_cm)      setHeight(String(data.height_cm))
                if (data.date_of_birth)  setDob(data.date_of_birth)
                if (data.gender)         setGender(data.gender as 'Male' | 'Female')
                if (data.activity_level) setActivity(data.activity_level as ActivityLevel)
                if (data.goal_mode)      setGoalMode(data.goal_mode as GoalMode)
                if (data.service)        setService(data.service)
                setProfileLoaded(true)

                // Restore the last generated plan for this user
                const cached = loadPlan(user.id)
                if (cached) {
                    setPlan(cached.plan)
                    const { plan: _, ...meta } = cached
                    setCachedMeta(meta)
                }
            })
    }, [user, profileLoaded])

    // Cycle through loading phrases every 2.5 s while AI is running
    useEffect(() => {
        if (!aiLoading) { setPhraseIdx(0); return }
        const id = setInterval(() => setPhraseIdx(n => (n + 1) % LOADING_PHRASES.length), 2500)
        return () => clearInterval(id)
    }, [aiLoading])

    // Live-recalculated whenever metrics/goal/activity change
    const calculated = useMemo(() => {
        const w  = parseFloat(weight)
        const h  = parseFloat(height)
        const bf = parseFloat(bodyFat) || null
        if (!w || !h || !gender) return null
        const age     = dob ? ageFromDob(dob) : 22
        const rmr     = calculateRMR({ gender, weight_kg: w, height_cm: h, age, body_fat_pct: bf })
        const aee     = calculateAEE(rmr, activity)
        const eer     = calculateEER(rmr, activity, goalMode)
        const protein = calculateProteinRequirement(w, goalMode)
        const bmi     = calculateBMI(w, h)
        const bmiCat  = BMI_CATEGORY.find(c => bmi < c.max)!
        return { rmr, aee, eer, protein, bmi, bmiCat }
    }, [weight, height, dob, gender, bodyFat, activity, goalMode])

    // Client-side validation — inline errors shown below each field
    const weightErr  = weight  && (parseFloat(weight)  < 20  || parseFloat(weight)  > 300) ? 'Must be 20–300 kg' : ''
    const heightErr  = height  && (parseFloat(height)  < 100 || parseFloat(height)  > 250) ? 'Must be 100–250 cm' : ''
    const bodyFatErr = bodyFat && (parseFloat(bodyFat) < 1   || parseFloat(bodyFat) > 60)  ? 'Must be 1–60%' : ''
    const waistErr   = waist   && (parseFloat(waist)   < 40  || parseFloat(waist)   > 200) ? 'Must be 40–200 cm' : ''
    const canGenerate = !!calculated && !aiLoading && !weightErr && !heightErr

    // True when the cached plan was generated with different targets than current
    const planIsStale = !!(plan && cachedMeta && calculated && (
        cachedMeta.eer      !== calculated.eer     ||
        cachedMeta.protein  !== calculated.protein  ||
        cachedMeta.goalMode !== goalMode             ||
        cachedMeta.activity !== activity
    ))

    const generatePlan = useCallback(async () => {
        if (!calculated || !session) return
        setAiLoading(true)
        setAiError(null)
        setPlan(null)
        try {
            const res = await fetch('/api/nutrition/meal-plan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    weight_kg:      parseFloat(weight),
                    height_cm:      parseFloat(height),
                    age:            dob ? ageFromDob(dob) : 22,
                    gender,
                    goal_mode:      goalMode,
                    activity_level: activity,
                    eer:            calculated.eer,
                    protein_g:      calculated.protein,
                    body_fat_pct:   parseFloat(bodyFat) || null,
                    waist_cm:       parseFloat(waist) || null,
                    goal_notes:     goalNotes,
                    service,
                }),
            })
            const data = await res.json()
            if (!res.ok || data.error) {
                setAiError(data.error === 'ai_unavailable'
                    ? 'AI is temporarily unavailable — try again shortly.'
                    : 'Something went wrong. Please try again.')
                return
            }
            const meta: Omit<CachedPlan, 'plan'> = {
                eer: calculated.eer,
                protein: calculated.protein,
                goalMode,
                activity,
                generatedAt: new Date().toISOString(),
            }
            setPlan(data.plan)
            setCachedMeta(meta)
            if (user) savePlan(user.id, { plan: data.plan, ...meta })
        } catch {
            setAiError('Network error — please check your connection.')
        } finally {
            setAiLoading(false)
        }
    }, [calculated, session, user, weight, height, dob, gender, goalMode, activity, bodyFat, waist, goalNotes, service])

    return (
        <div className="px-4 py-6 sm:px-6 md:px-10 md:py-9">

            {/* ── Page header ──────────────────────────────────────────────── */}
            <div className="mb-7">
                <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground mb-3">
                    <Link href="/dashboard/nutrition" className="hover:text-foreground transition-colors">Nutrition</Link>
                    <ChevronIcon />
                    <span className="text-foreground font-medium">Calculator</span>
                </div>
                <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-1.5">Nutrition · Calculator</div>
                <div className="font-display text-[32px] font-bold tracking-tight text-foreground leading-none">Nutrition Calculator</div>
                <div className="text-[14px] text-muted-foreground mt-2">
                    Energy requirements, protein targets, and a full-day meal plan personalised to you.
                </div>
            </div>

            {/* ── Two-column grid on large screens ─────────────────────────── */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[440px_1fr] lg:items-start">

                {/* ═══════ LEFT — inputs (sticky so targets stay visible while reading meal plan) */}
                <div className="flex flex-col gap-4 lg:sticky lg:top-6">

                    {/* Body metrics */}
                    <SCard>
                        <div className="font-display text-[15px] font-bold text-foreground mb-0.5">Body metrics</div>
                        <div className="text-[12px] text-muted-foreground mb-4">Pre-filled from your profile. Edit for a one-off calculation.</div>
                        <div className="grid grid-cols-2 gap-3">
                            <InputField label="Weight" type="number" suffix="kg" value={weight} onChange={e => setWeight(e.target.value)} error={weightErr} placeholder="70" />
                            <InputField label="Height" type="number" suffix="cm" value={height} onChange={e => setHeight(e.target.value)} error={heightErr} placeholder="170" />
                            <div className="flex flex-col gap-1.5">
                                <Label>Gender</Label>
                                <Select value={gender} onValueChange={v => setGender(v as 'Male' | 'Female')}>
                                    <SelectTrigger className="w-full"><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Male">Male</SelectItem>
                                        <SelectItem value="Female">Female</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <InputField label="Age" type="number" suffix="yrs" value={dob ? String(ageFromDob(dob)) : ''} onChange={() => {}} disabled placeholder="—" hint="From your profile" />
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                            <InputField label="Body fat" type="number" suffix="%" value={bodyFat} onChange={e => setBodyFat(e.target.value)} error={bodyFatErr} placeholder="Optional" hint="Improves RMR accuracy" />
                            <InputField label="Waist" type="number" suffix="cm" value={waist} onChange={e => setWaist(e.target.value)} error={waistErr} placeholder="Optional" hint="Used by meal AI" />
                        </div>
                    </SCard>

                    {/* Live results — appears + animates in once metrics are filled */}
                    {calculated ? (
                        <SCard className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <div className="font-display text-[15px] font-bold text-foreground mb-3">Your estimates</div>

                            {/* EER headline — NumberPopIn re-triggers on every value change */}
                            <div className="rounded-xl bg-primary/[0.07] border border-primary/15 px-4 py-3.5 mb-3 flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-primary/60 mb-1">Daily calorie target (EER)</div>
                                    <div className="font-display text-[34px] font-bold text-primary leading-none">
                                        <NumberPopIn key={calculated.eer.toLocaleString()} value={calculated.eer.toLocaleString()} />
                                        <span className="text-[14px] font-normal text-primary/60 ml-1">kcal</span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <div className="text-[10px] font-semibold tracking-[0.1em] uppercase text-muted-foreground mb-1">Protein</div>
                                    <div className="font-display text-[24px] font-bold text-success-dark leading-none">
                                        <NumberPopIn key={String(calculated.protein)} value={String(calculated.protein)} />
                                        <span className="text-[12px] font-normal text-muted-foreground ml-0.5">g/day</span>
                                    </div>
                                </div>
                            </div>

                            {/* Supporting stat tiles with hover tooltips */}
                            <div className="grid grid-cols-3 gap-2">
                                <StatTile
                                    label="BMI"
                                    value={String(calculated.bmi)}
                                    sub={calculated.bmiCat.label}
                                    accent={calculated.bmiCat.color}
                                    tooltip="Body Mass Index = weight ÷ height². Doesn't account for muscle mass — a lean, muscular cadet may read overweight. Use body fat % above for a more accurate picture."
                                />
                                <StatTile
                                    label="RMR"
                                    value={calculated.rmr.toLocaleString()}
                                    sub="kcal at rest"
                                    tooltip="Resting Metabolic Rate — calories your body burns at complete rest: breathing, circulation, and organ function. Calculated using Mifflin-St Jeor, or the more accurate Katch-McArdle when body fat % is provided."
                                />
                                <StatTile
                                    label="AEE"
                                    value={`+${calculated.aee.toLocaleString()}`}
                                    sub="from activity"
                                    tooltip="Activity Energy Expenditure — calories burned through physical training and daily movement, on top of your RMR. AEE = RMR × (activity multiplier − 1). A higher activity level means a higher AEE."
                                />
                            </div>

                            <div className="mt-2.5 text-[10px] text-muted-foreground">
                                {parseFloat(bodyFat) > 0
                                    ? 'RMR via Katch-McArdle (body fat % provided). EER = RMR × activity ± goal adjustment.'
                                    : 'RMR via Mifflin-St Jeor. Add body fat % above for a more accurate estimate.'}
                            </div>
                        </SCard>
                    ) : (
                        <SCard>
                            <div className="py-3 text-center text-[13px] text-muted-foreground">
                                Fill in weight, height, and gender to see your estimates.
                            </div>
                        </SCard>
                    )}

                    {/* Goal & activity — pre-filled from profile */}
                    <SCard>
                        <div className="font-display text-[15px] font-bold text-foreground mb-0.5">Goal & activity</div>
                        <div className="text-[12px] text-muted-foreground mb-4">Pre-filled from your profile. Changes recalculate targets instantly.</div>
                        <div className="flex flex-col gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label>Goal</Label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {GOAL_OPTIONS.map(g => (
                                        <button
                                            key={g.value} type="button"
                                            onClick={() => setGoalMode(g.value)}
                                            className={cn(
                                                'py-2 rounded-lg text-[12px] font-semibold border-[1.5px] transition-all duration-150 cursor-pointer',
                                                goalMode === g.value
                                                    ? 'text-white border-transparent'
                                                    : 'bg-card border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground'
                                            )}
                                            style={goalMode === g.value ? { background: g.color, borderColor: g.color } : undefined}
                                        >
                                            {g.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Activity level</Label>
                                <Select value={activity} onValueChange={v => setActivity(v as ActivityLevel)}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ACTIVITY_OPTIONS.map(a => (
                                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </SCard>
                </div>

                {/* ═══════ RIGHT — meal plan generator + output ═══════════════ */}
                <div className="flex flex-col gap-5">

                    {/* Notes + generate */}
                    <SCard>
                        <div className="font-display text-[15px] font-bold text-foreground mb-0.5">Daily meal plan</div>
                        <div className="text-[12px] text-muted-foreground mb-4">
                            Generates 5 meal slots — breakfast, morning snack, lunch, afternoon snack, and dinner.
                            Each slot has two options to choose from, with protein shakes and bars included in snack slots.
                        </div>
                        <div className="flex flex-col gap-1.5 mb-4">
                            <Label>Preferences <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <textarea
                                value={goalNotes}
                                onChange={e => setGoalNotes(e.target.value)}
                                placeholder="e.g. no pork, prefer hawker food, vegetarian, high-protein breakfast…"
                                rows={2}
                                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                            />
                        </div>
                        <Button onClick={generatePlan} disabled={!canGenerate} className="w-full">
                            {aiLoading ? (
                                /* Shimmer text cycles through creative phrases while the AI works */
                                <Shimmer className="font-medium">
                                    {LOADING_PHRASES[phraseIdx]}
                                </Shimmer>
                            ) : plan ? 'Regenerate plan' : 'Generate meal plan'}
                        </Button>
                        {!calculated && (
                            <p className="mt-2 text-[11px] text-muted-foreground text-center">Fill in your body metrics on the left first.</p>
                        )}
                        {aiError && (
                            <div className="mt-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-[13px] text-destructive font-medium">
                                {aiError}
                            </div>
                        )}
                        {/* Cached plan metadata — shown when a plan exists */}
                        {plan && cachedMeta && !aiLoading && (
                            <div className={cn(
                                'mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5 text-[11px] leading-snug',
                                planIsStale
                                    ? 'bg-warning-light text-warning-dark border border-warning-dark/20'
                                    : 'bg-muted text-muted-foreground',
                            )}>
                                <span className="shrink-0 mt-0.5">{planIsStale ? '⚠' : '✓'}</span>
                                <span>
                                    {planIsStale
                                        ? <>Your metrics have changed ({cachedMeta.eer} → {calculated?.eer} kcal). <strong>Regenerate</strong> for an updated plan.</>
                                        : <>Plan generated on {new Date(cachedMeta.generatedAt).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })} · {cachedMeta.eer} kcal · {cachedMeta.protein}g protein</>
                                    }
                                </span>
                            </div>
                        )}
                    </SCard>

                    {/* Skeleton while generating */}
                    {aiLoading && <PlanSkeleton />}

                    {/* Day plan — slides in slot by slot once ready */}
                    {plan && !aiLoading && (
                        <div className="animate-in fade-in duration-300">
                            <DayPlan plan={plan} />
                        </div>
                    )}
                </div>

            </div>
        </div>
    )
}
