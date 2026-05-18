'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const COOLDOWN_MS = 60 * 60 * 1000 // 1 hour between manual refreshes
const COOLDOWN_KEY = 'insights_last_refresh'

type Insight = {
    id: string
    priority: 'high' | 'medium' | 'low'
    category: 'nutrition' | 'weight' | 'performance' | 'recovery' | 'adherence'
    title: string
    observation: string
    action: string
}

type InsightsData = {
    summary: string
    insights: Insight[]
    generated_at: string
}

const PRIORITY_CARD: Record<Insight['priority'], string> = {
    high:   'border-danger/30 bg-danger/5',
    medium: 'border-yellow-400/30 bg-yellow-400/5',
    low:    'border-border bg-card',
}
const PRIORITY_BADGE: Record<Insight['priority'], string> = {
    high:   'bg-danger/10 text-danger border-danger/20',
    medium: 'bg-yellow-400/10 text-yellow-600 dark:text-yellow-400 border-yellow-400/20',
    low:    'bg-muted text-muted-foreground border-transparent',
}
const PRIORITY_LABEL: Record<Insight['priority'], string> = {
    high: 'High', medium: 'Medium', low: 'Low',
}
const CATEGORY_META: Record<Insight['category'], { label: string; icon: React.ReactNode }> = {
    nutrition:   { label: 'Nutrition',   icon: <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" /> },
    weight:      { label: 'Body',        icon: <><path d="M5 7h14l-1 13H6L5 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></> },
    performance: { label: 'Performance', icon: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></> },
    recovery:    { label: 'Recovery',    icon: <><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 6v6l4 2"/></> },
    adherence:   { label: 'Adherence',   icon: <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> },
}

function relativeTime(iso: string) {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
    return (
        <svg
            viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor"
            strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className={cn('transition-transform', spinning && 'animate-spin')}
        >
            <path d="M23 4v6h-6" />
            <path d="M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
    )
}

function ArrowIcon() {
    return (
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor"
            strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5 text-primary">
            <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
    )
}

function InsightCard({ insight }: { insight: Insight }) {
    const cat = CATEGORY_META[insight.category]
    return (
        <div className={cn('rounded-2xl p-5 border', PRIORITY_CARD[insight.priority])}>
            {/* Header row: category icon + label, priority badge */}
            <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                            {cat.icon}
                        </svg>
                    </div>
                    <span className="text-[11px] font-semibold text-muted-foreground">{cat.label}</span>
                </div>
                <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                    PRIORITY_BADGE[insight.priority]
                )}>
                    {PRIORITY_LABEL[insight.priority]}
                </span>
            </div>

            <div className="font-semibold text-[15px] text-foreground mb-1.5 leading-snug">{insight.title}</div>
            <div className="text-[13px] text-muted-foreground mb-3 leading-relaxed">{insight.observation}</div>

            {/* Action box */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <ArrowIcon />
                <div className="text-[13px] text-foreground leading-relaxed">{insight.action}</div>
            </div>
        </div>
    )
}

export default function InsightsPage() {
    const { user } = useAuth()
    const [data, setData] = useState<InsightsData | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [error, setError] = useState(false)
    const [cooldownRemaining, setCooldownRemaining] = useState(0)

    // Tick down the cooldown every second
    useEffect(() => {
        const stored = parseInt(localStorage.getItem(COOLDOWN_KEY) ?? '0')
        const remaining = Math.max(0, stored + COOLDOWN_MS - Date.now())
        setCooldownRemaining(remaining)
        if (remaining <= 0) return
        const interval = setInterval(() => {
            const r = Math.max(0, stored + COOLDOWN_MS - Date.now())
            setCooldownRemaining(r)
            if (r === 0) clearInterval(interval)
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    const fetchInsights = useCallback(async (refresh = false) => {
        if (!user) return

        if (refresh) {
            const stored = parseInt(localStorage.getItem(COOLDOWN_KEY) ?? '0')
            const remaining = Math.max(0, stored + COOLDOWN_MS - Date.now())
            if (remaining > 0) {
                const mins = Math.ceil(remaining / 60_000)
                toast.warning(`Refresh cooldown active — try again in ${mins} min${mins !== 1 ? 's' : ''}.`)
                return
            }
            localStorage.setItem(COOLDOWN_KEY, Date.now().toString())
            setCooldownRemaining(COOLDOWN_MS)
            setRefreshing(true)
        } else {
            setLoading(true)
        }

        setError(false)
        try {
            const url = `/api/insights?userId=${user.id}${refresh ? '&refresh=1' : ''}`
            const res = await fetch(url)
            if (!res.ok) throw new Error('ai_unavailable')
            const json = await res.json()
            setData(json)
        } catch {
            setError(true)
        } finally {
            setLoading(false)
            setRefreshing(false)
        }
    }, [user])

    useEffect(() => { fetchInsights() }, [fetchInsights])

    if (loading) {
        return (
            <div className="px-4 sm:px-8 pt-16 sm:pt-8 pb-24 max-w-2xl mx-auto space-y-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-28" />
                        <Skeleton className="h-4 w-56" />
                    </div>
                    <Skeleton className="h-9 w-24 rounded-full" />
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col items-center text-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    <div>
                        <p className="font-semibold text-foreground text-[15px]">Analysing your data…</p>
                        <p className="text-[13px] text-muted-foreground mt-1">Your AI coach is reviewing the last 14 days of nutrition, workouts, and progress. This may take up to 30 seconds.</p>
                    </div>
                </div>
                {[0, 1, 2].map(i => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
        )
    }

    if (error || !data) {
        return (
            <div className="px-4 sm:px-8 pt-16 sm:pt-8 pb-24 max-w-2xl mx-auto space-y-6">
                <div>
                    <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground leading-none">Insights</h1>
                    <p className="text-sm text-muted-foreground mt-1.5">AI-powered coaching based on your last 14 days</p>
                </div>
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                        <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                    </div>
                    <div>
                        <p className="font-semibold text-foreground text-[15px]">Could not generate insights</p>
                        <p className="text-[13px] text-muted-foreground mt-1">This may be a temporary issue. Try again in a moment.</p>
                    </div>
                    <button
                        onClick={() => fetchInsights(true)}
                        disabled={refreshing || cooldownRemaining > 0}
                        className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                        title={cooldownRemaining > 0 ? `Available in ${Math.ceil(cooldownRemaining / 60_000)} min` : undefined}
                    >
                        <RefreshIcon spinning={refreshing} />
                        {refreshing ? 'Retrying…' : cooldownRemaining > 0 ? `Try again in ${Math.ceil(cooldownRemaining / 60_000)}m` : 'Retry'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="px-4 sm:px-8 pt-16 sm:pt-8 pb-24 max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground leading-none">Insights</h1>
                    <p className="text-sm text-muted-foreground mt-1.5">AI-powered coaching based on your last 14 days</p>
                </div>
                <button
                    onClick={() => fetchInsights(true)}
                    disabled={refreshing || cooldownRemaining > 0}
                    className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 flex-shrink-0 mt-1"
                    title={cooldownRemaining > 0 ? `Available in ${Math.ceil(cooldownRemaining / 60_000)} min` : undefined}
                >
                    <RefreshIcon spinning={refreshing} />
                    {refreshing ? 'Refreshing…' : cooldownRemaining > 0 ? `${Math.ceil(cooldownRemaining / 60_000)}m` : 'Refresh'}
                </button>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)' }}>
                <div className="px-6 pt-5 pb-4">
                    <div className="flex items-center gap-2 mb-3">
                        <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2a8 8 0 0 1 8 8c0 3-1.5 5.5-4 7l-1 5H9l-1-5C5.5 15.5 4 13 4 10a8 8 0 0 1 8-8z" />
                            <line x1="9" y1="17" x2="15" y2="17" />
                        </svg>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Coach Summary</span>
                    </div>
                    <p className="text-[14px] text-white leading-relaxed">{data.summary}</p>
                </div>
                <div className="px-6 py-3 bg-black/10 flex items-center justify-between">
                    <span className="text-[11px] text-white/50">Updated {relativeTime(data.generated_at)}</span>
                    <span className="text-[11px] text-white/50">{data.insights.length} insight{data.insights.length !== 1 ? 's' : ''}</span>
                </div>
            </div>

            {/* Insight cards */}
            {data.insights.map(insight => (
                <InsightCard key={insight.id} insight={insight} />
            ))}
        </div>
    )
}
