'use client'

// ── Challenge detail ──────────────────────────────────────────────────────────
// The "arena" for one challenge: who's winning, where you stand and how far to
// the next place, the race over time, your daily gains vs the average cadet,
// the podium and the full standings. Reps challenges (e.g. MTR) also get a
// one-tap quick log. Wide layout: main column + side column on large screens.
// Data: GET /api/challenges/[id] (scores computed live from logs, see
// app/api/_lib/challenges.ts → buildRace for the chart data).

import React, { use, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Users, CalendarDays, Gift, TrendingUp, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { authFetch } from '@/lib/auth-fetch'
import { ApiError, useApi } from '@/lib/use-data'
import { refreshData } from '@/lib/data-cache'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Panel } from '@/components/admin/charts'
import { timeLeftLabel, windowLabel } from '@/components/challenges/time'
import {
    DailyBars, MetricIcon, PlaceBadge, Podium, RaceChart, ScoreDistribution, TimeMeter, MEDAL,
    type RaceLine,
} from '@/components/challenges/charts'
import { QuickLogReps } from '@/components/challenges/quick-log-reps'
import {
    AWARD_SHARES, CHALLENGE_METRICS, challengeStatus, formatLabel, scopeLabel,
    type Challenge, type IndividualRow, type TeamRow,
} from '@/lib/challenges'

type TeamView = Omit<TeamRow, 'memberIds'> & { isMine: boolean }
type Detail = {
    challenge: Challenge
    standings: { format: 'individual'; rows: IndividualRow[] } | { format: 'team'; rows: TeamView[] }
    participants: number
    mine: { score: number; place: number; of: number; team?: { label: string; place: number; score: number; of: number } } | null
    myAward: { points: number; place: number } | null
    awardedCount: number
    canManage: boolean
    race: { days: string[]; lines: RaceLine[]; daily: { mine: number[]; avg: number[] } | null } | null
    exercises: { id: string; name: string }[]
}

const TOP_N = 10
const STATUS_LABEL = { live: 'Live', upcoming: 'Upcoming', ended: 'Finished' } as const

