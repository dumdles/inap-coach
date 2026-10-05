'use client'

// ── Challenges ────────────────────────────────────────────────────────────────
// Every cadet sees the challenges they're auto-enrolled in. Gamified, wide layout:
//   • Trophy strip — live challenges, medals won, bonus points earned, best place
//   • Live now — rich cards with your place, you vs the leader, top 3 and the clock
//   • Upcoming + Finished side by side (finished shows the winner and your medal)
// Verified instructors and superadmins also get "New challenge".
// Scoring + rules: lib/challenges.ts. API: app/api/challenges (list + summaries).

import React, { useState } from 'react'
import Link from 'next/link'
import { Plus, Timer, Users, Trophy, ChevronRight, Gift, Medal, Flame, CalendarClock, FlaskConical } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useApi } from '@/lib/use-data'
import { cn } from '@/lib/utils'
import { CHALLENGE_METRICS, challengeStatus, formatLabel, scopeLabel, type Challenge } from '@/lib/challenges'
import { CreateChallengeDialog } from '@/components/challenges/create-challenge-dialog'
import { timeLeftLabel } from '@/components/challenges/time'
import { MEDAL, MetricIcon, PlaceBadge, TimeMeter, VersusBars } from '@/components/challenges/charts'

type Mine = { score: number; place: number; of: number; team?: { label: string; place: number; score: number; of: number } } | null
type Summary = { participants: number; mine: Mine; top: { place: number; label: string; score: number }[] }
type Trophies = {
    total: number; points: number; byPlace: number[]
    won: Record<string, { place: number; points: number }>
}
type ListResponse = {
    challenges: Challenge[]; summaries: Record<string, Summary>; trophies: Trophies
    canCreate: boolean; myWing: string | null; isSuperadmin: boolean
}

