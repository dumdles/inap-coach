'use client'

// ── Challenge detail ──────────────────────────────────────────────────────────
// Live (or final) standings for one challenge, the caller's own standing, and —
// once finished — the podium and any bonus points the caller earned.
// Data: GET /api/challenges/[id] (scores computed live from logs).

import React, { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Timer, Users, Trophy, CalendarDays } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { authFetch } from '@/lib/auth-fetch'
import { ApiError, useApi } from '@/lib/use-data'
import { refreshData } from '@/lib/data-cache'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Panel, StatTile } from '@/components/admin/charts'
import { timeLeftLabel, windowLabel } from '@/components/challenges/time'
import {
    CHALLENGE_METRICS, challengeStatus, formatLabel, scopeLabel,
    type Challenge, type IndividualRow, type TeamRow,
} from '@/lib/challenges'

type Detail = {
    challenge: Challenge
    standings: { format: 'individual'; rows: IndividualRow[] } | { format: 'team'; rows: (Omit<TeamRow, 'memberIds'> & { isMine: boolean })[] }
    participants: number
    mine: { score: number; place: number; of: number; team?: { label: string; place: number; score: number } } | null
    myAward: { points: number; place: number } | null
    awardedCount: number
    canManage: boolean
}

const TOP_N = 10
const STATUS_LABEL = { live: 'Live', upcoming: 'Upcoming', ended: 'Finished' } as const

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { user } = useAuth()
    const [showAll, setShowAll] = useState(false)
    const [confirmCancel, setConfirmCancel] = useState(false)

    // Cached via the shared data cache (lib/use-data.ts): reopening a challenge
    // shows the last standings instantly while fresh scores load in the background.
    const { data: d, error: loadError } = useApi<Detail>(`/api/challenges/${id}`)
    // Only show an error when there's nothing cached to fall back on.
    const error = d || !loadError ? ''
        : loadError instanceof ApiError && loadError.status === 404 ? 'Challenge not found'
        : loadError.message || 'Could not load challenge'

    async function cancel() {
        const res = await authFetch(`/api/challenges/${id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => ({}))
        setConfirmCancel(false)
        if (!res.ok) { toast.error(json.error ?? 'Could not cancel'); return }
        toast.success('Challenge cancelled')
        // Refresh the cached challenges list (and this detail) so the cancelled one disappears.
        void refreshData('/api/challenges')
        router.replace('/dashboard/challenges')
    }

    if (error) return (
        <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
            <BackLink />
            <p className="text-sm text-danger mt-6">{error}</p>
        </div>
    )
    if (!d) return (
        <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto space-y-4">
            <BackLink />
            <Skeleton className="h-10 w-2/3" />
            <div className="grid grid-cols-3 gap-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
            <Skeleton className="h-80 rounded-2xl" />
        </div>
    )

    const c = d.challenge
    const metric = CHALLENGE_METRICS[c.metric]
    const status = challengeStatus(c)
    const unit = metric.unit
    // "1 day" / "2 days" — units are stored plural
    const fmt = (v: number) => `${v.toLocaleString()} ${v === 1 ? unit.replace(/s$/, '') : unit}`

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-3xl mx-auto">
            <BackLink />

            {/* Header */}
            <div className="mt-4 mb-6">
                <div className="flex items-center gap-2 mb-2">
                    <span className={cn('text-[11px] font-semibold rounded-full px-2 py-0.5',
                        status === 'live' ? 'bg-success-light text-success-dark' : 'bg-muted text-muted-foreground')}>
                        {STATUS_LABEL[status]}
                    </span>
                    <span className="text-[12px] text-muted-foreground">{formatLabel(c)}</span>
                </div>
                <h1 className="font-display font-extrabold text-[28px] md:text-[32px] tracking-tight text-foreground leading-tight">{c.title}</h1>
                {c.description && <p className="text-[14px] text-muted-foreground mt-2">{c.description}</p>}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Trophy size={13} />{metric.label}: {metric.hint}</span>
                    <span className="inline-flex items-center gap-1"><Users size={13} />{scopeLabel(c)} · {d.participants} cadets</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{windowLabel(c)}</span>
                </div>
            </div>

            {/* Finished: result + what the caller earned */}
            {status === 'ended' && (
                <Panel title="Results" subtitle={c.finalized_at ? `${d.awardedCount} cadet${d.awardedCount === 1 ? '' : 's'} earned bonus points` : 'Tallying results…'} className="mb-6">
                    {d.myAward && (
                        <div className="mb-4 rounded-xl bg-success-light text-success-dark px-3 py-2 text-[13px] font-medium">
                            🏆 You placed {ordinal(d.myAward.place)} — +{d.myAward.points} points added to your leaderboard score
                        </div>
                    )}
                    {c.results?.podium?.length ? (
                        <ol className="space-y-1.5">
                            {c.results.podium.map(p => (
                                <li key={`${p.place}-${p.label}`} className="flex items-center gap-3 text-[14px]">
                                    <span className="w-6 text-center">{['🥇', '🥈', '🥉'][p.place - 1]}</span>
                                    <span className="flex-1 text-foreground">{p.label}</span>
                                    <span className="text-muted-foreground tabular-nums">{fmt(p.score)}</span>
                                </li>
                            ))}
                        </ol>
                    ) : <p className="text-sm text-muted-foreground">No one scored in this challenge.</p>}
                </Panel>
            )}

            {/* Your standing */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {d.mine ? (
                    <>
                        <StatTile label={status === 'ended' ? 'Your final score' : 'Your score'} value={d.mine.score} unit={unit} />
                        {d.standings.format === 'individual' ? (
                            <StatTile label="Your place" value={d.mine.place} hint={`of ${d.mine.of} cadets`} />
                        ) : d.mine.team ? (
                            <StatTile label="Your team" value={d.mine.team.place} hint={`${d.mine.team.label} · avg ${d.mine.team.score} ${unit}`} />
                        ) : (
                            <StatTile label="Your team" value={null} hint="Set your platoon and section in Settings to join a team" />
                        )}
                    </>
                ) : (
                    <div className="col-span-2 rounded-2xl bg-card border border-border p-4 text-[13px] text-muted-foreground flex items-center">
                        You&apos;re viewing as staff — only cadets compete.
                    </div>
                )}
                <div className="rounded-2xl bg-card border border-border p-4 col-span-2 sm:col-span-1">
                    <div className="text-[12px] text-muted-foreground">Time</div>
                    <div className="mt-1.5 font-display font-bold text-[22px] leading-tight text-foreground inline-flex items-center gap-1.5">
                        <Timer size={18} className="text-muted-foreground" />{timeLeftLabel(c)}
                    </div>
                    {c.bonus_points > 0 && <div className="text-[11px] text-muted-foreground mt-2">{c.bonus_points} pts to the winner{c.format === 'team' ? ' (each member)' : ''}</div>}
                </div>
            </div>

            {/* Standings */}
            <Panel
                title={d.standings.format === 'team' ? 'Team standings' : 'Standings'}
                subtitle={status === 'upcoming' ? 'Scores start counting when the challenge begins'
                    : d.standings.format === 'team' ? 'Ranked by members’ average — every member counts' : `Ranked by ${metric.label.toLowerCase()}`}>
                {d.standings.format === 'team'
                    ? <TeamList rows={d.standings.rows} fmt={fmt} />
                    : <IndividualList rows={d.standings.rows} fmt={fmt} showAll={showAll} onShowAll={() => setShowAll(true)} mineId={user?.id} />}
            </Panel>

            {d.canManage && (
                <div className="mt-6 flex justify-end">
                    <Button variant="outline" onClick={() => setConfirmCancel(true)}>Cancel challenge</Button>
                </div>
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

// A leaderboard row: place · label · bar (accent for "you", grey for others) · value at the tip.
function Row({ place, label, sub, value, max, mine, fmt }: {
    place: number; label: string; sub?: string; value: number; max: number; mine: boolean; fmt: (v: number) => string
}) {
    return (
        <li className={cn('flex items-center gap-3 rounded-xl px-2 py-2', mine && 'bg-muted')}>
            <span className="w-7 text-center text-[13px] font-semibold text-muted-foreground tabular-nums">{place <= 3 && value > 0 ? ['🥇', '🥈', '🥉'][place - 1] : place}</span>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-3 text-[13px]">
                    <span className="truncate text-foreground font-medium">{label}{mine && <span className="ml-1.5 text-[11px] text-muted-foreground font-normal">(you)</span>}</span>
                    <span className="text-muted-foreground tabular-nums whitespace-nowrap">{fmt(value)}</span>
                </div>
                {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
                <div className="mt-1 h-2">
                    <div className="h-full rounded-r" style={{
                        width: `${max ? Math.max(value ? 2 : 0, (value / max) * 100) : 0}%`,
                        background: mine ? 'var(--viz-accent)' : 'var(--viz-muted)',
                    }} />
                </div>
            </div>
        </li>
    )
}

function IndividualList({ rows, fmt, showAll, onShowAll, mineId }: {
    rows: IndividualRow[]; fmt: (v: number) => string; showAll: boolean; onShowAll: () => void; mineId?: string
}) {
    if (!rows.length) return <p className="text-sm text-muted-foreground">No cadets in scope.</p>
    const max = rows[0]?.score ?? 0
    const top = showAll ? rows : rows.slice(0, TOP_N)
    const me = mineId ? rows.find(r => r.id === mineId) : undefined
    const meHidden = me && !top.includes(me)
    const sub = (r: IndividualRow) => [r.wing, r.platoon && `P${r.platoon}`, r.section && `S${r.section}`].filter(Boolean).join(' · ')
    return (
        <>
            <ol className="space-y-0.5">
                {top.map(r => <Row key={r.id} place={r.place} label={`${r.rank} ${r.name}`.trim()} sub={sub(r)} value={r.score} max={max} mine={r.id === mineId} fmt={fmt} />)}
                {meHidden && (
                    <>
                        <li className="text-center text-muted-foreground text-[12px] py-1">⋯</li>
                        <Row place={me.place} label={`${me.rank} ${me.name}`.trim()} sub={sub(me)} value={me.score} max={max} mine fmt={fmt} />
                    </>
                )}
            </ol>
            {!showAll && rows.length > TOP_N && (
                <button onClick={onShowAll} className="mt-3 text-[13px] text-muted-foreground hover:text-foreground underline underline-offset-2">
                    Show all {rows.length}
                </button>
            )}
        </>
    )
}

function TeamList({ rows, fmt }: { rows: (Omit<TeamRow, 'memberIds'> & { isMine: boolean })[]; fmt: (v: number) => string }) {
    if (!rows.length) return <p className="text-sm text-muted-foreground">No teams yet — cadets need a platoon and section set in their profile.</p>
    const max = rows[0]?.score ?? 0
    return (
        <ol className="space-y-0.5">
            {rows.map(t => (
                <Row key={t.key} place={t.place} label={t.label} sub={`${t.contributors}/${t.members} members scoring`}
                    value={t.score} max={max} mine={t.isMine} fmt={fmt} />
            ))}
        </ol>
    )
}

function ordinal(n: number) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th` }