export default function ChallengeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const { user } = useAuth()
    const [showAll, setShowAll] = useState(false)
    const [confirmCancel, setConfirmCancel] = useState(false)
    // Captured when data arrives (not during render) so time-based bits stay pure.
    const [now, setNow] = useState(() => Date.now())

    // Cached via the shared data cache (lib/use-data.ts): reopening a challenge
    // shows the last standings instantly while fresh scores load in the background.
    const { data: d, error: loadError, mutate } = useApi<Detail>(`/api/challenges/${id}`, { onSuccess: () => setNow(Date.now()) })
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
        <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto">
            <BackLink />
            <p className="text-sm text-danger mt-6">{error}</p>
        </div>
    )
    if (!d) return (
        <div className="px-4 md:px-8 py-8 max-w-7xl mx-auto space-y-4">
            <BackLink />
            <Skeleton className="h-40 rounded-2xl" />
            <div className="grid lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4"><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
                <div className="space-y-4"><Skeleton className="h-48 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
            </div>
        </div>
    )

    const c = d.challenge
    const metric = CHALLENGE_METRICS[c.metric]
    const status = challengeStatus(c, now)
    const unit = metric.unit
    // "1 day" / "2 days" — units are stored plural
    const fmt = (v: number) => `${v.toLocaleString()} ${v === 1 ? unit.replace(/s$/, '') : unit}`
    const isTeam = d.standings.format === 'team'
    const competing = !!d.mine

    // Podium entries from live standings (or the final snapshot once finished).
    const podium = d.standings.format === 'individual'
        ? d.standings.rows.slice(0, 5).map(r => ({ place: r.place, label: `${r.rank} ${r.name}`.trim(), score: r.score, mine: r.id === user?.id }))
        : d.standings.rows.slice(0, 5).map(t => ({ place: t.place, label: t.label, score: t.score, mine: t.isMine }))

    const todayReps = c.metric === 'reps' && d.race?.daily ? d.race.daily.mine.at(-1) ?? 0 : null

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl mx-auto">
            <BackLink />

            {/* ── Hero ───────────────────────────────────────────────────── */}
            <section className="mt-4 rounded-2xl bg-card border border-border p-5 md:p-6">
                <div className="flex flex-col lg:flex-row lg:items-end gap-6">
                    <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <StatusPill status={status} />
                            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium rounded-full bg-muted dark:bg-background text-muted-foreground px-2.5 py-0.5">
                                <MetricIcon metric={c.metric} size={13} />{metric.label}
                            </span>
                            <span className="text-[12px] text-muted-foreground">{formatLabel(c)}</span>
                        </div>
                        <h1 className="font-display font-extrabold text-[28px] md:text-[36px] tracking-tight text-foreground leading-[1.1]">{c.title}</h1>
                        {c.description && <p className="text-[14px] text-muted-foreground mt-2 max-w-2xl">{c.description}</p>}
                        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1"><Users size={13} />{scopeLabel(c)} · {d.participants} cadets</span>
                            <span className="inline-flex items-center gap-1"><CalendarDays size={13} />{windowLabel(c)}</span>
                            {c.metric === 'reps' && d.exercises.length > 0 && (
                                <span className="inline-flex items-center gap-1"><Target size={13} />Counts {d.exercises.map(e => e.name).join(' + ')}</span>
                            )}
                        </div>
                    </div>

                    {/* Clock + prize pool */}
                    <div className="lg:w-80 shrink-0 grid grid-cols-2 lg:grid-cols-1 gap-3">
                        <div className="rounded-xl bg-muted/60 dark:bg-background/60 p-3">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{status === 'ended' ? 'Ended' : status === 'upcoming' ? 'Starts in' : 'Time left'}</div>
                            <div className="font-display font-bold text-[20px] text-foreground leading-tight mt-0.5">{timeLeftLabel(c, now).replace(/^(Ended|Starts in) /, '').replace(/ left$/, '')}</div>
                            {status === 'live' && <TimeMeter startsAt={c.starts_at} endsAt={c.ends_at} now={now} className="mt-2" />}
                        </div>
                        <div className="rounded-xl bg-muted/60 dark:bg-background/60 p-3">
                            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold inline-flex items-center gap-1"><Gift size={12} />Prize pool</div>
                            {c.bonus_points > 0 ? (
                                <div className="mt-1 flex items-center gap-3">
                                    {AWARD_SHARES.map((s, i) => (
                                        <span key={i} className="inline-flex items-center gap-1 text-[13px] text-foreground tabular-nums">
                                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: MEDAL[i] }} aria-hidden />
                                            <span className="sr-only">{['1st', '2nd', '3rd'][i]}:</span>{Math.round(c.bonus_points * s)}
                                        </span>
                                    ))}
                                    <span className="text-[11px] text-muted-foreground">pts{isTeam ? ' each' : ''}</span>
                                </div>
                            ) : <div className="text-[13px] text-muted-foreground mt-1">Bragging rights</div>}
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Finished: what the caller earned ───────────────────────── */}
            {status === 'ended' && d.myAward && (
                <div className="mt-4 rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
                    <PlaceBadge place={d.myAward.place} size={44} />
                    <div>
                        <div className="font-display font-bold text-[18px] text-foreground">You placed {ordinal(d.myAward.place)}!</div>
                        <div className="text-[13px] text-muted-foreground">+{d.myAward.points} bonus points added to your leaderboard score.</div>
                    </div>
                </div>
            )}

            <div className="mt-4 grid gap-4 lg:grid-cols-3 items-start">
                {/* ── Main column ──────────────────────────────────────────── */}
                <div className="lg:col-span-2 space-y-4 min-w-0">
                    {competing ? (
                        <StandingCard d={d} fmt={fmt} isTeam={isTeam} status={status} mineId={user?.id} />
                    ) : (
                        <div className="rounded-2xl bg-card border border-border p-4 text-[13px] text-muted-foreground">
                            You&apos;re viewing as staff — only cadets compete.
                        </div>
                    )}

                    {c.metric === 'reps' && competing && status === 'live' && d.exercises.length > 0 && (
                        <Panel title="Log your reps" subtitle="One tap logs a set of each — e.g. your MTR before a meal. Adjust the counts if you did more.">
                            <QuickLogReps exercises={d.exercises} todayReps={todayReps} onLogged={() => void mutate()} />
                        </Panel>
                    )}

                    {status === 'upcoming' ? (
                        <Panel title="The race" subtitle="Starts counting when the challenge begins">
                            <div className="py-10 text-center text-sm text-muted-foreground">Everyone starts at zero on {windowLabel(c).split(' – ')[0]}.</div>
                        </Panel>
                    ) : d.race && d.race.lines.length > 0 ? (
                        <Panel title="The race" subtitle={`${isTeam ? 'Team averages' : 'Running totals'} by day — ${isTeam ? 'your team' : 'you'} vs the top 3`}>
                            <RaceChart days={d.race.days} lines={d.race.lines} unit={unit} mineLabel={isTeam ? 'Your team' : 'You'} />
                        </Panel>
                    ) : null}

                    {d.race?.daily && d.race.days.length > 1 && (
                        <Panel title="Your daily gains" subtitle={`${metric.label} added each day, vs the average cadet in this challenge`}>
                            <DailyBars days={d.race.days} mine={d.race.daily.mine} avg={d.race.daily.avg} unit={unit} />
                        </Panel>
                    )}
                </div>

                {/* ── Side column ──────────────────────────────────────────── */}
                <div className="space-y-4 min-w-0">
                    <Panel title={status === 'ended' ? 'Final podium' : 'Podium'} subtitle={status === 'ended' && c.finalized_at ? `${d.awardedCount} cadet${d.awardedCount === 1 ? '' : 's'} earned bonus points` : status === 'ended' ? 'Tallying results…' : 'If it ended right now'}>
                        <Podium entries={podium} fmt={fmt} />
                    </Panel>

                    <Panel
                        title={isTeam ? 'Team standings' : 'Standings'}
                        subtitle={isTeam ? 'Ranked by members’ average — every member counts' : `Ranked by ${metric.label.toLowerCase()}`}>
                        {d.standings.format === 'team'
                            ? <TeamList rows={d.standings.rows} fmt={fmt} />
                            : <IndividualList rows={d.standings.rows} fmt={fmt} showAll={showAll} onShowAll={() => setShowAll(true)} mineId={user?.id} />}
                    </Panel>

                    {d.standings.format === 'individual' && status !== 'upcoming' && d.standings.rows.length >= 5 && (
                        <Panel title="Where everyone stands" subtitle={`Cadets by ${metric.label.toLowerCase()} so far`}>
                            <ScoreDistribution scores={d.standings.rows.map(r => r.score)} myScore={d.mine?.score ?? null} unit={unit} />
                        </Panel>
                    )}

                    <Panel title="How it works">
                        <ul className="space-y-2 text-[13px] text-muted-foreground">
                            <li className="flex gap-2"><MetricIcon metric={c.metric} size={15} className="mt-0.5 shrink-0" /><span><span className="text-foreground font-medium">{metric.label}:</span> {metric.hint.toLowerCase()}.</span></li>
                            <li className="flex gap-2"><Users size={15} className="mt-0.5 shrink-0" /><span>Everyone in {scopeLabel(c)} is in automatically{isTeam ? ', and teams are ranked by their members’ average' : ''}.</span></li>
                            <li className="flex gap-2"><TrendingUp size={15} className="mt-0.5 shrink-0" /><span>Scores update from what you log — no need to submit anything.</span></li>
                            {c.bonus_points > 0 && <li className="flex gap-2"><Gift size={15} className="mt-0.5 shrink-0" /><span>Top 3 earn {AWARD_SHARES.map(s => Math.round(c.bonus_points * s)).join(' / ')} leaderboard points{isTeam ? ' (each scoring member)' : ''}.</span></li>}
                        </ul>
                    </Panel>

                    {d.canManage && (
                        <div className="flex justify-end">
                            <Button variant="outline" onClick={() => setConfirmCancel(true)}>Cancel challenge</Button>
                        </div>
                    )}
                </div>
            </div>

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

