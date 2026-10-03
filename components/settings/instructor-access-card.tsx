'use client'

// Settings → Profile card that lets an instructor-ranked user request
// instructor access. Rank alone no longer unlocks "My Wing" — a superadmin
// reviews the request in the Admin console (app/dashboard/admin) and the
// approval flips users.role server-side (app/api/instructor-requests).

import React, { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { isInstructorRank } from '@/lib/scoring'
import { hasInstructorAccess } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { InputField } from '@/components/ui/input-field'
import { Skeleton } from '@/components/ui/skeleton'

type RequestRow = { id: string; status: 'pending' | 'approved' | 'rejected'; appointment: string; review_note: string | null }

const APPOINTMENT_MIN = 3
const APPOINTMENT_MAX = 120

async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
}

/** `savedRank` must be the rank already saved to the DB — the API checks that, not unsaved form state. */
export function InstructorAccessCard({ savedRank, className }: { savedRank: string; className?: string }) {
    const [loading, setLoading] = useState(true)
    const [role, setRole] = useState<string>('cadet')
    const [request, setRequest] = useState<RequestRow | null>(null)
    const [appointment, setAppointment] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const load = useCallback(async () => {
        const res = await fetch('/api/instructor-requests', { headers: await authHeaders() })
        if (res.ok) {
            const json = await res.json()
            setRole(json.role)
            setRequest(json.request)
        }
        setLoading(false)
    }, [])

    useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

    // Cadet ranks (OCT / ME4T) never see this card.
    if (!isInstructorRank(savedRank) && !hasInstructorAccess(role)) return null
    if (loading) return <div className={className}><Skeleton className="h-24 w-full rounded-xl" /></div>

    // Inline validation on change, mirroring the server's 3–120 char limit.
    const validate = (v: string) => {
        const len = v.trim().length
        return len < APPOINTMENT_MIN || len > APPOINTMENT_MAX
            ? `Appointment must be ${APPOINTMENT_MIN}–${APPOINTMENT_MAX} characters`
            : ''
    }

    const submit = async () => {
        const err = validate(appointment)
        setError(err)
        if (err) return
        setSubmitting(true)
        const res = await fetch('/api/instructor-requests', {
            method: 'POST', headers: await authHeaders(), body: JSON.stringify({ appointment }),
        })
        const json = await res.json()
        setSubmitting(false)
        if (!res.ok) { setError(json.error ?? 'Could not submit request'); return }
        setRequest(json)
    }

    let body: React.ReactNode
    if (hasInstructorAccess(role)) {
        body = <p className="text-[13px] text-success-dark">Verified — you have instructor access.</p>
    } else if (request?.status === 'pending') {
        body = (
            <p className="text-[13px] text-warning-dark">
                Pending review · <span className="text-muted-foreground">{request.appointment}</span>
            </p>
        )
    } else {
        body = (
            <div className="flex flex-col gap-3">
                {request?.status === 'rejected' && (
                    <p className="text-[13px] text-danger-dark">
                        Your last request was not approved{request.review_note ? `: ${request.review_note}` : '.'}
                    </p>
                )}
                <InputField
                    label="Appointment"
                    placeholder="e.g. PC, 3 Plt Hawk Wing"
                    value={appointment}
                    maxLength={APPOINTMENT_MAX}
                    error={error}
                    onChange={e => { setAppointment(e.target.value); setError(validate(e.target.value)) }}
                />
                <div>
                    <Button size="sm" onClick={submit} disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Request instructor access'}
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className={className}>
            <div className="font-display text-[15px] font-bold text-foreground">Instructor access</div>
            <div className="text-[12px] text-muted-foreground mb-3">
                Instructor tools are unlocked after an administrator verifies your appointment.
            </div>
            {body}
        </div>
    )
}
