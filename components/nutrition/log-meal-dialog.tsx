'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/context/auth-context'
import { detectMealType } from '@/lib/tdee'
import { cn, fmt } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'
type Stage = 'pick' | 'custom' | 'details'

type FoodItem = {
    id: string
    name: string
    calories_per_100g: number
    protein_g: number
    carbs_g: number
    fat_g: number
    is_cookhouse_item: boolean
}

type SearchResult = FoodItem & { source?: 'db' }

export type DailyTotals = { calories: number; protein: number; carbs: number; fat: number }
export type UserTargets = { calories: number; protein: number }

// ─── Food templates (fetched from DB) ────────────────────────────────────────

type Template = FoodItem & { category: string }

// ─── Sub-components ───────────────────────────────────────────────────────────

function MacroStat({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <span className={cn('text-sm font-semibold', highlight ? 'text-success' : 'text-foreground')}>
                {value}
                <span className="text-[11px] text-muted-foreground ml-0.5">{unit}</span>
            </span>
        </div>
    )
}

function BackButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-1"
        >
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
            </svg>
            Back
        </button>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    dailyTotals?: DailyTotals
    targets?: UserTargets
    onLogged?: () => void
}

export function LogMealDialog({ open, onOpenChange, dailyTotals, targets, onLogged }: Props) {
    const { user } = useAuth()

    const [stage, setStage] = useState<Stage>('pick')
    const [query, setQuery] = useState('')
    const [results, setResults] = useState<SearchResult[]>([])
    const [searching, setSearching] = useState(false)
    const [templates, setTemplates] = useState<Template[]>([])
    const [activeCategory, setActiveCategory] = useState<string>('')

    const [selected, setSelected] = useState<FoodItem | Omit<FoodItem, 'id'> | null>(null)
    const [quantity, setQuantity] = useState('100')
    const [quantityError, setQuantityError] = useState<string | null>(null)
    const [mealType, setMealType] = useState<MealType>(detectMealType())
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [custom, setCustom] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '', is_cookhouse_item: false })
    const [customErrors, setCustomErrors] = useState<Record<string, string>>({})
    const [estimating, setEstimating] = useState(false)
    const [estimateError, setEstimateError] = useState<string | null>(null)
    const [estimateSuccess, setEstimateSuccess] = useState(false)
    // Suggested portion size from AI estimate — applied when entering the details stage
    const [suggestedQty, setSuggestedQty] = useState<number | null>(null)

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Fetch templates from DB once on first open
    useEffect(() => {
        if (!open || templates.length > 0) return
        fetch('/api/food-templates')
            .then(r => r.json())
            .then((data: Template[]) => {
                if (Array.isArray(data) && data.length > 0) {
                    setTemplates(data)
                    setActiveCategory(data[0].category)
                }
            })
            .catch(() => {})
    }, [open, templates.length])

    function validateQuantity(val: string): string | null {
        const n = parseFloat(val)
        if (!val || isNaN(n)) return 'Enter a quantity'
        if (n <= 0) return 'Must be greater than 0'
        if (n > 5000) return 'Max 5000g per serving'
        return null
    }

    function validateMacro(val: string, label: string, max: number): string | null {
        const n = parseFloat(val)
        if (val === '' || isNaN(n)) return `${label} is required`
        if (n < 0) return 'Cannot be negative'
        if (n > max) return `Max ${max} per 100g`
        return null
    }

    function validateCustom() {
        const errs: Record<string, string> = {}
        const calErr = validateMacro(custom.calories, 'Calories', 900)
        const proErr = validateMacro(custom.protein, 'Protein', 100)
        const carErr = validateMacro(custom.carbs, 'Carbs', 100)
        const fatErr = validateMacro(custom.fat, 'Fats', 100)
        if (calErr) errs.calories = calErr
        if (proErr) errs.protein = proErr
        if (carErr) errs.carbs = carErr
        if (fatErr) errs.fat = fatErr
        setCustomErrors(errs)
        return Object.keys(errs).length === 0
    }

    async function estimateMacros() {
        if (!custom.name.trim()) return
        setEstimating(true)
        setEstimateError(null)
        setEstimateSuccess(false)
        try {
            const res = await fetch('/api/food-items/estimate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: custom.name.trim() }),
            })
            if (res.status === 422) {
                const body = await res.json()
                if (body.error === 'unrecognised_food') {
                    setEstimateError(`Couldn't recognise "${custom.name.trim()}" as a food. Try a more specific name — e.g. "chicken rice", "McSpicy", or "protein shake".`)
                    return
                }
            }
            if (!res.ok) throw new Error('ai_unavailable')
            const data = await res.json()
            setCustom(p => ({
                ...p,
                calories: String(data.calories_per_100g),
                protein:  String(data.protein_g),
                carbs:    String(data.carbs_g),
                fat:      String(data.fat_g),
            }))
            // Store suggested portion — will pre-fill quantity in the details stage
            if (data.typical_serving_g) setSuggestedQty(data.typical_serving_g)
            setCustomErrors({})
            // Brief success animation on the button
            setEstimateSuccess(true)
            setTimeout(() => setEstimateSuccess(false), 1400)
        } catch {
            setEstimateError('AI is unavailable right now — please enter macros manually.')
        } finally {
            setEstimating(false)
        }
    }

    function reset() {
        setStage('pick')
        setQuery('')
        setResults([])
        setSearching(false)
        setSelected(null)
        setQuantity('100')
        setQuantityError(null)
        setMealType(detectMealType())
        setNotes('')
        setError(null)
        setCustom({ name: '', calories: '', protein: '', carbs: '', fat: '', is_cookhouse_item: false })
        setCustomErrors({})
        setEstimating(false)
        setEstimateError(null)
        setEstimateSuccess(false)
        setSuggestedQty(null)
    }

    useEffect(() => { if (!open) reset() }, [open])

    // Debounced search — queries DB (cookhouse items first)
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
        if (!query.trim()) { setResults([]); setSearching(false); return }
        setSearching(true)
        debounceRef.current = setTimeout(async () => {
            const q = encodeURIComponent(query.trim())
            const res = await fetch(`/api/food-items?q=${q}`).catch(() => null)
            const data: FoodItem[] = res ? await res.json() : []
            setResults((data ?? []).map(i => ({ ...i, source: 'db' as const })))
            setSearching(false)
        }, 280)
    }, [query])

    function selectTemplate(t: Template) {
        // Navigate to details immediately using template data.
        // The food item will be created/looked up in the DB during submit.
        setSelected({ name: t.name, calories_per_100g: t.calories_per_100g, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g, is_cookhouse_item: false })
        setStage('details')
    }

    function selectSearchResult(item: SearchResult) {
        setSelected(item)
        setQuery('')
        setResults([])
        setStage('details')
    }

    async function createCustomAndProceed() {
        if (!validateCustom()) return
        setSubmitting(true)
        const res = await fetch('/api/food-items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: custom.name,
                calories_per_100g: parseFloat(custom.calories),
                protein_g: parseFloat(custom.protein),
                carbs_g: parseFloat(custom.carbs),
                fat_g: parseFloat(custom.fat),
                is_cookhouse_item: custom.is_cookhouse_item,
                created_by: user?.id,
            }),
        })
        setSubmitting(false)
        if (!res.ok) { setError('Failed to create food item'); return }
        const item: FoodItem = await res.json()
        setSelected(item)
        // Apply AI-suggested portion size if available
        if (suggestedQty) setQuantity(String(suggestedQty))
        setStage('details')
    }

    async function handleSubmit() {
        const qErr = validateQuantity(quantity)
        if (qErr) { setQuantityError(qErr); return }
        if (!user || !selected) return
        setSubmitting(true)
        setError(null)

        // Resolve food item ID — template selections don't have one yet
        let foodItemId = 'id' in selected ? selected.id : null
        if (!foodItemId) {
            const res = await fetch('/api/food-items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: selected.name, calories_per_100g: selected.calories_per_100g, protein_g: selected.protein_g, carbs_g: selected.carbs_g, fat_g: selected.fat_g, created_by: user.id }),
            })
            if (!res.ok) { setError('Failed to save food item'); setSubmitting(false); return }
            const item: FoodItem = await res.json()
            foodItemId = item.id
        }

        const { error: insertError } = await supabase.from('meal_logs').insert({
            user_id: user.id,
            food_item_id: foodItemId,
            quantity_g: parseFloat(quantity),
            meal_type: mealType,
            notes: notes.trim() || null,
        })
        setSubmitting(false)
        if (insertError) { setError(insertError.message); return }
        onLogged?.()
        onOpenChange(false)
    }

    const quantityNum = parseFloat(quantity) || 0
    const factor = quantityNum / 100
    const macros = selected ? {
        calories: Math.round(selected.calories_per_100g * factor),
        protein: parseFloat((selected.protein_g * factor).toFixed(1)),
        carbs:   parseFloat((selected.carbs_g   * factor).toFixed(1)),
        fat:     parseFloat((selected.fat_g     * factor).toFixed(1)),
    } : null

    const caloriesAfter = (dailyTotals?.calories ?? 0) + (macros?.calories ?? 0)
    const proteinAfter  = parseFloat(((dailyTotals?.protein ?? 0) + (macros?.protein ?? 0)).toFixed(1))
    const calPct = targets?.calories ? Math.min(100, Math.round((caloriesAfter / targets.calories) * 100)) : null
    const protPct = targets?.protein ? Math.min(100, Math.round((proteinAfter / targets.protein) * 100)) : null
    const insightGood = targets && macros
        ? macros.protein >= (targets.protein - (dailyTotals?.protein ?? 0)) * 0.25
        : false

    const customValid = custom.name.trim() && custom.calories && custom.protein && custom.carbs && custom.fat

    const QUICK_QUANTITIES = ['50', '100', '150', '200', '250', '300']
    const MEAL_TYPES: { value: MealType; label: string }[] = [
        { value: 'breakfast', label: 'Breakfast' },
        { value: 'lunch', label: 'Lunch' },
        { value: 'dinner', label: 'Dinner' },
        { value: 'snack', label: 'Snack' },
    ]

    const templateCategories = Array.from(new Set(templates.map(t => t.category)))
    const visibleTemplates = templates.filter(t => t.category === activeCategory)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden flex flex-col max-h-[90vh]">

                {/* ── Header ── */}
                <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
                    <DialogTitle className="text-base font-semibold">
                        {stage === 'pick' && 'Log a meal'}
                        {stage === 'custom' && 'Add custom food'}
                        {stage === 'details' && (selected?.name ?? 'Meal details')}
                    </DialogTitle>
                </DialogHeader>

                {/* ── Stage: food picker ── */}
                {stage === 'pick' && (
                    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                        {/* Search bar — sticky at top */}
                        <div className="px-5 pt-4 pb-3 flex-shrink-0">
                            <div className="relative">
                                <svg
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                                    viewBox="0 0 24 24" width={15} height={15} fill="none"
                                    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                                >
                                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                <Input
                                    className="pl-9"
                                    placeholder="Search food..."
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    autoFocus
                                />
                                {query && (
                                    <button
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        onClick={() => setQuery('')}
                                    >
                                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search results */}
                        {query ? (
                            <div className="px-5 pb-4 flex-1 overflow-y-auto">
                                {searching && (
                                    <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                                        <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                                        Searching…
                                    </div>
                                )}
                                {!searching && results.length > 0 && (
                                    <div className="space-y-1">
                                        {results.map(item => (
                                            <button
                                                key={item.id}
                                                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-accent text-left transition-colors"
                                                onClick={() => selectSearchResult(item)}
                                            >
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {item.calories_per_100g} kcal · {item.protein_g}g P · {item.carbs_g}g C · {item.fat_g}g F per 100g
                                                    </div>
                                                </div>
                                                {item.is_cookhouse_item && (
                                                    <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full ml-2 shrink-0">
                                                        Cookhouse
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {!searching && results.length === 0 && (
                                    <div className="py-6 text-center">
                                        <p className="text-sm text-muted-foreground mb-3">No results for &ldquo;{query}&rdquo;</p>
                                        <Button variant="outline" size="sm" onClick={() => { setStage('custom'); setCustom(p => ({ ...p, name: query })) }}>
                                            + Add custom food
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Template browser */
                            <div className="flex flex-col flex-1 min-h-0 overflow-hidden scrollbar-hide">
                                {/* Category pills */}
                                <div className="px-5 pb-2 flex gap-2 overflow-x-auto scrollbar-none flex-shrink-0">
                                    {templateCategories.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setActiveCategory(cat)}
                                            className={cn(
                                                'text-xs font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors',
                                                activeCategory === cat
                                                    ? 'bg-primary text-white'
                                                    : 'bg-muted text-muted-foreground hover:text-foreground'
                                            )}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>

                                {/* Template grid */}
                                <div className="flex-1 overflow-y-auto px-5 pb-4 pt-2">
                                    <div className="grid grid-cols-3 gap-2">
                                        {visibleTemplates.map(t => (
                                            <button
                                                key={t.name}
                                                onClick={() => selectTemplate(t)}
                                                className={cn(
                                                    'relative flex flex-col gap-1 p-3 rounded-xl border border-border bg-card text-left',
                                                    'hover:border-primary/50 hover:bg-accent/50 transition-colors',
                                                    'active:scale-[0.97]'
                                                )}
                                            >
                                                <span className="text-[12px] font-semibold text-foreground leading-tight line-clamp-2">
                                                    {t.name}
                                                </span>
                                                <span className="text-[11px] font-bold text-primary mt-auto">
                                                    {t.calories_per_100g} kcal
                                                </span>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {t.protein_g}g P · {t.carbs_g}g C · {t.fat_g}g F
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/60">per 100g</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Custom food link */}
                                <div className="px-5 py-3 border-t border-border flex-shrink-0">
                                    <button
                                        className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
                                        onClick={() => setStage('custom')}
                                    >
                                        Can&rsquo;t find it? <span className="text-primary font-medium">Add custom food</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ── Stage: custom food form ── */}
                {stage === 'custom' && (
                    <div className="px-6 pt-4 pb-6 space-y-4 overflow-y-auto flex-1">
                        <BackButton onClick={() => setStage('pick')} />
                        <p className="text-sm text-muted-foreground">
                            Enter nutritional values per 100g. This food will be saved for future use.
                        </p>
                        <Input
                            placeholder="Food name"
                            value={custom.name}
                            onChange={e => setCustom(p => ({ ...p, name: e.target.value }))}
                            autoFocus
                        />
                        {/* AI macro estimation — pre-fills the four macro fields */}
                        <div>
                            <button
                                type="button"
                                onClick={estimateMacros}
                                disabled={!custom.name.trim() || estimating}
                                className={cn(
                                    'w-full flex items-center justify-center gap-2 h-9 rounded-xl border text-[13px] font-medium',
                                    custom.name.trim() && !estimating
                                        ? estimateSuccess
                                            ? 'ai-glow-button ai-glow-button-success text-success border-success/50'
                                            : 'ai-glow-button text-primary'
                                        : 'border-border text-muted-foreground opacity-40 cursor-not-allowed'
                                )}
                            >
                                {estimating ? (
                                    <>
                                        <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-primary border-t-transparent animate-spin" />
                                        <span>Analysing with AI…</span>
                                    </>
                                ) : estimateSuccess ? (
                                    <>
                                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M5 12l5 5L20 7" />
                                        </svg>
                                        Macros filled in
                                    </>
                                ) : (
                                    <>
                                        {/* Sparkles icon */}
                                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                                            <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
                                        </svg>
                                        Estimate macros with AI
                                    </>
                                )}
                            </button>
                            {/* Inline error below button — shown when AI fails or doesn't recognise the food */}
                            {estimateError && (
                                <div className="flex items-start gap-2 mt-2 px-1">
                                    <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-warning mt-0.5 flex-shrink-0">
                                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                                    </svg>
                                    <p className="text-[12px] text-warning leading-relaxed">{estimateError}</p>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {([
                                { key: 'calories' as const, label: 'Calories', unit: 'kcal', max: 900 },
                                { key: 'protein' as const, label: 'Protein', unit: 'g', max: 100 },
                                { key: 'carbs' as const, label: 'Carbs', unit: 'g', max: 100 },
                                { key: 'fat' as const, label: 'Fats', unit: 'g', max: 100 },
                            ]).map(({ key, label, unit, max }) => (
                                <div key={key}>
                                    <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">
                                        {label} / 100g ({unit})
                                    </label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        min={0}
                                        max={max}
                                        value={custom[key]}
                                        onChange={e => {
                                            setCustom(p => ({ ...p, [key]: e.target.value }))
                                            const err = validateMacro(e.target.value, label, max)
                                            setCustomErrors(prev => ({ ...prev, [key]: err ?? '' }))
                                        }}
                                        className={customErrors[key] ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                                    />
                                    {customErrors[key] && <p className="text-xs text-destructive mt-1">{customErrors[key]}</p>}
                                </div>
                            ))}
                        </div>
                        {/* Cookhouse meal toggle */}
                        <button
                            type="button"
                            onClick={() => setCustom(p => ({ ...p, is_cookhouse_item: !p.is_cookhouse_item }))}
                            className={cn(
                                'w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left',
                                custom.is_cookhouse_item
                                    ? 'border-primary/50 bg-primary/8'
                                    : 'border-border bg-muted/30 hover:border-border/80'
                            )}
                        >
                            <div className={cn(
                                'w-9 h-5 rounded-full relative transition-colors flex-shrink-0',
                                custom.is_cookhouse_item ? 'bg-primary' : 'bg-muted-foreground/30'
                            )}>
                                <div className={cn(
                                    'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform',
                                    custom.is_cookhouse_item ? 'translate-x-4' : 'translate-x-0.5'
                                )} />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-foreground">Cookhouse meal</div>
                                <div className="text-[11px] text-muted-foreground">Visible to all users in your unit</div>
                            </div>
                        </button>

                        {error && <p className="text-sm text-destructive">{error}</p>}
                        <Button
                            className="w-full"
                            disabled={!customValid || submitting}
                            onClick={createCustomAndProceed}
                        >
                            {submitting ? 'Saving…' : 'Continue to serving size'}
                        </Button>
                    </div>
                )}

                {/* ── Stage: meal details ── */}
                {stage === 'details' && selected && (
                    <div className="px-6 pt-4 pb-6 space-y-5 overflow-y-auto flex-1">
                        <BackButton onClick={() => { setSelected(null); setStage('pick') }} />

                        {/* Selected food chip */}
                        <div className="bg-muted/50 border border-border rounded-xl px-4 py-3">
                            <div className="text-sm font-semibold text-foreground">{selected.name}</div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                                Per 100g — {selected.calories_per_100g} kcal · {selected.protein_g}g P · {selected.carbs_g}g C · {selected.fat_g}g F
                            </div>
                        </div>

                        {/* Quantity */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[12px] font-medium text-muted-foreground">
                                    Serving size (g)
                                </label>
                                {suggestedQty && quantity === String(suggestedQty) && (
                                    <span className="text-[10px] font-medium text-primary/80 flex items-center gap-1">
                                        <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M12 2a8 8 0 0 1 8 8c0 3-1.5 5.5-4 7l-1 5H9l-1-5C5.5 15.5 4 13 4 10a8 8 0 0 1 8-8z" />
                                            <line x1="9" y1="17" x2="15" y2="17" />
                                        </svg>
                                        AI suggested
                                    </span>
                                )}
                            </div>
                            <Input
                                type="number"
                                placeholder="100"
                                value={quantity}
                                onChange={e => { setQuantity(e.target.value); setQuantityError(validateQuantity(e.target.value)) }}
                                min={1}
                                max={5000}
                                className={quantityError ? 'border-destructive focus-visible:ring-destructive/30' : ''}
                            />
                            {quantityError && <p className="text-xs text-destructive mt-1">{quantityError}</p>}
                            {/* Quick-select pills */}
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                                {QUICK_QUANTITIES.map(q => (
                                    <button
                                        key={q}
                                        onClick={() => setQuantity(q)}
                                        className={cn(
                                            'text-xs px-2.5 py-1 rounded-full border transition-colors',
                                            quantity === q
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                                        )}
                                    >
                                        {q}g
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Live macros */}
                        {macros && quantityNum > 0 && (
                            <div className="bg-card border border-border rounded-xl px-3 py-3 flex divide-x divide-border">
                                <MacroStat label="Calories" value={macros.calories}           unit="kcal" />
                                <MacroStat label="Protein"  value={parseFloat(fmt(macros.protein))} unit="g" highlight />
                                <MacroStat label="Carbs"    value={parseFloat(fmt(macros.carbs))}   unit="g" />
                                <MacroStat label="Fats"     value={parseFloat(fmt(macros.fat))}     unit="g" />
                            </div>
                        )}

                        {/* Daily insight */}
                        {macros && targets && quantityNum > 0 && (
                            <div className={cn(
                                'text-[12px] rounded-xl px-4 py-2.5 border leading-relaxed',
                                insightGood
                                    ? 'bg-success/10 border-success/30 text-success'
                                    : 'bg-muted/40 border-border text-muted-foreground'
                            )}>
                                After this meal →{' '}
                                <span className="font-semibold text-foreground">{caloriesAfter.toLocaleString()} / {targets.calories.toLocaleString()} kcal</span>
                                {' '}&nbsp;·&nbsp;{' '}
                                <span className="font-semibold text-foreground">{proteinAfter}g / {targets.protein}g protein</span>
                                {calPct !== null && protPct !== null && (
                                    <span className="ml-1 opacity-60">({calPct}% · {protPct}%)</span>
                                )}
                            </div>
                        )}

                        {/* Meal type — pill buttons */}
                        <div>
                            <label className="text-[12px] font-medium text-muted-foreground mb-2 block">Meal type</label>
                            <div className="grid grid-cols-4 gap-2">
                                {MEAL_TYPES.map(({ value, label }) => (
                                    <button
                                        key={value}
                                        onClick={() => setMealType(value)}
                                        className={cn(
                                            'py-2 rounded-xl text-xs font-medium border transition-colors',
                                            mealType === value
                                                ? 'bg-primary text-white border-primary'
                                                : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                        )}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div>
                            <label className="text-[12px] font-medium text-muted-foreground mb-1.5 block">
                                Notes <span className="opacity-50">(optional)</span>
                            </label>
                            <textarea
                                rows={2}
                                placeholder="e.g. estimated portion, extra sauce..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className={cn(
                                    'flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800',
                                    'placeholder:text-gray-400 resize-none transition-colors',
                                    'hover:border-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/12',
                                    'dark:bg-[#0D1F3C] dark:border-[#344563] dark:text-gray-100',
                                    'dark:placeholder:text-[#6B778C] dark:hover:border-[#505F79]',
                                    'dark:focus:border-primary dark:focus:ring-primary/20'
                                )}
                            />
                        </div>

                        {error && <p className="text-sm text-destructive">{error}</p>}

                        <Button
                            className="w-full"
                            disabled={!selected || quantityNum <= 0 || submitting}
                            onClick={handleSubmit}
                        >
                            {submitting ? 'Logging…' : 'Log meal'}
                        </Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