function StatusPill({ status }: { status: 'live' | 'upcoming' | 'ended' }) {
    return (
        <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-0.5',
            status === 'live' ? 'bg-success-light text-success-dark' : 'bg-muted dark:bg-background text-muted-foreground')}>
            {status === 'live' && <span className="relative flex w-1.5 h-1.5"><span className="absolute inset-0 rounded-full bg-success animate-ping opacity-60" /><span className="relative rounded-full w-1.5 h-1.5 bg-success" /></span>}
            {STATUS_LABEL[status]}
        </span>
    )
}

// ── Your standing: place, score, percentile and the gap to the next place ─────
function StandingCard({ d, fmt, isTeam, status, mineId }: {
    d: Detail; fmt: (v: number) => string; isTeam: boolean; status: 'live' | 'upcoming' | 'ended'; mineId?: string
}) {
    const mine = d.mine!
    // Individual: the row just above me (next place up) and the runner-up if I lead.
    let place: number | null = null, of = 0, score = mine.score, gapText = '', leader = 0
    if (d.standings.format === 'individual') {
        const rows = d.standings.rows
        const me = rows.find(r => r.id === mineId)
        place = me?.place ?? mine.place; of = rows.length; leader = rows[0]?.score ?? 0
        const ahead = [...rows].reverse().find(r => r.score > score)
        if (status === 'upcoming') gapText = 'Get ready — scores start at zero.'
        else if (!ahead) {
            const second = rows.find(r => r.id !== mineId && r.score <= score)
            const tied = rows.filter(r => r.id !== mineId && r.score === score).length
            gapText = score === 0 ? 'Nobody has scored yet — log something to take the lead.'
                : tied ? `${status === 'ended' ? 'Tied' : 'You’re tied'} for 1st with ${tied} other${tied === 1 ? '' : 's'}.`
                : second ? `You’re leading by ${fmt(Math.round((score - second.score) * 10) / 10)}.` : 'You’re leading!'
        } else gapText = `${fmt(Math.round((ahead.score - score) * 10) / 10)} behind ${ahead.rank} ${ahead.name} (#${ahead.place}).`
    } else if (mine.team) {
        const rows = d.standings.rows
        place = mine.team.place; of = mine.team.of; score = mine.team.score; leader = rows[0]?.score ?? 0
        const ahead = [...rows].reverse().find(t => t.score > score)
        gapText = status === 'upcoming' ? 'Get your section ready.'
            : ahead ? `Your team is ${fmt(Math.round((ahead.score - score) * 10) / 10)} (avg) behind ${ahead.label}.`
            : score <= 0 ? 'No team has scored yet.'
            : rows.filter(t => t.score === score).length > 1 ? 'Your team is tied for 1st!' : 'Your team is in the lead!'
    }
    const pctTop = place && of ? Math.max(1, Math.ceil((place / of) * 100)) : null
    const final = status === 'ended'

    return (
        <section className="rounded-2xl bg-card border border-border p-5">
            <div className="flex flex-wrap items-center gap-5">
                {place ? <PlaceBadge place={place} size={64} scored={score > 0} /> : null}
                <div className="flex-1 min-w-[180px]">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {isTeam ? (mine.team ? `${mine.team.label}${final ? ' · final' : ''}` : 'Your team') : final ? 'Your final place' : 'Your place'}
                    </div>
                    {place ? (
                        <div className="font-display font-extrabold text-[28px] text-foreground leading-tight">
                            {ordinal(place)} <span className="text-[15px] font-semibold text-muted-foreground">of {of}{isTeam ? ' teams' : ''}</span>
                            {pctTop && pctTop <= 50 && score > 0 && <span className="ml-2 align-middle text-[11px] font-semibold rounded-full bg-success-light text-success-dark px-2 py-0.5">Top {pctTop}%</span>}
                        </div>
                    ) : (
                        <div className="text-[14px] text-muted-foreground mt-1">Set your platoon and section in Settings to join a team.</div>
                    )}
                    <div className="text-[13px] text-muted-foreground mt-1">{gapText}</div>
                </div>
                <div className="text-right">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{isTeam ? 'Your score' : 'Score'}</div>
                    <div className="font-display font-extrabold text-[32px] text-foreground leading-none tabular-nums mt-1">{mine.score.toLocaleString()}</div>
                    <div className="text-[12px] text-muted-foreground">{fmt(mine.score).replace(/^[\d.,]+ /, '')}</div>
                </div>
            </div>
            {place && leader > 0 && (
                <div className="mt-4">
                    <div className="h-2 rounded-full bg-muted dark:bg-background overflow-hidden" role="img" aria-label={`${isTeam ? 'Your team' : 'You'} at ${Math.round((score / leader) * 100)}% of the leader`}>
                        <div className="h-full rounded-full" style={{ width: `${Math.min(100, (score / leader) * 100)}%`, background: 'var(--viz-accent)' }} />
                    </div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                        <span>{isTeam ? 'Your team' : 'You'}: {fmt(score)}</span><span>Leader: {fmt(leader)}</span>
                    </div>
                </div>
            )}
        </section>
    )
}

// A leaderboard row: place · label · bar (accent for "you", grey for others) · value.
function Row({ place, label, sub, value, max, mine, fmt }: {
    place: number; label: string; sub?: string; value: number; max: number; mine: boolean; fmt: (v: number) => string
}) {
    return (
        <li className={cn('flex items-center gap-3 rounded-xl px-2 py-2', mine && 'bg-muted dark:bg-background')}>
            <PlaceBadge place={place} size={26} scored={value > 0} />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between gap-3 text-[13px]">
                    <span className="truncate text-foreground font-medium">{label}{mine && <span className="ml-1.5 text-[11px] text-muted-foreground font-normal">(you)</span>}</span>
                    <span className="text-muted-foreground tabular-nums whitespace-nowrap">{fmt(value)}</span>
                </div>
                {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
                <div className="mt-1 h-1.5">
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

function TeamList({ rows, fmt }: { rows: TeamView[]; fmt: (v: number) => string }) {
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
