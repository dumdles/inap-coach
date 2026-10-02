'use client'

// ── Admin → Staff ─────────────────────────────────────────────────────────────
// Instructor verification queue (approve / reject → /api/instructor-requests),
// instructor coverage per wing, and the staff list with revoke (→ /api/admin/role).

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAdminData, adminHeaders } from '@/components/admin/admin-data'
import { Panel, SeverityBadge } from '@/components/admin/charts'

type PendingRequest = {
    id: string; rank: string; wing: string | null; appointment: string; created_at: string
    user: { id: string; full_name: string | null; email: string | null } | null
}
type StaffRow = { id: string; full_name: string | null; rank: string | null; wing: string | null; role: string; email: string | null }

export default function AdminStaffPage() {
    const { data } = useAdminData() // only for cadet counts per wing (coverage table)
    const [pending, setPending] = useState<PendingRequest[] | null>(null)
    const [staff, setStaff] = useState<StaffRow[] | null>(null)
    const [error, setError] = useState('')
    const [working, setWorking] = useState<string | null>(null)

    const load = useCallback(async () => {
        const headers = await adminHeaders()
        const [p, s] = await Promise.all([
            fetch('/api/instructor-requests?scope=pending', { headers }),
            fetch('/api/admin/staff', { headers }),
        ])
        if (!p.ok || !s.ok) { setError('Could not load staff data'); return }
        setPending(await p.json())
        setStaff(await s.json())
        setError('')
    }, [])

    useEffect(() => { queueMicrotask(() => { void load() }) }, [load])

    const act = async (id: string, url: string, body: object) => {
        setWorking(id)
        const res = await fetch(url, { method: 'PATCH', headers: await adminHeaders(), body: JSON.stringify(body) })
        setWorking(null)
        if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return }
        await load()
    }

    // Instructor coverage: cadets per verified instructor, by wing.
    const coverage = useMemo(() => {
        if (!data || !staff) return []
        return data.wings.map(w => {
            const instructors = staff.filter(s => s.role === 'instructor' && s.wing === w.wing).length
            return { wing: w.wing, cadets: w.cadets, instructors, ratio: instructors ? Math.round(w.cadets / instructors) : null }
        })
    }, [data, staff])

    return (
        <div className="flex flex-col gap-6">
            {error && <p className="text-sm text-danger">{error}</p>}

            <Panel title="Instructor requests" subtitle="Approving grants My Wing access for the requester's wing">
                {pending == null ? <Skeleton className="h-12 w-full" /> : pending.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending requests.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {pending.map(r => (
                            <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-foreground truncate">
                                        {r.rank} {r.user?.full_name ?? 'Unknown'} <span className="text-muted-foreground font-normal">· {r.wing ?? 'No wing'}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        {r.appointment} · {r.user?.email} · {new Date(r.created_at).toLocaleDateString('en-SG')}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" disabled={working === r.id}
                                        onClick={() => act(r.id, '/api/instructor-requests', { requestId: r.id, decision: 'reject' })}>Reject</Button>
                                    <Button size="sm" disabled={working === r.id}
                                        onClick={() => act(r.id, '/api/instructor-requests', { requestId: r.id, decision: 'approve' })}>Approve</Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Panel>

            <div className="grid gap-6 lg:grid-cols-5">
                <Panel title="Instructor coverage" subtitle="Cadets per verified instructor" className="lg:col-span-2">
                    {coverage.length === 0 ? <Skeleton className="h-32 w-full" /> : (
                        <ul className="divide-y divide-border text-sm">
                            {coverage.map(c => (
                                <li key={c.wing} className="py-2.5 flex items-center justify-between gap-3">
                                    <span className="font-medium text-foreground">{c.wing}</span>
                                    <span className="flex items-center gap-2 text-muted-foreground tabular-nums">
                                        {c.cadets} cadets · {c.instructors} instr.
                                        {c.ratio == null && <SeverityBadge severity="serious" label="No instructor" />}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>

                <Panel title="Staff" subtitle="Verified instructors and superadmins" className="lg:col-span-3">
                    {staff == null ? <Skeleton className="h-32 w-full" /> : staff.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No staff yet.</p>
                    ) : (
                        <ul className="divide-y divide-border">
                            {staff.map(s => (
                                <li key={s.id} className="py-2.5 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-foreground truncate">{s.rank} {s.full_name}</div>
                                        <div className="text-xs text-muted-foreground truncate">{s.wing ?? 'No wing'} · {s.role}</div>
                                    </div>
                                    {s.role === 'instructor' && (
                                        <Button size="sm" variant="outline" disabled={working === s.id}
                                            onClick={() => act(s.id, '/api/admin/role', { userId: s.id, role: 'cadet' })}>Revoke</Button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Panel>
            </div>
        </div>
    )
}
