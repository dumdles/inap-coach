'use client'

// ── Quick log for reps challenges (e.g. MTR) ──────────────────────────────────
// One tap logs a set of every exercise the challenge counts — e.g. the Meal
// Time Regime's 20 push-ups, 20 sit-ups and 10 pull-ups before a meal. Each
// exercise becomes a normal workout log (1 set × N reps) via POST
// /api/workout-logs, so it also shows on the Workouts page and counts towards
// any other challenge. Rep limits match the API (0–1000).

import React, { useState } from 'react'
import { Minus, Plus, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/lib/auth-fetch'
import { refreshData } from '@/lib/data-cache'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'

const MAX_REPS = 1000
// Default counts per set, by exercise name (MTR standard), else 10.
const DEFAULT_REPS: Record<string, number> = { pushups: 20, situps: 20, pullups: 10 }
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

export type RepEntry = { id: string; name: string; reps: number }

export function QuickLogReps({ exercises, todayReps, onLogged, submit }: {
    exercises: { id: string; name: string }[]
    todayReps: number | null // reps already logged today (from the race data), for the "today" counter
    onLogged: (total: number) => void // called after a successful log, with the reps added
    submit?: (rows: RepEntry[]) => Promise<boolean> // override saving (the demo keeps it local)
}) {
    const { user } = useAuth()
    const [reps, setReps] = useState<Record<string, string>>(
        () => Object.fromEntries(exercises.map(e => [e.id, String(DEFAULT_REPS[norm(e.name)] ?? 10)])),
    )
    const [saving, setSaving] = useState(false)
    const [justLogged, setJustLogged] = useState<number | null>(null)

    // Inline validation: whole number 0–1000 per exercise.
    const errorFor = (v: string) => {
        if (v === '') return null
        const n = Number(v)
        return Number.isInteger(n) && n >= 0 && n <= MAX_REPS ? null : `0–${MAX_REPS}`
    }
    const errors = Object.fromEntries(exercises.map(e => [e.id, errorFor(reps[e.id] ?? '')]))
    const total = exercises.reduce((a, e) => a + (errors[e.id] ? 0 : Number(reps[e.id] || 0)), 0)
    const invalid = Object.values(errors).some(Boolean)

    const step = (id: string, d: number) => setReps(r => ({ ...r, [id]: String(Math.min(MAX_REPS, Math.max(0, Number(r[id] || 0) + d))) }))

    async function logSet() {
        if (!user || invalid || total <= 0) return
        setSaving(true)
        const rows: RepEntry[] = exercises.filter(e => Number(reps[e.id] || 0) > 0).map(e => ({ id: e.id, name: e.name, reps: Number(reps[e.id]) }))
        const ok = submit ? await submit(rows) : await saveToApi(user.id, rows)
        setSaving(false)
        if (!ok) { toast.error('Some sets could not be logged — try again'); return }
        toast.success(`+${total} reps logged 💪`)
        setJustLogged(total)
        // The parent bumps the score on screen straight away; when saved for
        // real, also refresh the challenge list and anything showing workouts.
        onLogged(total)
        if (!submit) {
            void refreshData('/api/challenges')
            void refreshData('/api/workout-logs')
            void refreshData('workouts:')
        }
    }

    async function saveToApi(userId: string, rows: RepEntry[]) {
        const results = await Promise.all(rows.map(e => authFetch('/api/workout-logs', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, templateId: e.id, name: e.name, source: 'manual', sets: 1, reps: e.reps }),
        }).then(r => r.ok).catch(() => false)))
        return results.every(Boolean)
    }

    return (
        <div>
            <div className="grid gap-2 sm:grid-cols-3">
                {exercises.map(e => (
                    <div key={e.id} className={cn('rounded-xl border p-3', errors[e.id] ? 'border-danger' : 'border-border')}>
                        <div className="text-[12px] font-medium text-muted-foreground truncate">{e.name}</div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                            <button type="button" onClick={() => step(e.id, -5)} aria-label={`5 fewer ${e.name}`}
                                className="w-8 h-8 rounded-lg bg-muted dark:bg-background text-foreground inline-flex items-center justify-center hover:bg-muted/70"><Minus size={14} /></button>
                            <input inputMode="numeric" aria-label={`${e.name} reps`} value={reps[e.id] ?? ''}
                                onChange={ev => setReps(r => ({ ...r, [e.id]: ev.target.value.replace(/[^0-9]/g, '') }))}
                                className="w-full min-w-0 h-8 text-center rounded-lg border border-border bg-background font-display font-bold text-[18px] tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40" />
                            <button type="button" onClick={() => step(e.id, 5)} aria-label={`5 more ${e.name}`}
                                className="w-8 h-8 rounded-lg bg-muted dark:bg-background text-foreground inline-flex items-center justify-center hover:bg-muted/70"><Plus size={14} /></button>
                        </div>
                        {errors[e.id] && <p className="text-[11px] text-danger mt-1">Reps must be {errors[e.id]}</p>}
                    </div>
                ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="text-[12px] text-muted-foreground">
                    {todayReps != null && <>Today so far: <span className="font-semibold text-foreground tabular-nums">{todayReps}</span> reps</>}
                </div>
                <Button onClick={logSet} disabled={saving || invalid || total <= 0}>
                    {justLogged != null && !saving ? <Check size={16} /> : null}
                    {saving ? 'Logging…' : `Log set · ${total} reps`}
                </Button>
            </div>
        </div>
    )
}
