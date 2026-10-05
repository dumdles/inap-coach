'use client'

// Create-challenge form for instructors (own wing) and superadmins (any wing
// or all wings). Validation is the same validateChallenge() the API runs, so
// inline errors here match the server's 400s exactly.

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateTimePicker } from '@/components/ui/date-time-picker'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/auth-fetch'
import { useData } from '@/lib/use-data'
import { cn } from '@/lib/utils'
import {
    CHALLENGE_METRICS, METRIC_KEYS, LIMITS, AWARD_SHARES, validateChallenge,
    type Challenge, type ChallengeInput,
} from '@/lib/challenges'

const ALL = '__all__'

// DateTimePicker works in local "YYYY-MM-DDTHH:MM"; the app runs on SGT, so
// pin the offset explicitly before sending to the server.
const toIso = (v: string) => (v ? `${v}:00+08:00` : '')
function sgLocal(ms: number) {
    return new Date(ms + 8 * 3600_000).toISOString().slice(0, 16)
}

type Form = {
    title: string; description: string; metric: string
    format: 'individual' | 'team'; team_level: string
    scope_wing: string; scope_platoon: string
    starts_at: string; ends_at: string; bonus_points: string
    exercise_ids: string[]
}

// Exercises a "Reps" challenge can count: templates logged as sets × reps.
type RepExercise = { id: string; name: string }
// The SCF Meal Time Regime — push-ups, sit-ups, pull-ups before each meal.
// Matched by name, ignoring case/spaces/hyphens (docs/challenges_reps_migration.sql seeds them).
const MTR_NAMES = ['pushups', 'situps', 'pullups']
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

function initialForm(myWing: string | null, isSuperadmin: boolean, editing?: Challenge | null): Form {
    if (editing) return {
        title: editing.title, description: editing.description ?? '', metric: editing.metric,
        format: editing.format, team_level: editing.team_level ?? 'section',
        scope_wing: editing.scope_wing ?? ALL, scope_platoon: editing.scope_platoon ?? '',
        starts_at: sgLocal(Date.parse(editing.starts_at)), ends_at: sgLocal(Date.parse(editing.ends_at)),
        bonus_points: String(editing.bonus_points), exercise_ids: editing.exercise_ids ?? [],
    }
    const nextHour = Math.ceil(Date.now() / 3600_000) * 3600_000
    return {
        title: '', description: '', metric: 'distance_km', format: 'individual', team_level: 'section',
        scope_wing: isSuperadmin ? ALL : (myWing ?? ''), scope_platoon: '',
        starts_at: sgLocal(nextHour), ends_at: sgLocal(nextHour + 7 * 86400_000), bonus_points: '50',
        exercise_ids: [],
    }
}

/**
 * Create a challenge, or edit one when `editing` is passed. Once a challenge is
 * live only its title, description, end time and bonus can change (the rest is
 * shown but locked — see LIVE_EDITABLE in lib/challenges.ts).
 */
