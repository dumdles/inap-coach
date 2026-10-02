'use client'

// ── Admin console (superadmin only) ───────────────────────────────────────────
// App-wide "god view" for the app owner / Comd OCS:
//   • Totals across all wings (last 7 days)
//   • Per-wing engagement table — click through to that wing's cadets is a
//     follow-up; individual cadet pages already allow superadmins (/api/cadet)
//   • Instructor verification queue (approve / reject → app/api/instructor-requests)
//   • Staff list with revoke (→ app/api/admin/role)
// Access is enforced server-side by requireRole(['superadmin']) on every API
// this page calls; the client-side redirect is only for UX.

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { isSuperadmin } from '@/lib/roles'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'

type Overview = {
    windowDays: number
    totals: {
        cadets: number; instructors: number; superadmins: number
        activeCadets: number; activePct: number; meals: number; workouts: number; pendingRequests: number
    }
    wings: {
        wing: string; cadets: number; instructors: number; active: number
        activePct: number; mealsPerCadetDay: number; workoutsPerCadet: number
    }[]
    staff: { id: string; full_name: string | null; rank: string | null; wing: string | null; role: string }[]
}

type PendingRequest = {
    id: string; rank: string; wing: string | null; appointment: string; created_at: string
    user: { id: string; full_name: string | null; email: string | null } | null
}

async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
    return (
        <div className="rounded-2xl bg-card border border-border p-5">
            <div className="text-xs text-muted-foreground mb-2">{label}</div>
            <div className="font-display font-extrabold text-3xl text-foreground">{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
    )
}

export default function AdminPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [allowed, setAllowed] = useState(false)
    const [overview, setOverview] = useState<Overview | null>(null)
    const [pending, setPending] = useState<PendingRequest[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [working, setWorking] = useState<string | null>(null) // id of row being acted on

    // Gate on role from the DB; non-superadmins bounce back to the dashboard.
    useEffect(() => {
        if (!user) return
        supabase.from('users').select('role').eq('id', user.id).single().then(({ data }) => {
            if (!isSuperadmin(data?.role)) router.replace('/dashboard')
            else setAllowed(true)
        })
    }, [user, router])

    const load = useCallback(async () => {
        const headers = await authHeaders()
        const [o, p] = await Promise.all([
            fetch('/api/admin/overview', { headers }),
            fetch('/api/instructor-requests?scope=pending', { headers }),
        ])
        if (!o.ok || !p.ok) { setError('Could not load admin data'); setLoading(false); return }
        setOverview(await o.json())
        setPending(await p.json())
        setError('')
        setLoading(false)
    }, [])

    useEffect(() => { if (allowed) queueMicrotask(() => { void load() }) }, [allowed, load])

    const review = async (requestId: string, decision: 'approve' | 'reject') => {
        setWorking(requestId)
        const res = await fetch('/api/instructor-requests', {
            method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ requestId, decision }),
        })
        setWorking(null)
        if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return }
        await load()
    }

    const revoke = async (userId: string) => {
        setWorking(userId)
        const res = await fetch('/api/admin/role', {
            method: 'PATCH', headers: await authHeaders(), body: JSON.stringify({ userId, role: 'cadet' }),
        })
        setWorking(null)
        if (!res.ok) { setError((await res.json()).error ?? 'Failed'); return }
        await load()
    }

    if (!allowed) return null

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-5xl mx-auto">
            <div className="mb-8">
                <h1 className="font-display font-extrabold text-[32px] tracking-tight text-foreground leading-none mb-1">Admin</h1>
                <p className="text-sm text-muted-foreground">All wings · last {overview?.windowDays ?? 7} days</p>
            </div>

            {error && <p className="text-sm text-danger mb-4">{error}</p>}

            {/* ── Totals ─────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {loading || !overview ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
                ) : (
                    <>
                        <StatCard label="Cadets" value={overview.totals.cadets} sub={`${overview.totals.instructors} instructors`} />
                        <StatCard label="Active cadets" value={`${overview.totals.activePct}%`} sub={`${overview.totals.activeCadets} logged anything`} />
                        <StatCard label="Meals logged" value={overview.totals.meals.toLocaleString()} />
                        <StatCard label="Workouts logged" value={overview.totals.workouts.toLocaleString()} />
                    </>
                )}
            </div>

            {/* ── Verification queue ────────────────────────────────────────── */}
            <section className="rounded-2xl bg-card border border-border p-5 mb-8">
                <h2 className="text-[13px] font-semibold text-foreground mb-3">
                    Instructor requests{pending.length > 0 && <span className="text-muted-foreground"> · {pending.length}</span>}
                </h2>
                {loading ? (
                    <Skeleton className="h-12 w-full" />
                ) : pending.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pending requests.</p>
                ) : (
                    <ul className="divide-y divide-border">
                        {pending.map(r => (
                            <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-foreground truncate">
                                        {r.rank} {r.user?.full_name ?? 'Unknown'} <span className="text-muted-foreground font-normal">· {r.wing ?? 'No wing'}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">{r.appointment} · {r.user?.email}</div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="outline" disabled={working === r.id} onClick={() => review(r.id, 'reject')}>Reject</Button>
                                    <Button size="sm" disabled={working === r.id} onClick={() => review(r.id, 'approve')}>Approve</Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* ── Per-wing table ────────────────────────────────────────────── */}
            <section className="rounded-2xl bg-card border border-border p-5 mb-8">
                <h2 className="text-[13px] font-semibold text-foreground mb-3">Wings</h2>
                {loading || !overview ? (
                    <Skeleton className="h-32 w-full" />
                ) : (
                    <div className="overflow-x-auto -mx-5 px-5">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-muted-foreground">
                                    <th className="py-2 pr-4 font-medium">Wing</th>
                                    <th className="py-2 pr-4 font-medium text-right">Cadets</th>
                                    <th className="py-2 pr-4 font-medium text-right">Active</th>
                                    <th className="py-2 pr-4 font-medium text-right">Meals / cadet / day</th>
                                    <th className="py-2 pr-4 font-medium text-right">Workouts / cadet</th>
                                    <th className="py-2 font-medium text-right">Instructors</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {overview.wings.map(w => (
                                    <tr key={w.wing} className="text-foreground">
                                        <td className="py-2.5 pr-4 font-medium">{w.wing}</td>
                                        <td className="py-2.5 pr-4 text-right">{w.cadets}</td>
                                        <td className="py-2.5 pr-4 text-right">{w.activePct}%</td>
                                        <td className="py-2.5 pr-4 text-right">{w.mealsPerCadetDay}</td>
                                        <td className="py-2.5 pr-4 text-right">{w.workoutsPerCadet}</td>
                                        <td className="py-2.5 text-right">{w.instructors}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ── Staff ─────────────────────────────────────────────────────── */}
            <section className="rounded-2xl bg-card border border-border p-5">
                <h2 className="text-[13px] font-semibold text-foreground mb-3">Staff</h2>
                {loading || !overview ? (
                    <Skeleton className="h-12 w-full" />
                ) : (
                    <ul className="divide-y divide-border">
                        {overview.staff.map(s => (
                            <li key={s.id} className="py-3 flex items-center gap-3">
                                <div className="flex-1 min-w-0 text-sm text-foreground truncate">
                                    {s.rank} {s.full_name} <span className="text-muted-foreground">· {s.wing ?? 'No wing'} · {s.role}</span>
                                </div>
                                {s.role === 'instructor' && (
                                    <Button size="sm" variant="outline" disabled={working === s.id} onClick={() => revoke(s.id)}>Revoke</Button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    )
}
