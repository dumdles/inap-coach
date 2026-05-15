'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isInstructor } from '@/lib/scoring'
import { Skeleton } from '@/components/ui/skeleton'
import { useRouter } from 'next/navigation'

type CadetRow = {
    id: string
    full_name: string
    rank: string
    wing: string
    score: number
    streak: number
    mealsToday: number
    position: number
}

function initials(name: string) {
    return name.split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
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

function StreakBar({ streak }: { streak: number }) {
    const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    return (
        <div className="flex items-center gap-0.5">
            {days.map((d, i) => (
                <div
                    key={i}
                    title={`${d}: ${i < streak ? 'Active' : 'Inactive'}`}
                    className={cn(
                        'w-4 h-4 rounded-sm text-[8px] font-bold flex items-center justify-center',
                        i < streak
                            ? 'bg-primary text-white'
                            : 'bg-muted text-muted-foreground',
                    )}
                >
                    {d}
                </div>
            ))}
        </div>
    )
}

function MealDots({ count }: { count: number }) {
    return (
        <div className="flex items-center gap-1">
            {[0, 1, 2].map(i => (
                <div
                    key={i}
                    className={cn(
                        'w-2.5 h-2.5 rounded-full',
                        i < count ? 'bg-primary' : 'bg-muted',
                    )}
                />
            ))}
        </div>
    )
}

export default function WingPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [profile, setProfile] = useState<{ rank: string; wing: string } | null>(null)
    const [cadets, setCadets] = useState<CadetRow[]>([])
    const [period, setPeriod] = useState<'week' | 'month'>('week')
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<'score' | 'streak' | 'name'>('score')

    useEffect(() => {
        if (!user) return
        supabase.from('users').select('rank, wing').eq('id', user.id).single()
            .then(({ data }) => {
                if (!data) return
                setProfile(data)
                if (!isInstructor(data.rank)) router.replace('/dashboard')
            })
    }, [user, router])

    const fetchCadets = useCallback(async () => {
        if (!user || !profile) return
        setLoading(true)
        const res = await fetch(
            `/api/leaderboard?scope=wing&wing=${encodeURIComponent(profile.wing)}&period=${period}&userId=${user.id}`,
        )
        const data = await res.json()
        setCadets(Array.isArray(data) ? data : [])
        setLoading(false)
    }, [user, profile, period])

    useEffect(() => { fetchCadets() }, [fetchCadets])

    const sorted = [...cadets].sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score
        if (sortBy === 'streak') return b.streak - a.streak
        return a.full_name.localeCompare(b.full_name)
    })

    const loggingToday = cadets.filter(c => c.mealsToday > 0).length
    const avgScore = cadets.length
        ? Math.round(cadets.reduce((s, c) => s + c.score, 0) / cadets.length)
        : 0
    const topStreak = cadets.reduce((max, c) => Math.max(max, c.streak), 0)

    const notLoggedCount = cadets.filter(c => c.mealsToday === 0).length
    const complianceRate = cadets.length ? Math.round((loggingToday / cadets.length) * 100) : 0
    const topStreaker = cadets.reduce((best, c) => c.streak > (best?.streak ?? 0) ? c : best, cadets[0])

    if (!profile || !isInstructor(profile.rank)) return null

    return (
        <div className="px-4 md:px-8 py-8 md:py-10">
            <div className="max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-2">
                <div>
                    <h1 className="font-display font-extrabold text-[32px] tracking-tight text-foreground leading-none mb-1">
                        {profile.wing} Wing
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Nutrition overview for your cadets
                    </p>
                </div>
                <div className="flex items-center bg-muted dark:bg-[#091E42] rounded-full p-0.5 gap-0.5 mt-1">
                    {(['week', 'month'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                'px-4 py-1.5 rounded-full text-[13px] font-medium transition-all',
                                period === p
                                    ? 'bg-card dark:bg-[#1F3460] text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {p === 'week' ? 'This week' : 'This month'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dynamic summary stats — skeleton until first load completes */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8">
                {/* Total cadets */}
                <div className="rounded-2xl bg-card border border-border p-5">
                    <div className="text-xs text-muted-foreground mb-2">Cadets</div>
                    <div className="font-display font-extrabold text-3xl text-foreground">{cadets.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">{profile.wing} Wing</div>
                </div>

                {/* Avg score with bar */}
                <div className="rounded-2xl bg-card border border-border p-5">
                    <div className="text-xs text-muted-foreground mb-2">Avg score</div>
                    <div className="font-display font-extrabold text-3xl text-foreground">{avgScore.toLocaleString()}</div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (avgScore / 840) * 100)}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">of 840 max/week</div>
                </div>

                {/* Logged today with compliance indicator */}
                <div className="rounded-2xl bg-card border border-border p-5">
                    <div className="text-xs text-muted-foreground mb-2">Logged today</div>
                    <div className="flex items-end gap-1.5">
                        <div className="font-display font-extrabold text-3xl text-foreground">{loggingToday}</div>
                        <div className="text-base text-muted-foreground mb-0.5">/ {cadets.length}</div>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700', complianceRate >= 80 ? 'bg-emerald-500' : complianceRate >= 50 ? 'bg-amber-400' : 'bg-destructive')}
                            style={{ width: `${complianceRate}%` }}
                        />
                    </div>
                    <div className={cn('text-[10px] mt-1 font-medium', complianceRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : complianceRate >= 50 ? 'text-amber-600' : 'text-destructive')}>
                        {complianceRate}% compliance {notLoggedCount > 0 ? `· ${notLoggedCount} not logged` : '· All logged!'}
                    </div>
                </div>

                {/* Top streaker */}
                <div className="rounded-2xl bg-card border border-border p-5">
                    <div className="text-xs text-muted-foreground mb-2">Top streak</div>
                    <div className="flex items-end gap-1.5">
                        <div className="font-display font-extrabold text-3xl text-foreground">{topStreak}</div>
                        <div className="text-base text-muted-foreground mb-0.5 flex items-center gap-1">days <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" className="text-warning"><path d="M12 2C10 5.5 8 7 8.5 10.5 7 9.5 7 7 7 7 5.5 9 6 12 6 12 6 15.5 8.2 18.5 11 18.5s5-3 5-6.5c0-2.5-1.5-4-1.5-4s0 2-1 2.5C14 8 12 2 12 2Z"/></svg></div>
                    </div>
                    {topStreaker && (
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                            by {topStreaker.full_name.split(' ')[0]}
                        </div>
                    )}
                </div>
            </div>

            {/* Sort controls */}
            <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-muted-foreground">Sort by</span>
                {(['score', 'streak', 'name'] as const).map(s => (
                    <button
                        key={s}
                        onClick={() => setSortBy(s)}
                        className={cn(
                            'px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize',
                            sortBy === s
                                ? 'bg-foreground text-background border-foreground'
                                : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="grid grid-cols-[32px_1fr_120px_100px_90px_90px] gap-4 px-5 py-3 border-b border-border bg-muted/40 min-w-[640px]">
                        {['#', 'Cadet', 'Score', 'Streak (7d)', "Today's meals", 'Status'].map(h => (
                            <Skeleton key={h} className="h-3 w-full max-w-[80px]" />
                        ))}
                    </div>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                        <div key={i} className="grid grid-cols-[32px_1fr_120px_100px_90px_90px] gap-4 px-5 py-4 border-b border-border last:border-0 items-center min-w-[640px]">
                            <Skeleton className="h-4 w-5" />
                            <div className="flex items-center gap-2.5">
                                <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                                <div className="space-y-1.5">
                                    <Skeleton className="h-3 w-28" />
                                    <Skeleton className="h-2.5 w-16" />
                                </div>
                            </div>
                            <Skeleton className="h-5 w-14" />
                            <div className="flex gap-0.5">
                                {[0,1,2,3,4,5,6].map(d => <Skeleton key={d} className="w-4 h-4 rounded-sm" />)}
                            </div>
                            <div className="flex gap-1">
                                {[0,1,2].map(d => <Skeleton key={d} className="w-2.5 h-2.5 rounded-full" />)}
                            </div>
                            <Skeleton className="h-5 w-20 rounded-full" />
                        </div>
                    ))}
                </div>
            ) : cadets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">No cadets found in {profile.wing} Wing.</p>
                </div>
            ) : (
                <div className="rounded-2xl border border-border bg-card overflow-hidden overflow-x-auto">
                    {/* Table header */}
                    <div className="grid grid-cols-[32px_1fr_120px_100px_90px_90px] gap-4 px-5 py-3 border-b border-border bg-muted/40 min-w-[640px]">
                        {['#', 'Cadet', 'Score', 'Streak (7d)', "Today's meals", 'Status'].map(h => (
                            <span key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {h}
                            </span>
                        ))}
                    </div>

                    {sorted.map((c, idx) => {
                        const notLogged = c.mealsToday === 0
                        return (
                            <Link
                                key={c.id}
                                href={`/dashboard/wing/cadet/${c.id}`}
                                className={cn(
                                    'grid grid-cols-[32px_1fr_120px_100px_90px_90px] gap-4 px-5 py-3.5 border-b border-border last:border-0 items-center min-w-[640px]',
                                    'hover:bg-muted/50 transition-colors cursor-pointer',
                                    notLogged && 'bg-destructive/[0.03]',
                                )}
                            >
                                <span className="text-sm font-bold text-muted-foreground">{idx + 1}</span>
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className={cn(
                                            'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0',
                                            avatarColor(c.full_name),
                                        )}
                                    >
                                        {initials(c.full_name)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-medium text-foreground truncate">{c.full_name}</div>
                                        <div className="text-xs text-muted-foreground">{c.rank}</div>
                                    </div>
                                </div>
                                <span className="font-display font-bold text-base text-foreground tabular-nums">
                                    {c.score.toLocaleString()}
                                </span>
                                <StreakBar streak={Math.min(c.streak, 7)} />
                                <MealDots count={Math.min(c.mealsToday, 3)} />
                                <div className="flex items-center gap-2">
                                    <span
                                        className={cn(
                                            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold',
                                            notLogged
                                                ? 'bg-destructive/10 text-destructive'
                                                : c.mealsToday >= 3
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                                        )}
                                    >
                                        {notLogged ? 'Not logged' : c.mealsToday >= 3 ? 'On track' : 'Partial'}
                                    </span>
                                    <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 flex-shrink-0"><path d="M9 18l6-6-6-6" /></svg>
                                </div>
                            </Link>
                        )
                    })}
                </div>
            )}
            </div>
        </div>
    )
}
