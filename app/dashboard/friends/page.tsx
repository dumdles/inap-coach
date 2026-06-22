'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import gsap from 'gsap'

// ── Types ─────────────────────────────────────────────────────────────────────
type RankedUser = {
    id: string
    full_name: string
    rank: string
    wing: string
    score: number
    streak: number
    mealsToday: number
    position: number
}

type WingStanding = {
    wing: string
    avgScore: number
    memberCount: number
    position: number
}

type FriendUser = {
    id: string
    full_name: string
    rank: string
    wing: string
    friendshipId: string
}

type SearchUser = {
    id: string
    full_name: string
    rank: string
    wing: string
    section?: string
    sameSection?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

const AVATAR_COLORS = [
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-sky-500',
    'bg-teal-500', 'bg-emerald-500', 'bg-orange-500', 'bg-rose-500',
]

function avatarColor(name: string) {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
    const sz = size === 'lg' ? 'w-14 h-14 text-base' : size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-10 h-10 text-sm'
    return (
        <div className={cn('rounded-full flex items-center justify-center font-bold text-white flex-shrink-0', sz, avatarColor(name), className)}>
            {initials(name)}
        </div>
    )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function PeriodToggle({ value, onChange }: { value: 'week' | 'month'; onChange: (v: 'week' | 'month') => void }) {
    return (
        <div className="flex items-center bg-muted dark:bg-background rounded-full p-0.5 gap-0.5">
            {(['week', 'month'] as const).map(p => (
                <button
                    key={p}
                    onClick={() => onChange(p)}
                    className={cn(
                        'px-4 py-1.5 rounded-full text-[13px] font-medium transition-all',
                        value === p
                            ? 'bg-card text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                    )}
                >
                    {p === 'week' ? 'This week' : 'This month'}
                </button>
            ))}
        </div>
    )
}

function RankingCard({
    user,
    total,
    period,
}: {
    user: RankedUser | undefined
    total: number
    period: 'week' | 'month'
}) {
    const cardRef = useRef<HTMLDivElement>(null)
    const rankRef = useRef<HTMLDivElement>(null)
    const scoreRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!user || !cardRef.current) return
        const ctx = gsap.context(() => {
            // Slide card in
            gsap.fromTo(cardRef.current,
                { opacity: 0, y: 20 },
                { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' },
            )
            // Count up rank position and score
            const counter = { pos: 1, score: 0 }
            gsap.to(counter, {
                pos: user.position,
                score: user.score,
                duration: 1.1,
                ease: 'power2.out',
                delay: 0.2,
                onUpdate() {
                    if (rankRef.current) rankRef.current.textContent = `#${Math.round(counter.pos)}`
                    if (scoreRef.current) scoreRef.current.textContent = Math.round(counter.score).toLocaleString()
                },
            })
        })
        return () => ctx.revert()
    }, [user])

    if (!user) return null
    const ahead = total - user.position
    const label = period === 'week' ? 'week' : 'month'

    return (
        <div ref={cardRef} className="rounded-2xl bg-[#0D1F3C] p-6 text-white relative overflow-hidden" style={{ opacity: 0 }}>
            <div
                className="absolute inset-0 opacity-30"
                style={{ background: 'radial-gradient(ellipse at 70% 50%, #1e3a8a 0%, transparent 70%)' }}
            />
            <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4 flex-wrap">
                    <span className="text-xs font-semibold uppercase tracking-widest text-white/50">Your ranking</span>
                    <span className="bg-white/10 text-white/80 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {user.wing} Wing
                    </span>
                    {user.streak > 0 && (
                        <span className="ml-auto bg-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                            <svg viewBox="0 0 24 24" width={11} height={11} fill="currentColor"><path d="M12 2C10 5.5 8 7 8.5 10.5 7 9.5 7 7 7 7 5.5 9 6 12 6 12 6 15.5 8.2 18.5 11 18.5s5-3 5-6.5c0-2.5-1.5-4-1.5-4s0 2-1 2.5C14 8 12 2 12 2Z"/></svg>
                            {user.streak}-day streak
                        </span>
                    )}
                </div>
                <div className="flex items-end gap-8">
                    <div>
                        <div ref={rankRef} className="font-display font-extrabold text-[72px] leading-none tracking-tight">
                            #1
                        </div>
                        <div className="text-white/50 text-sm mt-1">of {total} cadets</div>
                    </div>
                    <div className="pb-2">
                        <div className="text-white/50 text-xs uppercase tracking-widest mb-1">Your score</div>
                        <div ref={scoreRef} className="font-display font-extrabold text-[40px] leading-none text-primary">
                            0
                        </div>
                        {ahead > 0 && (
                            <div className="text-white/40 text-xs mt-1.5">
                                You&apos;re ahead of {ahead} cadet{ahead !== 1 ? 's' : ''} for the {label}.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function Podium({ top3, currentUserId, clickableIds }: { top3: RankedUser[]; currentUserId: string; clickableIds?: Set<string> }) {
    const podiumRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!podiumRef.current || top3.length === 0) return
        const ctx = gsap.context(() => {
            gsap.fromTo('[data-podium-col]',
                { opacity: 0, y: 30 },
                { opacity: 1, y: 0, duration: 0.5, stagger: 0.1, ease: 'power3.out', delay: 0.15 },
            )
        }, podiumRef)
        return () => ctx.revert()
    }, [top3])

    if (top3.length === 0) return null
    const [first, second, third] = top3
    const order = [second, first, third].filter(Boolean)

    return (
        <div ref={podiumRef} className="rounded-2xl bg-card border border-border p-6">
            <h3 className="font-semibold text-foreground text-base mb-6">Top of the week</h3>
            <div className="flex items-end justify-center gap-4">
                {order.map(u => {
                    const isFirst = u.position === 1
                    const isClickable = u.id !== currentUserId && clickableIds?.has(u.id)
                    const inner = (
                        <>
                            <Avatar name={u.full_name} size="lg" className={isFirst ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''} />
                            <span className="text-xs font-medium text-foreground text-center leading-tight">
                                {u.full_name.split(' ')[0]}
                            </span>
                            <div
                                className={cn(
                                    'w-full rounded-xl flex flex-col items-center justify-center pt-4 pb-3 gap-0.5',
                                    isFirst ? 'bg-primary text-white min-h-[90px]' : 'bg-muted text-foreground min-h-[70px]',
                                )}
                            >
                                <span className={cn('font-display font-extrabold text-2xl', !isFirst && 'text-foreground')}>
                                    {u.score.toLocaleString()}
                                </span>
                                <span className={cn('text-[10px] font-semibold uppercase tracking-widest', isFirst ? 'text-white/70' : 'text-muted-foreground')}>
                                    Score
                                </span>
                            </div>
                        </>
                    )
                    const colClass = cn('flex flex-col items-center gap-2 flex-1', isClickable && 'cursor-pointer')
                    return isClickable ? (
                        <Link key={u.id} href={`/dashboard/wing/cadet/${u.id}`} className={colClass} data-podium-col style={{ opacity: 0 }}>{inner}</Link>
                    ) : (
                        <div key={u.id} className={colClass} data-podium-col style={{ opacity: 0 }}>{inner}</div>
                    )
                })}
            </div>
        </div>
    )
}

function LeaderboardList({ users, currentUserId, clickableIds }: { users: RankedUser[]; currentUserId: string; clickableIds?: Set<string> }) {
    const listRef = useRef<HTMLDivElement>(null)
    const rest = users.slice(3)

    useEffect(() => {
        if (!listRef.current || rest.length === 0) return
        const ctx = gsap.context(() => {
            gsap.fromTo('[data-lb-row]',
                { opacity: 0, x: -10 },
                { opacity: 1, x: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' },
            )
        }, listRef)
        return () => ctx.revert()
    }, [rest.length])

    if (rest.length === 0) return null
    return (
        <div ref={listRef} className="rounded-2xl bg-card border border-border overflow-hidden">
            {rest.map(u => {
                const isClickable = u.id !== currentUserId && clickableIds?.has(u.id)
                const inner = (
                    <>
                        <span className="w-6 text-center text-sm font-bold text-muted-foreground">{u.position}</span>
                        <Avatar name={u.full_name} size="sm" />
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                                {u.full_name}
                                {u.id === currentUserId && <span className="ml-1.5 text-xs text-primary font-normal">(you)</span>}
                            </div>
                            <div className="text-xs text-muted-foreground">{u.rank} · {u.wing} Wing</div>
                        </div>
                        {u.streak > 0 && (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor" className="text-warning"><path d="M12 2C10 5.5 8 7 8.5 10.5 7 9.5 7 7 7 7 5.5 9 6 12 6 12 6 15.5 8.2 18.5 11 18.5s5-3 5-6.5c0-2.5-1.5-4-1.5-4s0 2-1 2.5C14 8 12 2 12 2Z"/></svg>
                                {u.streak}
                            </span>
                        )}
                        <span className="text-sm font-bold text-foreground tabular-nums">{u.score.toLocaleString()}</span>
                    </>
                )
                const rowClass = cn(
                    'flex items-center gap-3 px-5 py-3 border-b border-border last:border-0',
                    u.id === currentUserId && 'bg-primary/5',
                    isClickable && 'hover:bg-accent/50 cursor-pointer',
                )
                return isClickable ? (
                    <Link key={u.id} href={`/dashboard/wing/cadet/${u.id}`} className={rowClass} data-lb-row style={{ opacity: 0 }}>{inner}</Link>
                ) : (
                    <div key={u.id} className={rowClass} data-lb-row style={{ opacity: 0 }}>{inner}</div>
                )
            })}
        </div>
    )
}

function WingStandingsCard({ standings, period }: { standings: WingStanding[]; period: 'week' | 'month' }) {
    const barRefs = useRef<(HTMLDivElement | null)[]>([])
    const max = standings[0]?.avgScore ?? 1

    useEffect(() => {
        if (standings.length === 0) return
        const targets = standings.slice(0, 5).map(w => (w.avgScore / max) * 100)
        const ctx = gsap.context(() => {
            gsap.fromTo(
                barRefs.current.filter(Boolean),
                { width: '0%' },
                {
                    width: (i: number) => `${targets[i]}%`,
                    duration: 1,
                    stagger: 0.1,
                    ease: 'power3.out',
                    delay: 0.25,
                },
            )
        })
        return () => ctx.revert()
    }, [standings, max])

    if (standings.length === 0) return null
    return (
        <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="font-semibold text-foreground text-sm mb-0.5">Wing standings</h3>
            <p className="text-xs text-muted-foreground mb-4">
                {period === 'week' ? 'for the past week' : 'for the past month'}
            </p>
            <div className="flex flex-col gap-3">
                {standings.slice(0, 5).map((w, i) => (
                    <div key={w.wing} className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground flex-shrink-0">
                            {w.position}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-foreground">{w.wing} Wing</span>
                                <span className="text-xs text-muted-foreground tabular-nums">{w.avgScore}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    ref={el => { barRefs.current[i] = el }}
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: '0%' }}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function PendingRequestsCard({
    received,
    onAccept,
    onReject,
}: {
    received: FriendUser[]
    onAccept: (id: string) => void
    onReject: (id: string) => void
}) {
    if (received.length === 0) return null
    return (
        <div className="rounded-2xl bg-card border border-border p-5">
            <h3 className="font-semibold text-foreground text-sm mb-3">Friend requests</h3>
            <div className="flex flex-col gap-2">
                {received.map(u => (
                    <div key={u.id} className="flex items-center gap-3">
                        <Avatar name={u.full_name} size="sm" />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{u.full_name}</div>
                            <div className="text-[11px] text-muted-foreground">{u.rank} · {u.wing} Wing</div>
                        </div>
                        <button
                            onClick={() => onAccept(u.friendshipId)}
                            className="text-xs font-semibold text-primary hover:underline"
                        >
                            Accept
                        </button>
                        <button
                            onClick={() => onReject(u.friendshipId)}
                            className="text-xs font-medium text-muted-foreground hover:text-destructive"
                        >
                            Decline
                        </button>
                    </div>
                ))}
            </div>
        </div>
    )
}

function FriendsListCard({
    friends,
    onRemove,
}: {
    friends: FriendUser[]
    onRemove: (friendshipId: string) => void
}) {
    const [confirmId, setConfirmId] = useState<string | null>(null)

    if (friends.length === 0) {
        return (
            <div className="rounded-2xl bg-card border border-border p-5">
                <h3 className="font-semibold text-foreground text-sm mb-3">My Friends</h3>
                <p className="text-xs text-muted-foreground text-center py-4">No friends yet. Add some!</p>
            </div>
        )
    }

    return (
        <div className="rounded-2xl bg-card border border-border overflow-hidden">
            <div className="px-5 pt-4 pb-3 flex items-center justify-between">
                <h3 className="font-semibold text-foreground text-sm">My Friends</h3>
                <span className="text-xs text-muted-foreground">{friends.length}</span>
            </div>
            <div className="border-t border-border">
                {friends.map(u => (
                    <div key={u.id} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0">
                        <Avatar name={u.full_name} size="sm" />
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-foreground truncate">{u.full_name}</div>
                            <div className="text-[11px] text-muted-foreground">{u.rank} · {u.wing} Wing</div>
                        </div>
                        {confirmId === u.friendshipId ? (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => { onRemove(u.friendshipId); setConfirmId(null) }}
                                    className="text-[11px] font-semibold text-destructive hover:underline"
                                >
                                    Confirm
                                </button>
                                <button
                                    onClick={() => setConfirmId(null)}
                                    className="text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmId(u.friendshipId)}
                                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                            >
                                Remove
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}

function AddFriendDialog({
    open,
    onClose,
    currentUserId,
    existingIds,
    pendingSentIds,
    pendingReceived,
    onSent,
    onAccept,
    onReject,
}: {
    open: boolean
    onClose: () => void
    currentUserId: string
    existingIds: Set<string>
    pendingSentIds: Set<string>
    pendingReceived: FriendUser[]
    onSent: () => void
    onAccept: (id: string) => void
    onReject: (id: string) => void
}) {
    type DialogTab = 'suggested' | 'pending'
    const [dialogTab, setDialogTab] = useState<DialogTab>('suggested')
    const [query, setQuery] = useState('')
    const [searchResults, setSearchResults] = useState<SearchUser[]>([])
    const [suggested, setSuggested] = useState<SearchUser[]>([])
    const [sent, setSent] = useState<Set<string>>(new Set())
    const [searching, setSearching] = useState(false)
    const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    useEffect(() => {
        if (!open) { setQuery(''); setSearchResults([]); setSent(new Set()) }
        if (open && currentUserId) {
            fetch(`/api/users/suggested?userId=${currentUserId}`)
                .then(r => r.json())
                .then(d => setSuggested(Array.isArray(d) ? d : []))
        }
    }, [open, currentUserId])

    useEffect(() => {
        clearTimeout(debounce.current)
        if (query.trim().length < 2) { setSearchResults([]); return }
        debounce.current = setTimeout(async () => {
            setSearching(true)
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}&excludeId=${currentUserId}`)
            const data = await res.json()
            setSearchResults(data)
            setSearching(false)
        }, 300)
    }, [query, currentUserId])

    const sendRequest = async (addresseeId: string) => {
        await fetch('/api/friendships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requesterId: currentUserId, addresseeId }),
        })
        setSent(prev => new Set([...prev, addresseeId]))
        onSent()
    }

    const isSearching = query.trim().length >= 2
    const displayList: SearchUser[] = isSearching ? searchResults : suggested

    const TABS: { id: DialogTab; label: string }[] = [
        { id: 'suggested', label: 'Suggested' },
        { id: 'pending',   label: `Pending${pendingReceived.length > 0 ? ` (${pendingReceived.length})` : ''}` },
    ]

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
                <div className="px-6 pt-6 pb-0">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Add friends</DialogTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Connect with friends to compare progress in your Friends leaderboard.
                        </p>
                    </DialogHeader>

                    {/* Search */}
                    <div className="relative mt-4">
                        <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
                            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input
                            autoFocus
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Search by name or username"
                            className="w-full rounded-xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                    </div>

                    {/* Tabs */}
                    {!isSearching && (
                        <div className="flex items-center gap-2 mt-4">
                            {TABS.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setDialogTab(t.id)}
                                    className={cn(
                                        'px-4 py-1.5 rounded-lg text-sm font-semibold transition-all',
                                        dialogTab === t.id
                                            ? 'bg-primary text-white'
                                            : 'text-primary hover:bg-primary/10',
                                    )}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="border-t border-border mt-4" />

                {/* List */}
                <div className="overflow-y-auto max-h-[360px] px-6 py-2">
                    {/* Pending tab */}
                    {!isSearching && dialogTab === 'pending' && (
                        pendingReceived.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No pending requests.</p>
                        ) : (
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2">
                                    Requests received
                                </p>
                                {pendingReceived.map(u => (
                                    <div key={u.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                                        <Avatar name={u.full_name} size="md" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-semibold text-foreground">{u.rank} {u.full_name}</div>
                                            <div className="text-xs text-primary">{u.wing} Wing</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => onAccept(u.friendshipId)}>Accept</Button>
                                            <Button size="sm" variant="outline" onClick={() => onReject(u.friendshipId)}>Decline</Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    )}

                    {/* Suggested / search results */}
                    {(isSearching || dialogTab === 'suggested') && (
                        <>
                            {searching && <p className="text-xs text-muted-foreground py-4 text-center">Searching…</p>}
                            {!searching && isSearching && displayList.length === 0 && (
                                <p className="text-xs text-muted-foreground py-4 text-center">No results found.</p>
                            )}
                            {!searching && displayList.length > 0 && (
                                <>
                                    {!isSearching && (
                                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2">
                                            People you might know
                                        </p>
                                    )}
                                    {displayList.map(u => {
                                        const isFriend = existingIds.has(u.id)
                                        const isPending = pendingSentIds.has(u.id) || sent.has(u.id)
                                        const subtitle = u.sameSection
                                            ? 'Same section'
                                            : `${u.wing} Wing`
                                        return (
                                            <div key={u.id} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                                                <Avatar name={u.full_name} size="md" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-sm font-semibold text-foreground truncate">
                                                        {u.rank} {u.full_name}
                                                    </div>
                                                    <div className="text-xs text-primary">{subtitle}</div>
                                                </div>
                                                {isFriend ? (
                                                    <span className="text-xs text-muted-foreground px-3">Friends</span>
                                                ) : isPending ? (
                                                    <span className="text-xs text-muted-foreground font-medium px-3">Pending</span>
                                                ) : (
                                                    <Button size="sm" onClick={() => sendRequest(u.id)}>Add</Button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </>
                            )}
                            {!searching && !isSearching && suggested.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-8">No suggestions yet.</p>
                            )}
                        </>
                    )}
                </div>
                <div className="pb-4" />
            </DialogContent>
        </Dialog>
    )
}

// ── Page ──────────────────────────────────────────────────────────────────────
type LeaderTab = 'wing' | 'section' | 'friends'
const VALID_LEADER_TABS = new Set<LeaderTab>(['wing', 'section', 'friends'])

export default function FriendsPage() {
    const { user } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [profile, setProfile] = useState<{ rank: string; wing: string; section?: string } | null>(null)
    const initialTab = (searchParams.get('tab') ?? '') as LeaderTab
    const [tab, setTab] = useState<LeaderTab>(VALID_LEADER_TABS.has(initialTab) ? initialTab : 'wing')

    function changeTab(t: LeaderTab) {
        setTab(t)
        const params = new URLSearchParams(searchParams.toString())
        params.set('tab', t)
        router.replace(`?${params.toString()}`, { scroll: false })
    }
    const [period, setPeriod] = useState<'week' | 'month'>('week')
    const [leaderboard, setLeaderboard] = useState<RankedUser[]>([])
    const [wingStandings, setWingStandings] = useState<WingStanding[]>([])
    const [friends, setFriends] = useState<FriendUser[]>([])
    const [pendingReceived, setPendingReceived] = useState<FriendUser[]>([])
    const [addOpen, setAddOpen] = useState(false)
    const [loadingBoard, setLoadingBoard] = useState(true)
    const [existingFriendIds, setExistingFriendIds] = useState<Set<string>>(new Set())
    const [pendingSentIds, setPendingSentIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!user) return
        supabase.from('users').select('rank, wing, section').eq('id', user.id).single()
            .then(({ data }) => { if (data) setProfile(data) })
    }, [user])

    const fetchFriends = useCallback(async () => {
        if (!user) return
        const res = await fetch(`/api/friendships?userId=${user.id}`)
        const data = await res.json()
        const acceptedFriends: FriendUser[] = data.friends ?? []
        setFriends(acceptedFriends)
        // Only accepted friends go into existingFriendIds — pending sent tracked separately
        setExistingFriendIds(new Set<string>([
            ...acceptedFriends.map(f => f.id),
            ...(data.pendingReceived ?? []).map((f: FriendUser) => f.id),
        ]))
        setPendingSentIds(new Set<string>((data.pendingSent ?? []).map((f: FriendUser) => f.id)))
        setPendingReceived(data.pendingReceived ?? [])
    }, [user])

    useEffect(() => { fetchFriends() }, [fetchFriends])

    const fetchLeaderboard = useCallback(async () => {
        if (!user || !profile) return
        setLoadingBoard(true)
        const scope = tab === 'wing' ? 'wing' : tab === 'section' ? 'section' : 'friends'
        const wingParam = tab === 'wing' && profile.wing ? `&wing=${encodeURIComponent(profile.wing)}` : ''
        const res = await fetch(
            `/api/leaderboard?scope=${scope}&period=${period}&userId=${user.id}${wingParam}`,
        )
        const data = await res.json()
        setLeaderboard(Array.isArray(data) ? data : [])
        setLoadingBoard(false)
    }, [user, profile, tab, period])

    useEffect(() => { fetchLeaderboard() }, [fetchLeaderboard])

    useEffect(() => {
        fetch(`/api/wing-standings?period=${period}`)
            .then(r => r.json())
            .then(d => setWingStandings(Array.isArray(d) ? d : []))
    }, [period])

    const handleAccept = async (friendshipId: string) => {
        await fetch('/api/friendships', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendshipId, action: 'accept' }),
        })
        fetchFriends()
        fetchLeaderboard()
    }

    const handleReject = async (friendshipId: string) => {
        await fetch('/api/friendships', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ friendshipId, action: 'reject' }),
        })
        fetchFriends()
    }

    const handleUnfriend = async (friendshipId: string) => {
        await fetch(`/api/friendships?id=${friendshipId}`, { method: 'DELETE' })
        fetchFriends()
        fetchLeaderboard()
    }

    const me = leaderboard.find(u => u.id === user?.id)
    const top3 = leaderboard.slice(0, 3)
    const noMealYet = me && me.mealsToday === 0

    return (
        <div className="px-4 md:px-8 py-8 md:py-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 md:mb-8">
                <h1 className="font-display font-extrabold text-[28px] md:text-[32px] tracking-tight text-foreground leading-none">
                    Where you stand
                </h1>
                <div className="flex items-center gap-3">
                    <PeriodToggle value={period} onChange={setPeriod} />
                    <Button
                        size="sm"
                        onClick={() => setAddOpen(true)}
                        className="relative"
                    >
                        Add friend
                        {pendingReceived.length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center">
                                {pendingReceived.length}
                            </span>
                        )}
                    </Button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
                {(['wing', 'section', 'friends'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => changeTab(t)}
                        className={cn(
                            'flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium border transition-all',
                            tab === t
                                ? 'bg-foreground text-background border-foreground'
                                : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {t === 'wing' ? (
                            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                        ) : t === 'section' ? (
                            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                        )}
                        {t === 'wing' ? `${profile?.wing ?? ''} Wing` : t === 'section' ? (profile?.section ? `Section ${profile.section}` : 'My Section') : 'Friends'}
                    </button>
                ))}
            </div>

            {loadingBoard ? (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
                    {/* Left skeleton */}
                    <div className="flex flex-col gap-5">
                        {/* Ranking card skeleton */}
                        <div className="rounded-2xl bg-muted/60 p-6 h-[168px] flex flex-col gap-4">
                            <div className="flex gap-3">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                            </div>
                            <div className="flex items-end gap-8 mt-2">
                                <Skeleton className="h-16 w-24" />
                                <div className="space-y-2 pb-2">
                                    <Skeleton className="h-2.5 w-16" />
                                    <Skeleton className="h-10 w-28" />
                                    <Skeleton className="h-2.5 w-40" />
                                </div>
                            </div>
                        </div>
                        {/* Podium skeleton */}
                        <div className="rounded-2xl bg-card border border-border p-6">
                            <Skeleton className="h-4 w-32 mb-6" />
                            <div className="flex items-end justify-center gap-4">
                                {[70, 90, 70].map((h, i) => (
                                    <div key={i} className="flex flex-col items-center gap-2 flex-1">
                                        <Skeleton className="w-14 h-14 rounded-full" />
                                        <Skeleton className="h-3 w-16" />
                                        <div className={`w-full rounded-xl animate-pulse bg-muted`} style={{ height: h }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* List rows skeleton */}
                        <div className="rounded-2xl bg-card border border-border overflow-hidden">
                            {[0, 1, 2, 3, 4].map(i => (
                                <div key={i} className="flex items-center gap-3 px-5 py-3 border-b border-border last:border-0">
                                    <Skeleton className="w-5 h-4" />
                                    <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <Skeleton className="h-3 w-32" />
                                        <Skeleton className="h-2.5 w-24" />
                                    </div>
                                    <Skeleton className="h-4 w-10" />
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Right skeleton */}
                    <div className="flex flex-col gap-4">
                        <div className="rounded-2xl bg-card border border-border p-5">
                            <Skeleton className="h-4 w-28 mb-4" />
                            <div className="flex flex-col gap-3">
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center gap-3">
                                        <Skeleton className="w-7 h-7 rounded-lg flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="flex justify-between">
                                                <Skeleton className="h-3 w-16" />
                                                <Skeleton className="h-3 w-8" />
                                            </div>
                                            <Skeleton className="h-1.5 w-full rounded-full" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
                    {/* Left */}
                    <div className="flex flex-col gap-5">
                        <RankingCard user={me} total={leaderboard.length} period={period} />
                        <Podium top3={top3} currentUserId={user?.id ?? ''} clickableIds={tab === 'friends' ? existingFriendIds : undefined} />
                        <LeaderboardList users={leaderboard} currentUserId={user?.id ?? ''} clickableIds={tab === 'friends' ? existingFriendIds : undefined} />
                    </div>

                    {/* Right */}
                    <div className="flex flex-col gap-4">
                        {pendingReceived.length > 0 && (
                            <PendingRequestsCard
                                received={pendingReceived}
                                onAccept={handleAccept}
                                onReject={handleReject}
                            />
                        )}
                        {noMealYet && (
                            <div className="rounded-2xl border border-dashed border-border bg-card p-5 flex items-center justify-between gap-4">
                                <div>
                                    <p className="font-semibold text-foreground text-sm">Have you had your dinner yet?</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">Log a meal now to gain more points!</p>
                                </div>
                                <a href="/dashboard/nutrition">
                                    <Button size="sm">Log a meal</Button>
                                </a>
                            </div>
                        )}
                        <WingStandingsCard standings={wingStandings} period={period} />
                        <FriendsListCard friends={friends} onRemove={handleUnfriend} />
                    </div>
                </div>
            )}

            <AddFriendDialog
                open={addOpen}
                onClose={() => setAddOpen(false)}
                currentUserId={user?.id ?? ''}
                existingIds={existingFriendIds}
                pendingSentIds={pendingSentIds}
                pendingReceived={pendingReceived}
                onSent={() => { fetchFriends(); fetchLeaderboard() }}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </div>
    )
}
