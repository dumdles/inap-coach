'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export type IPPTResult = {
    id: string
    test_date: string
    pushup_reps: number | null
    situp_reps: number | null
    run_time_seconds: number | null
    pushup_points: number | null
    situp_points: number | null
    run_points: number | null
    total_points: number
    award: 'gold' | 'silver' | 'pass' | 'fail' | null
    notes: string | null
    created_at: string
}

type Award = 'gold' | 'silver' | 'pass' | 'fail'

const AWARD_META: Record<Award, { label: string; bg: string; text: string; border: string }> = {
    gold:   { label: 'Gold',   bg: 'bg-yellow-400/10', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-400/50' },
    silver: { label: 'Silver', bg: 'bg-slate-400/10',  text: 'text-slate-500 dark:text-slate-300',   border: 'border-slate-400/50'  },
    pass:   { label: 'Pass',   bg: 'bg-success/10',    text: 'text-success',                          border: 'border-success/40'    },
    fail:   { label: 'Fail',   bg: 'bg-danger/10',     text: 'text-danger',                           border: 'border-danger/40'     },
}

// Suggest award tier based on total points (SAF IPPT thresholds)
function suggestAward(pts: number): Award | null {
    if (pts >= 85) return 'gold'
    if (pts >= 75) return 'silver'
    if (pts >= 51) return 'pass'
    if (pts > 0)   return 'fail'
    return null
}

function secondsToRunTime(s: number): string {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
}

function runTimeToSeconds(val: string): number | null {
    const [m, s] = val.split(':').map(Number)
    if (isNaN(m) || isNaN(s) || s >= 60) return null
    return m * 60 + s
}

type Props = {
    open: boolean
    onClose: () => void
    userId: string
    prefillDate?: string   // ISO date from ippt_date
    onSaved: (result: IPPTResult) => void
}

type Form = {
    test_date: string
    pushup_reps: string
    situp_reps: string
    run_time: string        // "mm:ss" display
    pushup_points: string
    situp_points: string
    run_points: string
    award: Award | ''
    notes: string
}

const EMPTY: Form = {
    test_date: '', pushup_reps: '', situp_reps: '', run_time: '',
    pushup_points: '', situp_points: '', run_points: '', award: '', notes: '',
}

export function LogIPPTDialog({ open, onClose, userId, prefillDate, onSaved }: Props) {
    const [form, setForm] = useState<Form>({ ...EMPTY, test_date: prefillDate ?? '' })
    const [saving, setSaving] = useState(false)
    const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})

    function set<K extends keyof Form>(k: K, v: Form[K]) {
        setForm(prev => {
            const next = { ...prev, [k]: v }
            // Auto-suggest award when total changes
            if (['pushup_points', 'situp_points', 'run_points'].includes(k)) {
                const total = [next.pushup_points, next.situp_points, next.run_points]
                    .map(Number).filter(n => !isNaN(n) && n > 0)
                    .reduce((a, b) => a + b, 0)
                if (total > 0 && next.award === '') {
                    const suggested = suggestAward(total)
                    if (suggested) next.award = suggested
                }
            }
            return next
        })
        setErrors(e => ({ ...e, [k]: undefined }))
    }

    const totalPoints = [form.pushup_points, form.situp_points, form.run_points]
        .map(Number).filter(n => !isNaN(n) && n > 0)
        .reduce((a, b) => a + b, 0)

    function validate(): boolean {
        const errs: typeof errors = {}
        if (!form.test_date) errs.test_date = 'Required'
        if (totalPoints === 0) errs.pushup_points = 'Enter at least one station score'
        if (form.run_time && runTimeToSeconds(form.run_time) === null) errs.run_time = 'Use mm:ss format'
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    async function handleSave() {
        if (!validate()) return
        setSaving(true)
        try {
            const run_time_seconds = form.run_time ? runTimeToSeconds(form.run_time) : null
            const res = await fetch('/api/ippt-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    test_date:        form.test_date,
                    pushup_reps:      form.pushup_reps  ? Number(form.pushup_reps)  : null,
                    situp_reps:       form.situp_reps   ? Number(form.situp_reps)   : null,
                    run_time_seconds: run_time_seconds,
                    pushup_points:    form.pushup_points ? Number(form.pushup_points) : null,
                    situp_points:     form.situp_points  ? Number(form.situp_points)  : null,
                    run_points:       form.run_points    ? Number(form.run_points)    : null,
                    total_points:     totalPoints,
                    award:            form.award || null,
                    notes:            form.notes || null,
                }),
            })
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to save')
            const result = await res.json()
            toast.success('IPPT result logged!')
            setForm({ ...EMPTY, test_date: prefillDate ?? '' })
            onSaved(result)
            onClose()
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Something went wrong')
        } finally {
            setSaving(false)
        }
    }

    const inputCls = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40'
    const labelCls = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block'

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-[17px]">Log IPPT Result</DialogTitle>
                    <p className="text-[13px] text-muted-foreground mt-0.5">Record your station scores from the official score sheet.</p>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                    {/* Test date */}
                    <div>
                        <label className={labelCls}>Test Date</label>
                        <DatePicker
                            value={form.test_date}
                            onChange={v => set('test_date', v)}
                            placeholder="Select test date"
                            toDate={new Date()}
                            error={!!errors.test_date}
                        />
                        {errors.test_date && <p className="text-[11px] text-danger mt-1">{errors.test_date}</p>}
                    </div>

                    {/* Station inputs */}
                    <div>
                        <p className={cn(labelCls, 'mb-3')}>Station Results</p>
                        <div className="space-y-3">
                            {/* Push-up */}
                            <div className="rounded-xl border border-border bg-muted/30 p-4">
                                <p className="text-[12px] font-semibold text-foreground mb-3">Push-up</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Reps</label>
                                        <input type="number" min={0} max={100} placeholder="e.g. 42"
                                            value={form.pushup_reps} onChange={e => set('pushup_reps', e.target.value)}
                                            className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Points</label>
                                        <input type="number" min={0} max={30} placeholder="e.g. 20"
                                            value={form.pushup_points} onChange={e => set('pushup_points', e.target.value)}
                                            className={cn(inputCls, errors.pushup_points && 'border-danger')} />
                                    </div>
                                </div>
                            </div>

                            {/* Sit-up */}
                            <div className="rounded-xl border border-border bg-muted/30 p-4">
                                <p className="text-[12px] font-semibold text-foreground mb-3">Sit-up</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Reps</label>
                                        <input type="number" min={0} max={100} placeholder="e.g. 38"
                                            value={form.situp_reps} onChange={e => set('situp_reps', e.target.value)}
                                            className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Points</label>
                                        <input type="number" min={0} max={30} placeholder="e.g. 18"
                                            value={form.situp_points} onChange={e => set('situp_points', e.target.value)}
                                            className={inputCls} />
                                    </div>
                                </div>
                            </div>

                            {/* 2.4km run */}
                            <div className="rounded-xl border border-border bg-muted/30 p-4">
                                <p className="text-[12px] font-semibold text-foreground mb-3">2.4 km Run</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className={labelCls}>Time (mm:ss)</label>
                                        <input type="text" placeholder="e.g. 10:30"
                                            value={form.run_time} onChange={e => set('run_time', e.target.value)}
                                            className={cn(inputCls, errors.run_time && 'border-danger')} />
                                        {errors.run_time && <p className="text-[11px] text-danger mt-1">{errors.run_time}</p>}
                                    </div>
                                    <div>
                                        <label className={labelCls}>Points</label>
                                        <input type="number" min={0} max={50} placeholder="e.g. 25"
                                            value={form.run_points} onChange={e => set('run_points', e.target.value)}
                                            className={inputCls} />
                                    </div>
                                </div>
                            </div>
                        </div>
                        {errors.pushup_points && <p className="text-[11px] text-danger mt-2">{errors.pushup_points}</p>}
                    </div>

                    {/* Total + award summary */}
                    {totalPoints > 0 && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 flex items-center justify-between">
                            <span className="text-[13px] font-semibold text-foreground">Total Points</span>
                            <span className="font-display font-extrabold text-[22px] text-primary">{totalPoints}</span>
                        </div>
                    )}

                    {/* Award */}
                    <div>
                        <label className={labelCls}>Award</label>
                        <div className="grid grid-cols-4 gap-2">
                            {(Object.keys(AWARD_META) as Award[]).map(a => (
                                <button
                                    key={a}
                                    type="button"
                                    onClick={() => set('award', a)}
                                    className={cn(
                                        'rounded-xl py-2 text-[12px] font-semibold border transition-all',
                                        form.award === a
                                            ? cn(AWARD_META[a].bg, AWARD_META[a].text, AWARD_META[a].border)
                                            : 'border-border text-muted-foreground hover:border-border/80',
                                    )}
                                >
                                    {AWARD_META[a].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Notes */}
                    <div>
                        <label className={labelCls}>Notes (optional)</label>
                        <textarea
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            placeholder="e.g. Felt strong on run, need to work on push-ups"
                            rows={2}
                            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                        />
                    </div>

                    <Button onClick={handleSave} disabled={saving} className="w-full">
                        {saving ? 'Saving…' : 'Save Result'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

// Exported helper so other components can render an award badge
export function AwardBadge({ award }: { award: string | null }) {
    if (!award || !(award in AWARD_META)) return null
    const m = AWARD_META[award as Award]
    return (
        <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border', m.bg, m.text, m.border)}>
            {m.label}
        </span>
    )
}

export { secondsToRunTime, AWARD_META }
export type { Award }