export function CreateChallengeDialog({ open, onClose, onCreated, myWing, isSuperadmin, editing }: {
    open: boolean; onClose: () => void; onCreated: (c: Challenge) => void
    myWing: string | null; isSuperadmin: boolean
    editing?: Challenge | null
}) {
    const [form, setForm] = useState<Form>(() => initialForm(myWing, isSuperadmin, editing))
    // Captured when the dialog opens (not during render) so "is it live?" stays pure.
    const [openedAt, setOpenedAt] = useState(0)
    const locked = !!editing && openedAt >= Date.parse(editing.starts_at)
    const [touched, setTouched] = useState<Record<string, boolean>>({})
    const [wings, setWings] = useState<string[]>([])
    const [saving, setSaving] = useState(false)

    // Rep-countable exercises (cached, lib/use-data.ts) — only fetched while the dialog is open.
    const { data: repExercises = [] } = useData<RepExercise[]>(open ? 'templates:challenge-reps' : null, async () => {
        const { data, error } = await supabase.from('exercise_templates').select('id, name, fields').order('sort_order')
        if (error) throw error
        return (data ?? []).filter(t => (t.fields as { sets_reps?: boolean } | null)?.sets_reps).map(t => ({ id: t.id, name: t.name }))
    })
    const mtrIds = repExercises.filter(e => MTR_NAMES.includes(norm(e.name))).map(e => e.id)

    useEffect(() => {
        if (!open) return
        queueMicrotask(() => { setForm(initialForm(myWing, isSuperadmin, editing)); setTouched({}); setOpenedAt(Date.now()) })
        if (isSuperadmin) supabase.from('ocs_wings').select('name').order('name').then(({ data }) => setWings((data ?? []).map(w => w.name)))
    }, [open, myWing, isSuperadmin, editing])

    const payload: ChallengeInput = {
        title: form.title, description: form.description || null, metric: form.metric,
        format: form.format, team_level: form.format === 'team' ? form.team_level : null,
        scope_wing: form.scope_wing === ALL ? null : form.scope_wing || null,
        scope_platoon: form.scope_platoon.trim() || null,
        // A live challenge keeps its exact original start (the picker drops seconds).
        starts_at: locked ? editing!.starts_at : toIso(form.starts_at), ends_at: toIso(form.ends_at),
        bonus_points: form.bonus_points === '' ? NaN : Number(form.bonus_points),
        exercise_ids: form.metric === 'reps' ? form.exercise_ids : null,
    }
    const errors = validateChallenge(payload, undefined, editing ?? undefined) // cheap — just recompute every render
    // Show a field's error once it has been edited (or on submit).
    const err = (k: string) => (touched[k] || touched.__all ? errors[k] : undefined)

    const set = <K extends keyof Form>(k: K, v: Form[K]) => {
        setForm(f => ({ ...f, [k]: v }))
        setTouched(t => ({ ...t, [k]: true }))
    }

    async function submit() {
        setTouched({ __all: true })
        if (Object.keys(errors).length) return
        setSaving(true)
        const res = await authFetch(editing ? `/api/challenges/${editing.id}` : '/api/challenges', {
            method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        const json = await res.json().catch(() => ({}))
        setSaving(false)
        if (!res.ok) { toast.error(json.error ?? (editing ? 'Could not save changes' : 'Could not create challenge')); return }
        toast.success(editing ? 'Challenge updated' : 'Challenge created — cadets have been notified')
        onCreated(json)
        onClose()
    }

    const inputCls = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40'
    const labelCls = 'text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block'
    const errText = (k: string) => err(k) ? <p className="text-[11px] text-danger mt-1">{err(k)}</p> : null
    const bonus = Number(form.bonus_points) || 0
    const groups = [...new Set(METRIC_KEYS.map(k => CHALLENGE_METRICS[k].group))]

    return (
        <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-[17px]">{editing ? 'Edit challenge' : 'New challenge'}</DialogTitle>
                    <p className="text-[13px] text-muted-foreground mt-0.5">
                        {locked ? 'It’s live, so only the title, description, end time and bonus can change — the rest stays fair for everyone already competing.'
                            : 'Cadets in scope are enrolled automatically and scored from what they already log.'}
                    </p>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    <div>
                        <label className={labelCls}>Title</label>
                        <input className={cn(inputCls, err('title') && 'border-danger')} value={form.title} maxLength={LIMITS.titleMax}
                            placeholder="e.g. Hawk Wing 50 km week" onChange={e => set('title', e.target.value)} />
                        {errText('title')}
                    </div>

                    <div>
                        <label className={labelCls}>Description <span className="normal-case font-normal">(optional)</span></label>
                        <textarea className={cn(inputCls, 'h-20 py-2 resize-none', err('description') && 'border-danger')} value={form.description}
                            maxLength={LIMITS.descriptionMax} placeholder="What's the goal? Any rules?" onChange={e => set('description', e.target.value)} />
                        {errText('description')}
                    </div>

                    {/* Locked once live: what's measured, who competes, and who's in. */}
                    <fieldset disabled={locked} className={cn('space-y-4 min-w-0', locked && 'opacity-60')}>
                    <div>
                        <label className={labelCls}>Measure</label>
                        <Select value={form.metric} onValueChange={v => {
                            set('metric', v)
                            // Picking "Reps" starts from the MTR set (push-ups, sit-ups, pull-ups) if available.
                            if (v === 'reps' && form.exercise_ids.length === 0 && mtrIds.length) setForm(f => ({ ...f, exercise_ids: mtrIds }))
                        }}>
                            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {groups.map(g => (
                                    <SelectGroup key={g}>
                                        <SelectLabel>{g}</SelectLabel>
                                        {METRIC_KEYS.filter(k => CHALLENGE_METRICS[k].group === g).map(k => (
                                            <SelectItem key={k} value={k}>{CHALLENGE_METRICS[k].label}</SelectItem>
                                        ))}
                                    </SelectGroup>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground mt-1">{CHALLENGE_METRICS[form.metric as keyof typeof CHALLENGE_METRICS]?.hint}</p>
                        {errText('metric')}
                    </div>

                    {form.metric === 'reps' && (
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <label className={cn(labelCls, 'mb-0')}>Exercises to count</label>
                                {mtrIds.length > 0 && (
                                    <button type="button" onClick={() => set('exercise_ids', mtrIds)}
                                        className="text-[12px] font-medium text-primary hover:underline">Use MTR set</button>
                                )}
                            </div>
                            {repExercises.length === 0 ? (
                                <p className="text-[12px] text-muted-foreground">No rep-based exercises yet — run docs/challenges_reps_migration.sql to add Push-ups, Sit-ups and Pull-ups.</p>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {repExercises.map(ex => {
                                        const on = form.exercise_ids.includes(ex.id)
                                        return (
                                            <button key={ex.id} type="button" aria-pressed={on}
                                                onClick={() => set('exercise_ids', on ? form.exercise_ids.filter(x => x !== ex.id) : [...form.exercise_ids, ex.id])}
                                                className={cn('h-8 px-3 rounded-full border text-[13px] transition-colors',
                                                    on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border hover:border-foreground/30')}>
                                                {ex.name}
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                            <p className="text-[11px] text-muted-foreground mt-1">Reps of all picked exercises add up. Cadets can quick-log them from the challenge page.</p>
                            {errText('exercise_ids')}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Who competes</label>
                            <div className="flex bg-muted dark:bg-background rounded-xl p-0.5 gap-0.5">
                                {(['individual', 'team'] as const).map(f => (
                                    <button key={f} type="button" onClick={() => set('format', f)}
                                        className={cn('flex-1 h-9 rounded-[10px] text-[13px] font-medium transition-all',
                                            form.format === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                                        {f === 'individual' ? 'Individuals' : 'Teams'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        {form.format === 'team' && (
                            <div>
                                <label className={labelCls}>Teams are</label>
                                <Select value={form.team_level} onValueChange={v => set('team_level', v)}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="section">Sections</SelectItem>
                                        <SelectItem value="platoon">Platoons</SelectItem>
                                        <SelectItem value="wing">Wings</SelectItem>
                                    </SelectContent>
                                </Select>
                                {errText('team_level')}
                            </div>
                        )}
                    </div>
                    {form.format === 'team' && (
                        <p className="text-[11px] text-muted-foreground -mt-2">Teams are ranked by their members&apos; average, so team size doesn&apos;t matter and everyone counts.</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Wing</label>
                            {isSuperadmin ? (
                                <Select value={form.scope_wing} onValueChange={v => set('scope_wing', v)}>
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={ALL}>All wings</SelectItem>
                                        {wings.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <div className={cn(inputCls, 'flex items-center bg-muted text-muted-foreground')}>{myWing ?? '—'} (your wing)</div>
                            )}
                        </div>
                        <div>
                            <label className={labelCls}>Platoon <span className="normal-case font-normal">(optional)</span></label>
                            <input className={cn(inputCls, err('scope_platoon') && 'border-danger')} value={form.scope_platoon} maxLength={10}
                                placeholder="All platoons" onChange={e => set('scope_platoon', e.target.value)} />
                            {errText('scope_platoon')}
                        </div>
                    </div>

                    </fieldset>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className={labelCls}>Starts</label>
                            <fieldset disabled={locked} className={cn('min-w-0', locked && 'opacity-60')}>
                                <DateTimePicker value={form.starts_at} onChange={v => set('starts_at', v)} error={!!err('starts_at')} minuteStep={15} />
                            </fieldset>
                            {errText('starts_at')}
                        </div>
                        <div>
                            <label className={labelCls}>Ends</label>
                            <DateTimePicker value={form.ends_at} onChange={v => set('ends_at', v)} error={!!err('ends_at')} minuteStep={15} />
                            {errText('ends_at')}
                        </div>
                    </div>

                    <div>
                        <label className={labelCls}>Bonus points for the winner</label>
                        <input type="number" inputMode="numeric" min={LIMITS.bonusMin} max={LIMITS.bonusMax} step={10}
                            className={cn(inputCls, err('bonus_points') && 'border-danger')} value={form.bonus_points}
                            onChange={e => set('bonus_points', e.target.value)} />
                        {errText('bonus_points')}
                        {!err('bonus_points') && bonus > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                                Added to the wing leaderboard: 1st {Math.round(bonus * AWARD_SHARES[0])} · 2nd {Math.round(bonus * AWARD_SHARES[1])} · 3rd {Math.round(bonus * AWARD_SHARES[2])} pts
                                {form.format === 'team' && ' (each contributing member)'}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={submit} disabled={saving}>{saving ? (editing ? 'Saving…' : 'Creating…') : (editing ? 'Save changes' : 'Create challenge')}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
