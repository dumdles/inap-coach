'use client'

// ── Challenge detail page ─────────────────────────────────────────────────────
// Loads one challenge (GET /api/challenges/[id], scores computed live from logs —
// see app/api/_lib/challenges.ts) and renders it with <ChallengeArena>. The
// creator / a superadmin also gets Edit and Cancel.

import React, { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { authFetch } from '@/lib/auth-fetch'
import { ApiError, useApi, useData } from '@/lib/use-data'
import { refreshData } from '@/lib/data-cache'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { ChallengeArena, withLoggedReps, type ChallengeDetail } from '@/components/challenges/arena'
import { CreateChallengeDialog } from '@/components/challenges/create-challenge-dialog'

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { user } = useAuth()
    const [confirmCancel, setConfirmCancel] = useState(false)
    const [editing, setEditing] = useState(false)
    // Captured when data arrives (not during render) so time-based bits stay pure.
    const [now, setNow] = useState(() => Date.now())

    // Cached via the shared data cache (lib/use-data.ts): reopening a challenge
    // shows the last standings instantly while fresh scores load in the background.
    const { data: d, error: loadError, mutate } = useApi<ChallengeDetail>(`/api/challenges/${id}`, { onSuccess: () => setNow(Date.now()) })
    // Only show an error when there's nothing cached to fall back on.
    const error = d || !loadError ? ''
        : loadError instanceof ApiError && loadError.status === 404 ? 'Challenge not found'
        : loadError.message || 'Could not load challenge'

    // Name + wing for the share image and the edit dialog (cached).
    const { data: me } = useData<{ rank: string | null; full_name: string | null; wing: string | null; role: string | null }>('profile:challenge', async uid => {
        const { data, error } = await supabase.from('users').select('rank, full_name, wing, role').eq('id', uid).single()
        if (error) throw error
        return data
    })

    async function cancel() {
        const res = await authFetch(`/api/challenges/${id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => ({}))
        setConfirmCancel(false)
        if (!res.ok) { toast.error(json.error ?? 'Could not cancel'); return }
        toast.success('Challenge cancelled')
        // Refresh the cached challenges list so the cancelled one disappears.
        void refreshData('/api/challenges')
        router.replace('/dashboard/challenges')
    }

    if (error) return (
        <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
            <BackLink />
            <p className="text-sm text-danger mt-6">{error}</p>
        </div>
    )
    if (!d) return (
        <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto space-y-4">
            <BackLink />
            <Skeleton className="h-36 rounded-2xl" />
            <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4"><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
                <div className="space-y-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
            </div>
        </div>
    )

    const ended = now >= Date.parse(d.challenge.ends_at)

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl mx-auto">
            <BackLink />
            <ChallengeArena
                d={d} now={now} mineId={user?.id}
                myName={[me?.rank, me?.full_name].filter(Boolean).join(' ') || 'FitRep cadet'}
                // Show the new score instantly, then confirm with the server in the background.
                onRepsLogged={total => void mutate(prev => prev && withLoggedReps(prev, user?.id, total), { revalidate: true })}
                actions={d.canManage && (
                    <>
                        {!ended && <Button variant="outline" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</Button>}
                        <Button variant="outline" onClick={() => setConfirmCancel(true)}>Cancel challenge</Button>
                    </>
                )}
            />

            {d.canManage && (
                <CreateChallengeDialog open={editing} onClose={() => setEditing(false)} editing={d.challenge}
                    myWing={me?.wing ?? null} isSuperadmin={me?.role === 'superadmin'}
                    onCreated={() => { void mutate(); void refreshData('/api/challenges') }} />
            )}

            <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Cancel this challenge?</DialogTitle>
                        <DialogDescription>It will be removed for all cadets and no bonus points will be awarded. This can&apos;t be undone.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmCancel(false)}>Keep it</Button>
                        <Button variant="destructive" onClick={cancel}>Cancel challenge</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function BackLink() {
    return (
        <Link href="/dashboard/challenges" className="inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Challenges
        </Link>
    )
}
