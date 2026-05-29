'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { LogIPPTDialog, AwardBadge, secondsToRunTime, AWARD_META, type IPPTResult } from '@/components/ippt/log-ippt-dialog'
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts'

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="rounded-2xl bg-card border border-border p-5">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
            <div className="font-display font-extrabold text-3xl text-foreground">{value}</div>
            {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
        </div>
    )
}

function ResultRow({ result, onDelete }: { result: IPPTResult; onDelete: (id: string) => void }) {
    const [expanded, setExpanded] = useState(false)
    const [confirming, setConfirming] = useState(false)

    return (
        <div className="border-b border-border last:border-0">
            <button
                onClick={() => setExpanded(e => !e)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/40 transition-colors text-left"
            >
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-foreground">{formatDate(result.test_date)}</span>
                        <AwardBadge award={result.award} />
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[
                            result.pushup_reps != null && `${result.pushup_reps} push-ups`,
                            result.situp_reps  != null && `${result.situp_reps} sit-ups`,
                            result.run_time_seconds != null && secondsToRunTime(result.run_time_seconds),
                        ].filter(Boolean).join(' · ')}
                    </div>
                </div>
                <div className="font-display font-extrabold text-[22px] text-primary tabular-nums flex-shrink-0">
                    {result.total_points}
                </div>
                <svg
                    viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor"
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    className={cn('text-muted-foreground transition-transform flex-shrink-0', expanded && 'rotate-90')}
                >
                    <path d="M9 18l6-6-6-6" />
                </svg>
            </button>

            {expanded && (
                <div className="px-5 pb-4 space-y-3">
                    {/* Station breakdown */}
                    {(result.pushup_points != null || result.situp_points != null || result.run_points != null) && (
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Push-up', pts: result.pushup_points, reps: result.pushup_reps, unit: 'reps' },
                                { label: 'Sit-up',  pts: result.situp_points,  reps: result.situp_reps,  unit: 'reps' },
                                { label: '2.4 km',  pts: result.run_points,    reps: result.run_time_seconds != null ? secondsToRunTime(result.run_time_seconds) : null, unit: '' },
                            ].map(s => (
                                <div key={s.label} className="rounded-xl bg-muted/50 px-3 py-3 text-center">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{s.label}</div>
                                    {s.pts != null && (
                                        <div className="font-display font-bold text-lg text-foreground">{s.pts} pts</div>
                                    )}
                                    {s.reps != null && (
                                        <div className="text-[11px] text-muted-foreground">{s.reps}{s.unit && ` ${s.unit}`}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {result.notes && (
                        <p className="text-[12px] text-muted-foreground italic border-l-2 border-border pl-3">{result.notes}</p>
                    )}

                    {/* Delete */}
                    <div className="flex justify-end">
                        {confirming ? (
                            <div className="flex items-center gap-3">
                                <span className="text-[12px] text-muted-foreground">Delete this result?</span>
                                <button onClick={() => onDelete(result.id)} className="text-[12px] font-semibold text-danger hover:underline">Yes, delete</button>
                                <button onClick={() => setConfirming(false)} className="text-[12px] text-muted-foreground hover:text-foreground">Cancel</button>
                            </div>
                        ) : (
                            <button onClick={() => setConfirming(true)} className="text-[11px] text-muted-foreground hover:text-danger transition-colors">
                                Delete
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

export default function IPPTPage() {
    const { user } = useAuth()
    const [results, setResults]   = useState<IPPTResult[]>([])
    const [loading, setLoading]   = useState(true)
    const [logOpen, setLogOpen]   = useState(false)

    const fetchResults = useCallback(async () => {
        if (!user) return
        setLoading(true)
        const res = await fetch(`/api/ippt-results?userId=${user.id}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
        setLoading(false)
    }, [user])

    useEffect(() => { fetchResults() }, [fetchResults])

    const handleDelete = async (id: string) => {
        await fetch(`/api/ippt-results/${id}?userId=${user!.id}`, { method: 'DELETE' })
        setResults(prev => prev.filter(r => r.id !== id))
    }

    const handleSaved = (result: IPPTResult) => {
        setResults(prev => [result, ...prev].sort((a, b) => b.test_date.localeCompare(a.test_date)))
    }

    // Derived stats
    const latest     = results[0] ?? null
    const best       = results.reduce((b, r) => r.total_points > (b?.total_points ?? 0) ? r : b, null as IPPTResult | null)
    const improvement = results.length >= 2
        ? results[0].total_points - results[results.length - 1].total_points
        : null

    // Chart data (chronological)
    const chartData = [...results].reverse().map(r => ({
        date:   new Date(r.test_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }),
        points: r.total_points,
        award:  r.award,
    }))

    return (
        <div className="px-4 sm:px-6 lg:px-10 pt-8 pb-24 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-8">
                <div>
                    <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground leading-none">IPPT</h1>
                    <p className="text-sm text-muted-foreground mt-1.5">Physical fitness test history &amp; progress</p>
                </div>
                <Button onClick={() => setLogOpen(true)} className="flex-shrink-0 mt-1">
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                        <path d="M12 5v14M5 12h14" />
                    </svg>
                    Log result
                </Button>
            </div>

            {loading ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {[0, 1, 2].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                    </div>
                    <Skeleton className="h-56 rounded-2xl" />
                    <Skeleton className="h-64 rounded-2xl" />
                </div>
            ) : results.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-12 flex flex-col items-center text-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                        <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                            <path d="M6 4v16M18 4v16M2 8h4M18 8h4M2 16h4M18 16h4M6 12h12" />
                        </svg>
                    </div>
                    <div>
                        <p className="font-semibold text-foreground">No results yet</p>
                        <p className="text-[13px] text-muted-foreground mt-1">Log your first IPPT result to start tracking progress.</p>
                    </div>
                    <Button onClick={() => setLogOpen(true)}>Log first result</Button>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Stat cards */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <StatCard
                            label="Latest score"
                            value={latest!.total_points}
                            sub={latest!.award ? AWARD_META[latest!.award as keyof typeof AWARD_META]?.label : formatDate(latest!.test_date)}
                        />
                        <StatCard
                            label="Best score"
                            value={best!.total_points}
                            sub={formatDate(best!.test_date)}
                        />
                        <StatCard
                            label={improvement !== null && improvement >= 0 ? 'Improvement' : 'Change'}
                            value={improvement !== null ? `${improvement >= 0 ? '+' : ''}${improvement}` : '—'}
                            sub={results.length >= 2 ? `over ${results.length} tests` : 'Need more tests'}
                        />
                    </div>

                    {/* Progress chart */}
                    {chartData.length >= 2 && (
                        <div className="rounded-2xl bg-card border border-border p-5">
                            <h3 className="text-[13px] font-semibold text-foreground mb-1">Score progression</h3>
                            <p className="text-[11px] text-muted-foreground mb-4">Total points over all recorded tests</p>
                            <ResponsiveContainer width="100%" height={180}>
                                <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: -12 }}>
                                    <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                                        axisLine={false} tickLine={false}
                                    />
                                    <YAxis
                                        domain={['auto', 'auto']}
                                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                                        axisLine={false} tickLine={false}
                                    />
                                    {/* Award tier reference lines */}
                                    <ReferenceLine y={85} stroke="var(--color-warning)" strokeDasharray="4 3" strokeWidth={1} label={{ value: 'Gold', position: 'right', fontSize: 9, fill: 'var(--color-warning)' }} />
                                    <ReferenceLine y={75} stroke="var(--color-muted-foreground)" strokeDasharray="4 3" strokeWidth={1} label={{ value: 'Silver', position: 'right', fontSize: 9, fill: 'var(--color-muted-foreground)' }} />
                                    <ReferenceLine y={51} stroke="var(--color-success)" strokeDasharray="4 3" strokeWidth={1} label={{ value: 'Pass', position: 'right', fontSize: 9, fill: 'var(--color-success)' }} />
                                    <Tooltip
                                        content={({ payload }) => {
                                            if (!payload?.[0]) return null
                                            const d = payload[0].payload as typeof chartData[0]
                                            return (
                                                <div className="bg-popover border border-border rounded-xl px-3 py-2 text-[12px] shadow-md">
                                                    <div className="font-semibold text-foreground">{d.date}</div>
                                                    <div className="text-muted-foreground">{d.points} pts</div>
                                                    {d.award && <div className="font-medium mt-0.5" style={{ color: d.award === 'gold' ? '#ca8a04' : d.award === 'silver' ? '#94a3b8' : d.award === 'pass' ? 'var(--color-success)' : 'var(--color-danger)' }}>{AWARD_META[d.award as keyof typeof AWARD_META]?.label}</div>}
                                                </div>
                                            )
                                        }}
                                    />
                                    <Line
                                        dataKey="points" type="monotone"
                                        stroke="var(--color-primary)" strokeWidth={2.5}
                                        dot={{ r: 4, fill: 'var(--color-primary)', strokeWidth: 0 }}
                                        activeDot={{ r: 6 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}

                    {/* Results list */}
                    <div className="rounded-2xl bg-card border border-border overflow-hidden">
                        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                            <h3 className="text-[13px] font-semibold text-foreground">All results</h3>
                            <span className="text-[11px] text-muted-foreground">{results.length} test{results.length !== 1 ? 's' : ''}</span>
                        </div>
                        {results.map(r => (
                            <ResultRow key={r.id} result={r} onDelete={handleDelete} />
                        ))}
                    </div>
                </div>
            )}

            <LogIPPTDialog
                open={logOpen}
                onClose={() => setLogOpen(false)}
                userId={user?.id ?? ''}
                onSaved={handleSaved}
            />
        </div>
    )
}
