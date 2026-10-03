'use client'

// ── Challenges ────────────────────────────────────────────────────────────────
// Every cadet sees the challenges they're auto-enrolled in (live, upcoming,
// recently finished). Verified instructors and superadmins also get
// "New challenge". Scoring + rules: lib/challenges.ts. API: app/api/challenges.

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Timer, Users, Trophy, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/use-data'
import { cn } from '@/lib/utils'
import { CHALLENGE_METRICS, challengeStatus, formatLabel, scopeLabel, type Challenge } from '@/lib/challenges'
import { CreateChallengeDialog } from '@/components/challenges/create-challenge-dialog'
import { timeLeftLabel } from '@/components/challenges/time'

type ListResponse = { challenges: Challenge[]; canCreate: boolean; myWing: string | null; isSuperadmin: boolean }

export default function ChallengesPage() {
    const [creating, setCreating] = useState(false)
    // Captured on mount and again whenever fresh data arrives; keeps render pure.
    const [now, setNow] = useState(() => Date.now())

    // Cached via the shared data cache (lib/use-data.ts): returning to this page
    // shows the last list instantly and refreshes it in the background.
    const { data, error: loadError, mutate } = useApi<ListResponse>('/api/challenges', {
        onSuccess: () => setNow(Date.now()),
    })
    // Only show an error when there's nothing cached to fall back on.
    const error = !data && loadError ? loadError.message || 'Could not load challenges' : ''

    const by = (s: string) => (data?.challenges ?? []).filter(c => challengeStatus(c, now) === s)
    const live = by('live').sort((a, b) => Date.parse(a.ends_at) - Date.parse(b.ends_at))
    const upcoming = by('upcoming').sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at))
    const ended = by('ended').sort((a, b) => Date.parse(b.ends_at) - Date.parse(a.ends_at))

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-4xl mx-auto">
            <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                    <h1 className="font-display font-extrabold text-[32px] tracking-tight text-foreground leading-none mb-1">Challenges</h1>
                    <p className="text-sm text-muted-foreground">Time-boxed competitions scored from what you already log. Winners earn leaderboard bonus points.</p>
                </div>
                {data?.canCreate && (
                    <Button onClick={() => setCreating(true)} className="shrink-0"><Plus size={16} /> <span className="hidden sm:inline">New challenge</span></Button>
                )}
            </div>

            {error && <p className="text-sm text-danger mb-4">{error}</p>}

            {!data && !error ? (
                <div className="space-y-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
            ) : data && data.challenges.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                    <Trophy className="mx-auto mb-3 text-muted-foreground" size={28} />
                    <p className="text-[15px] font-semibold text-foreground">No challenges yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {data.canCreate ? 'Create one to get your cadets competing.' : 'Your instructors haven’t started one yet — check back soon.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-8">
                    <Section title="Live now" items={live} now={now} />
                    <Section title="Upcoming" items={upcoming} now={now} />
                    <Section title="Finished" items={ended} now={now} />
                </div>
            )}

            {data && (
                <CreateChallengeDialog open={creating} onClose={() => setCreating(false)}
                    onCreated={() => void mutate()} myWing={data.myWing} isSuperadmin={data.isSuperadmin} />
            )}
        </div>
    )
}

function Section({ title, items, now }: { title: string; items: Challenge[]; now: number }) {
    if (!items.length) return null
    return (
        <section>
            <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-3">{title} · {items.length}</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
                {items.map(c => <li key={c.id}><ChallengeCard c={c} now={now} /></li>)}
            </ul>
        </section>
    )
}

function ChallengeCard({ c, now }: { c: Challenge; now: number }) {
    const status = challengeStatus(c, now)
    const metric = CHALLENGE_METRICS[c.metric]
    const winner = c.results?.podium?.[0]
    // Progress through the window, for the thin meter on live cards.
    const pct = Math.min(100, Math.max(0, ((now - Date.parse(c.starts_at)) / (Date.parse(c.ends_at) - Date.parse(c.starts_at))) * 100))

    return (
        <Link href={`/dashboard/challenges/${c.id}`}
            className="group flex flex-col h-full rounded-2xl bg-card border border-border p-4 hover:border-foreground/30 transition-colors">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                    <div className="text-[15px] font-semibold text-foreground truncate">{c.title}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5">{metric.label} · {formatLabel(c)}</div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
            </div>

            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users size={13} />{scopeLabel(c)}</span>
                <span className="inline-flex items-center gap-1"><Timer size={13} />{timeLeftLabel(c, now)}</span>
                {c.bonus_points > 0 && <span className="inline-flex items-center gap-1"><Trophy size={13} />{c.bonus_points} pts</span>}
            </div>

            {status === 'live' && (
                <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden" aria-label={`${Math.round(pct)}% of the time elapsed`}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--viz-accent)' }} />
                </div>
            )}
            {status === 'ended' && (
                <div className={cn('mt-3 text-[12px]', winner ? 'text-foreground' : 'text-muted-foreground')}>
                    {winner ? <>🏆 {winner.label} <span className="text-muted-foreground">· {winner.score} {metric.unit}</span></> : c.finalized_at ? 'No one scored' : 'Tallying results…'}
                </div>
            )}
        </Link>
    )
}
