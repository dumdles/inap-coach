'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import gsap from 'gsap'

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
    high:   'border-danger/40 bg-danger/[0.04] dark:bg-danger/[0.07]',
    medium: 'border-yellow-400/40 bg-yellow-400/[0.04] dark:bg-yellow-400/[0.07]',
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

function InsightDetailDialog({ insight, onClose }: { insight: Insight; onClose: () => void }) {
    const cat = CATEGORY_META[insight.category]
    return (
        <Dialog open onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                                {cat.icon}
                            </svg>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-semibold text-muted-foreground">{cat.label}</span>
                            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', PRIORITY_BADGE[insight.priority])}>
                                {PRIORITY_LABEL[insight.priority]}
                            </span>
                        </div>
                    </div>
                    <DialogTitle className="text-[15px] leading-snug">{insight.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-1">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">What the data shows</p>
                        <p className="text-[13px] text-foreground leading-relaxed">{insight.observation}</p>
                    </div>
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <ArrowIcon />
                        <p className="text-[13px] text-foreground leading-relaxed">{insight.action}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function InsightCard({ insight, onClick }: { insight: Insight; onClick: () => void }) {
    const cat = CATEGORY_META[insight.category]
    return (
        <button
            onClick={onClick}
            data-insight-card
            className={cn(
                'group w-full rounded-2xl border text-left transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-[0.99]',
                PRIORITY_CARD[insight.priority],
            )}
            style={{ opacity: 0 }}
        >
            <div className="px-5 py-4">
                {/* Title — dominant focal element */}
                <p className="font-display font-bold text-[17px] leading-snug text-foreground mb-2.5">
                    {insight.title}
                </p>

                {/* Meta row: category + priority */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0">
                            {cat.icon}
                        </svg>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{cat.label}</span>
                    </div>
                    <span className="text-muted-foreground/40">·</span>
                    <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', PRIORITY_BADGE[insight.priority])}>
                        {PRIORITY_LABEL[insight.priority]}
                    </span>
                </div>

                {/* Action preview */}
                <p className="text-[12px] text-muted-foreground leading-relaxed line-clamp-2">{insight.action}</p>

                <p className="text-[11px] text-primary/70 mt-2.5 font-medium group-hover:text-primary transition-colors">Tap for full insight →</p>
            </div>
        </button>
    )
}

// ── Loading animation ──────────────────────────────────────────────────────────

const ANALYSIS_PHASES = [
    { label: 'Reading nutrition logs…',     icon: <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" /> },
    { label: 'Reviewing workout history…',  icon: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /> },
    { label: 'Checking body composition…',  icon: <><path d="M5 7h14l-1 13H6L5 7z"/><path d="M9 7a3 3 0 0 1 6 0"/></> },
    { label: 'Generating recommendations…', icon: <><path d="M12 2a8 8 0 0 1 8 8c0 3-1.5 5.5-4 7l-1 5H9l-1-5C5.5 15.5 4 13 4 10a8 8 0 0 1 8-8z" /><line x1="9" y1="17" x2="15" y2="17" /></> },
]

function InsightsLoadingState({ containerCls }: { containerCls: string }) {
    const [phase, setPhase] = useState(0)
    const [dots, setDots] = useState(0)

    useEffect(() => {
        const phaseTimer = setInterval(() => setPhase(p => (p + 1) % ANALYSIS_PHASES.length), 2200)
        const dotTimer   = setInterval(() => setDots(d => (d + 1) % 4), 420)
        return () => { clearInterval(phaseTimer); clearInterval(dotTimer) }
    }, [])

    return (
        <div className={cn(containerCls, 'space-y-6')}>
            {/* Header skeleton */}
            <div className="flex items-start justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-28" />
                    <Skeleton className="h-4 w-56" />
                </div>
                <Skeleton className="h-9 w-24 rounded-full" />
            </div>

            {/* Main animation card */}
            <div className="rounded-2xl border border-primary/20 overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark, var(--color-primary)) 100%)' }}>
                <div className="px-6 py-8 flex flex-col items-center text-center gap-5">
                    {/* Orbiting rings */}
                    <div className="relative w-16 h-16 flex items-center justify-center">
                        {/* Outer ring */}
                        <div className="absolute inset-0 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" style={{ animationDuration: '1.4s' }} />
                        {/* Inner ring */}
                        <div className="absolute inset-2 rounded-full border-2 border-white/10 border-b-white/60 animate-spin" style={{ animationDuration: '0.9s', animationDirection: 'reverse' }} />
                        {/* Centre icon — fades between phases */}
                        <div className="relative z-10 w-7 h-7 flex items-center justify-center">
                            <svg key={phase} viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                                className="animate-[fadeIn_0.4s_ease]">
                                {ANALYSIS_PHASES[phase].icon}
                            </svg>
                        </div>
                    </div>

                    <div>
                        <p className="font-display font-bold text-white text-[18px] leading-tight mb-1">
                            Generating AI Insights
                        </p>
                        {/* Phase label with animated dots */}
                        <p key={phase} className="text-[13px] text-white/70 animate-[fadeIn_0.35s_ease]">
                            {ANALYSIS_PHASES[phase].label.replace('…', '')}
                            <span className="inline-block w-6 text-left">{'.'.repeat(dots)}</span>
                        </p>
                    </div>

                    {/* Phase progress dots */}
                    <div className="flex items-center gap-2">
                        {ANALYSIS_PHASES.map((_, i) => (
                            <div
                                key={i}
                                className={cn(
                                    'rounded-full transition-all duration-500',
                                    i === phase ? 'w-5 h-2 bg-white' : i < phase ? 'w-2 h-2 bg-white/60' : 'w-2 h-2 bg-white/20',
                                )}
                            />
                        ))}
                    </div>

                    <p className="text-[12px] text-white/50 max-w-xs">
                        Analysing your last 14 days of nutrition, workouts &amp; progress. This may take up to 30 seconds.
                    </p>
                </div>

                {/* Shimmer bottom bar */}
                <div className="h-1 bg-white/10 overflow-hidden">
                    <div className="h-full bg-white/40 animate-[shimmer_2s_linear_infinite]" style={{ width: '40%' }} />
                </div>
            </div>

            {/* Ghost cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map(i => (
                    <div key={i} className="rounded-2xl border border-border bg-card p-5 space-y-3 overflow-hidden relative"
                        style={{ animationDelay: `${i * 0.1}s` }}>
                        <div className="absolute inset-0 -translate-x-full animate-[shimmer_2.2s_ease_infinite]"
                            style={{ animationDelay: `${i * 0.3}s`, background: 'linear-gradient(90deg, transparent, var(--color-muted), transparent)' }} />
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-3.5 w-1/3" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                    </div>
                ))}
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
    const [activeInsight, setActiveInsight] = useState<Insight | null>(null)

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

    const summaryRef = useRef<HTMLDivElement>(null)
    const cardsRef = useRef<HTMLDivElement>(null)

    // Animate in when data arrives
    useEffect(() => {
        if (!data) return
        const ctx = gsap.context(() => {
            if (summaryRef.current) {
                gsap.fromTo(summaryRef.current,
                    { opacity: 0, y: 24 },
                    { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' },
                )
            }
            if (cardsRef.current) {
                gsap.fromTo('[data-insight-card]',
                    { opacity: 0, y: 20 },
                    { opacity: 1, y: 0, duration: 0.45, stagger: 0.07, ease: 'power2.out', delay: 0.25 },
                )
            }
        })
        return () => ctx.revert()
    }, [data])

    const containerCls = 'px-4 sm:px-6 lg:px-10 pt-8 pb-24 max-w-5xl mx-auto'

    if (loading) return <InsightsLoadingState containerCls={containerCls} />

    if (error || !data) {
        return (
            <div className={cn(containerCls, 'space-y-6')}>
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
                        className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-5 py-2 text-sm font-medium transition-colors disabled:opacity-40',
                            cooldownRemaining > 0 || refreshing
                                ? 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                                : 'ai-glow-button text-primary'
                        )}
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
        <div className={containerCls}>
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground leading-none">Insights</h1>
                    <p className="text-sm text-muted-foreground mt-1.5">AI-powered coaching based on your last 14 days</p>
                </div>
                <button
                    onClick={() => fetchInsights(true)}
                    disabled={refreshing || cooldownRemaining > 0}
                    className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-40 flex-shrink-0 mt-1',
                        cooldownRemaining > 0 || refreshing
                            ? 'border-border text-muted-foreground hover:text-foreground hover:bg-accent'
                            : 'ai-glow-button text-primary hover:text-primary'
                    )}
                    title={cooldownRemaining > 0 ? `Available in ${Math.ceil(cooldownRemaining / 60_000)} min` : undefined}
                >
                    <RefreshIcon spinning={refreshing} />
                    {refreshing ? 'Refreshing…' : cooldownRemaining > 0 ? `${Math.ceil(cooldownRemaining / 60_000)}m` : 'Refresh'}
                </button>
            </div>

            {/* Summary card — wrapped in ambient glow */}
            <div ref={summaryRef} className="insights-card-glow-wrap mb-6" style={{ opacity: 0 }}>
                <div className="relative z-10 rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)' }}>
                    <div className="px-6 pt-5 pb-4">
                        <div className="flex items-center gap-2 mb-3">
                            {/* Sparkles icon for AI badge */}
                            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.937A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
                                <path d="M20 3v4M22 5h-4M4 17v2M5 18H3" />
                            </svg>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">AI Coach Summary</span>
                        </div>
                        <p className="text-[14px] text-white leading-relaxed">{data.summary}</p>
                    </div>
                    <div className="px-6 py-3 bg-black/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/50">Updated {relativeTime(data.generated_at)}</span>
                        <span className="text-[11px] text-white/50 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white/40 inline-block" style={{ animation: 'insights-card-glow 2s ease-in-out infinite' }} />
                            Gemini 2.0 Flash · {data.insights.length} insight{data.insights.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
            </div>

            {/* Insight cards — 2-col grid on md+ */}
            <div ref={cardsRef} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.insights.map(insight => (
                    <InsightCard key={insight.id} insight={insight} onClick={() => setActiveInsight(insight)} />
                ))}
            </div>

            {activeInsight && (
                <InsightDetailDialog insight={activeInsight} onClose={() => setActiveInsight(null)} />
            )}
        </div>
    )
}
