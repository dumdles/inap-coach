'use client'

import React, { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onLogged?: () => void
    editing?: SleepLog | null
}

export type SleepLog = {
    id: string
    sleep_start: string
    sleep_end: string
    duration_min: number
    rating?: number | null
    notes?: string | null
}

// Default values: a guess at what last night might have looked like for a cadet.
function defaultBedtime() {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    d.setHours(22, 30, 0, 0)
    return formatLocalForInput(d)
}

function defaultWake() {
    const d = new Date()
    d.setHours(6, 0, 0, 0)
    return formatLocalForInput(d)
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:MM" in the user's local tz.
function formatLocalForInput(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function durationLabel(min: number): string {
    if (min <= 0) return '—'
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${h}h ${m.toString().padStart(2, '0')}m`
}

export function LogSleepDialog({ open, onOpenChange, onLogged, editing }: Props) {
    const { user } = useAuth()

    const [sleepStart, setSleepStart] = useState(defaultBedtime())
    const [sleepEnd, setSleepEnd] = useState(defaultWake())
    const [rating, setRating] = useState<number | null>(null)
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        if (editing) {
            setSleepStart(formatLocalForInput(new Date(editing.sleep_start)))
            setSleepEnd(formatLocalForInput(new Date(editing.sleep_end)))
            setRating(editing.rating ?? null)
            setNotes(editing.notes ?? '')
        } else {
            setSleepStart(defaultBedtime())
            setSleepEnd(defaultWake())
            setRating(null)
            setNotes('')
        }
        setError(null)
    }, [open, editing])

    const startDate = new Date(sleepStart)
    const endDate = new Date(sleepEnd)
    const valid = !isNaN(startDate.getTime()) && !isNaN(endDate.getTime()) && endDate > startDate
    const durationMin = valid ? Math.round((endDate.getTime() - startDate.getTime()) / 60000) : 0

    async function handleSave() {
        if (!user || !valid) return
        setSaving(true)
        setError(null)

        const isEdit = !!editing
        const url = isEdit ? `/api/sleep-logs?id=${editing!.id}` : '/api/sleep-logs'
        const method = isEdit ? 'PATCH' : 'POST'
        const body = isEdit
            ? { sleep_start: startDate.toISOString(), sleep_end: endDate.toISOString(), duration_min: durationMin, rating, notes: notes.trim() || null }
            : {
                userId: user.id,
                source: 'manual',
                sleep_start: startDate.toISOString(),
                sleep_end: endDate.toISOString(),
                duration_min: durationMin,
                rating,
                notes: notes.trim() || null,
            }

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
        setSaving(false)

        if (!res.ok) {
            const data = await res.json().catch(() => ({ error: 'Failed to save' }))
            setError(data.error ?? 'Failed to save')
            return
        }
        onLogged?.()
        onOpenChange(false)
    }

    const inputCls = 'h-10 w-full rounded-xl border border-border bg-background px-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40'

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{editing ? 'Edit sleep' : 'Log sleep'}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Sleep window */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Bedtime</label>
                            <input type="datetime-local" className={inputCls} value={sleepStart} onChange={e => setSleepStart(e.target.value)} />
                        </div>
                        <div>
                            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Woke up</label>
                            <input type="datetime-local" className={inputCls} value={sleepEnd} onChange={e => setSleepEnd(e.target.value)} />
                        </div>
                    </div>

                    {/* Duration preview */}
                    <div className="rounded-xl bg-muted/40 border border-border p-3 flex items-center justify-between">
                        <span className="text-[12px] font-medium text-muted-foreground">Total sleep</span>
                        <span className="text-[18px] font-bold font-display text-foreground">{durationLabel(durationMin)}</span>
                    </div>

                    {/* Subjective rating */}
                    <div>
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                            How did you feel? <span className="normal-case font-normal tracking-normal">(optional)</span>
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {[
                                { v: 1, label: 'Wrecked' },
                                { v: 2, label: 'Tired' },
                                { v: 3, label: 'OK' },
                                { v: 4, label: 'Good' },
                                { v: 5, label: 'Sharp' },
                            ].map(({ v, label }) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => setRating(rating === v ? null : v)}
                                    className={cn(
                                        'py-2 rounded-xl text-[11px] font-semibold border transition-all',
                                        rating === v
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
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                            Notes <span className="normal-case font-normal tracking-normal">(optional)</span>
                        </label>
                        <textarea
                            rows={2}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Late caffeine, noisy bunk, interrupted by night ex..."
                            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
                        />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={!valid || saving}>
                        {saving ? 'Saving…' : editing ? 'Save changes' : 'Log sleep'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