const unitFmt = (c: Challenge) => {
    const unit = CHALLENGE_METRICS[c.metric].unit
    return (v: number) => `${v.toLocaleString()} ${v === 1 ? unit.replace(/s$/, '') : unit}`
}

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

    // Best current place across live individual challenges (for the trophy strip).
    const livePlaces = live.map(c => data?.summaries?.[c.id]?.mine).filter(m => m && m.score > 0 && !m.team).map(m => m!.place)
    const bestLive = livePlaces.length ? Math.min(...livePlaces) : null

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl mx-auto">
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="font-display font-extrabold text-[32px] tracking-tight text-foreground leading-none mb-1">Challenges</h1>
                    <p className="text-sm text-muted-foreground">Time-boxed competitions scored from what you already log. Podium finishes earn leaderboard bonus points.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    {/* Playable walkthrough with fake cadets (nothing saved) — app/dashboard/challenges/demo */}
                    <Button asChild variant="outline"><Link href="/dashboard/challenges/demo"><FlaskConical size={16} /> <span className="hidden sm:inline">Try the demo</span></Link></Button>
                    {data?.canCreate && (
                        <Button onClick={() => setCreating(true)}><Plus size={16} /> <span className="hidden sm:inline">New challenge</span></Button>
                    )}
                </div>
            </div>

            {error && <p className="text-sm text-danger mb-4">{error}</p>}

            {!data && !error ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
                    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
                </div>
            ) : data ? (
                <>
                    {/* ── Trophy strip ─────────────────────────────────────── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
                        <StripTile icon={<Flame size={16} />} label="Live now" value={String(live.length)} hint={upcoming.length ? `${upcoming.length} coming up` : 'None scheduled next'} />
                        <StripTile icon={<Medal size={16} />} label="Medals won" value={String(data.trophies?.total ?? 0)}
                            hint={<span className="inline-flex items-center gap-2">{(data.trophies?.byPlace ?? [0, 0, 0]).map((n, i) => (
                                <span key={i} className="inline-flex items-center gap-1 tabular-nums"><span className="w-2 h-2 rounded-full" style={{ background: MEDAL[i] }} aria-hidden /><span className="sr-only">{['Gold', 'Silver', 'Bronze'][i]}:</span>{n}</span>
                            ))}</span>} />
                        <StripTile icon={<Gift size={16} />} label="Bonus points" value={(data.trophies?.points ?? 0).toLocaleString()} hint="Added to your leaderboard" />
                        <StripTile icon={<Trophy size={16} />} label="Best live place" value={bestLive ? ordinal(bestLive) : '—'} hint={bestLive ? 'Across live challenges' : 'Log something to get on the board'} />
                    </div>

                    {data.challenges.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                            <Trophy className="mx-auto mb-3 text-muted-foreground" size={28} />
                            <p className="text-[15px] font-semibold text-foreground">No challenges yet</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {data.canCreate ? 'Create one to get your cadets competing — try an MTR reps challenge.' : 'Your instructors haven’t started one yet — check back soon.'}
                            </p>
                            <Link href="/dashboard/challenges/demo" className="inline-block mt-3 text-[13px] font-medium text-primary hover:underline">See how a challenge works →</Link>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {live.length > 0 && (
                                <section>
                                    <SectionTitle title="Live now" count={live.length} />
                                    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                        {live.map(c => <li key={c.id}><LiveCard c={c} s={data.summaries?.[c.id]} now={now} /></li>)}
                                    </ul>
                                </section>
                            )}

                            <div className="grid gap-8 lg:grid-cols-2 items-start">
                                <section>
                                    <SectionTitle title="Upcoming" count={upcoming.length} />
                                    {upcoming.length ? (
                                        <ul className="space-y-3">{upcoming.map(c => <li key={c.id}><CompactCard c={c} now={now} /></li>)}</ul>
                                    ) : <EmptyNote text="Nothing scheduled yet." />}
                                </section>
                                <section>
                                    <SectionTitle title="Finished" count={ended.length} />
                                    {ended.length ? (
                                        <ul className="space-y-3">{ended.map(c => <li key={c.id}><CompactCard c={c} now={now} award={data.trophies?.won?.[c.id]} /></li>)}</ul>
                                    ) : <EmptyNote text="No finished challenges in the last 60 days." />}
                                </section>
                            </div>
                        </div>
                    )}
                </>
            ) : null}

            {data && (
                <CreateChallengeDialog open={creating} onClose={() => setCreating(false)}
                    onCreated={() => void mutate()} myWing={data.myWing} isSuperadmin={data.isSuperadmin} />
            )}
        </div>
    )
}

function SectionTitle({ title, count }: { title: string; count: number }) {
    return <h2 className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground mb-3">{title} · {count}</h2>
}
function EmptyNote({ text }: { text: string }) {
    return <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</p>
}

function StripTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: React.ReactNode }) {
    return (
        <div className="rounded-2xl bg-card border border-border p-4">
            <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">{icon}{label}</div>
            <div className="font-display font-extrabold text-[28px] text-foreground leading-tight mt-1 tabular-nums">{value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>
        </div>
    )
}

// ── Live card: your place, you vs leader, top 3, clock ────────────────────────
function LiveCard({ c, s, now }: { c: Challenge; s?: Summary; now: number }) {
    const metric = CHALLENGE_METRICS[c.metric]
    const fmt = unitFmt(c)
    const mine = s?.mine
    const isTeam = c.format === 'team'
    const myPlace = isTeam ? mine?.team?.place : mine?.place
    const myOf = isTeam ? mine?.team?.of : mine?.of
    const myScore = isTeam ? mine?.team?.score ?? 0 : mine?.score ?? 0
    const leader = s?.top?.[0]

    return (
        <Link href={`/dashboard/challenges/${c.id}`}
            className="group flex flex-col h-full rounded-2xl bg-card border border-border p-5 hover:border-foreground/30 transition-colors">
            <div className="flex items-start gap-3">
                <span className="w-10 h-10 rounded-xl bg-muted dark:bg-background text-foreground inline-flex items-center justify-center shrink-0"><MetricIcon metric={c.metric} /></span>
                <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-semibold text-foreground truncate">{c.title}</div>
                    <div className="text-[12px] text-muted-foreground mt-0.5 truncate">{metric.label} · {formatLabel(c)}</div>
                </div>
                <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 transition-transform" />
            </div>

            {/* You */}
            <div className="mt-4 flex items-center gap-3">
                {myPlace ? <PlaceBadge place={myPlace} size={44} scored={myScore > 0} /> : <span className="w-11 h-11 rounded-full bg-muted dark:bg-background shrink-0" aria-hidden />}
                <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{isTeam ? 'Your team' : 'Your place'}</div>
                    <div className="text-[14px] text-foreground font-semibold truncate">
                        {myPlace ? <>{ordinal(myPlace)} <span className="text-muted-foreground font-normal">of {myOf}</span></> : mine === null ? 'Staff view' : isTeam ? 'Not in a team' : '—'}
                    </div>
                </div>
            </div>
            {leader && mine && (
                <div className="mt-3"><VersusBars you={myScore} leader={leader.score} leaderLabel={leader.label} fmt={fmt} youLabel={isTeam ? 'Team' : 'You'} /></div>
            )}

            {/* Top 3 */}
            {s?.top?.some(t => t.score > 0) && (
                <ol className="mt-4 space-y-1">
                    {s.top.filter(t => t.score > 0).map(t => (
                        <li key={`${t.place}-${t.label}`} className="flex items-center gap-2 text-[12px]">
                            <PlaceBadge place={t.place} size={18} />
                            <span className="flex-1 truncate text-foreground">{t.label}</span>
                            <span className="tabular-nums text-muted-foreground">{fmt(t.score)}</span>
                        </li>
                    ))}
                </ol>
            )}

            <div className="mt-auto pt-4">
                <TimeMeter startsAt={c.starts_at} endsAt={c.ends_at} now={now} />
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Timer size={13} />{timeLeftLabel(c, now)}</span>
                    <span className="inline-flex items-center gap-1"><Users size={13} />{s ? `${s.participants} cadets` : scopeLabel(c)}</span>
                    {c.bonus_points > 0 && <span className="inline-flex items-center gap-1"><Gift size={13} />{c.bonus_points} pts</span>}
                </div>
            </div>
        </Link>
    )
}

// ── Compact card: upcoming (countdown) / finished (winner + your medal) ───────
function CompactCard({ c, now, award }: { c: Challenge; now: number; award?: { place: number; points: number } }) {
    const status = challengeStatus(c, now)
    const metric = CHALLENGE_METRICS[c.metric]
    const fmt = unitFmt(c)
    const winner = c.results?.podium?.[0]
    return (
        <Link href={`/dashboard/challenges/${c.id}`}
            className="group flex items-center gap-3 rounded-2xl bg-card border border-border p-4 hover:border-foreground/30 transition-colors">
            <span className="w-9 h-9 rounded-xl bg-muted dark:bg-background text-foreground inline-flex items-center justify-center shrink-0"><MetricIcon metric={c.metric} size={16} /></span>
            <div className="min-w-0 flex-1">
                <div className="text-[14px] font-semibold text-foreground truncate">{c.title}</div>
                <div className="text-[12px] text-muted-foreground truncate">
                    {status === 'upcoming' ? (
                        <span className="inline-flex items-center gap-1"><CalendarClock size={12} />{timeLeftLabel(c, now)} · {metric.label} · {scopeLabel(c)}</span>
                    ) : winner ? (
                        <>Winner: <span className="text-foreground">{winner.label}</span> · {fmt(winner.score)}</>
                    ) : c.finalized_at ? 'No one scored' : 'Tallying results…'}
                </div>
            </div>
            {award ? (
                <span className="inline-flex items-center gap-1.5 shrink-0 text-[12px] font-semibold text-foreground">
                    <PlaceBadge place={award.place} size={26} />+{award.points}
                </span>
            ) : status === 'upcoming' && c.bonus_points > 0 ? (
                <span className="text-[12px] text-muted-foreground shrink-0 inline-flex items-center gap-1"><Gift size={13} />{c.bonus_points}</span>
            ) : null}
            <ChevronRight size={16} className={cn('text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform')} />
        </Link>
    )
}

function ordinal(n: number) { return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th` }
