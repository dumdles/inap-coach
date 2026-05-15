'use client'

import React, { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/context/auth-context'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type DayEntry = { calories: number; protein: number; carbs: number; fat: number; calorie_target: number }

type WorkoutLogRow = {
    id: string
    name: string
    source: string
    duration_min: number | null
    calories: number | null
    distance_km: number | null
    heart_rate_avg: number | null
    logged_at: string
    exercise_templates: { category: string } | null
}

type CadetData = {
    profile: {
        id: string; full_name: string; rank: string; wing: string
        platoon?: string; section?: string; height_cm?: number; weight_kg?: number
        gender?: string; goal_mode?: string; ippt_date?: string
    }
    score: number
    streak: number
    dailySummary: Record<string, DayEntry>
    accessLevel: 'instructor' | 'friend'
}


function StatPill({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
            <div className="font-display text-2xl font-extrabold text-foreground">{value}</div>
            {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
        </div>
    )
}

function MacroBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = Math.min(100, max ? (value / max) * 100 : 0)
    return (
        <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground w-12 flex-shrink-0">{label}</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-[11px] font-medium text-foreground w-10 text-right">{Math.round(value)}g</span>
        </div>
    )
}

function initials(name: string) {
    return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
}

const GOAL_COLOR: Record<string, string> = {
    bulk: '#0052CC', cut: '#DE350B', maintain: '#00875A', ippt: '#FF991F',
}

export default function CadetDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: cadetId } = use(params)
    const { user } = useAuth()
    const router = useRouter()
    const [data, setData] = useState<CadetData | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'nutrition' | 'workouts' | 'profile'>('nutrition')
    const [workoutLogs, setWorkoutLogs] = useState<WorkoutLogRow[]>([])
    const [workoutsLoading, setWorkoutsLoading] = useState(false)

    useEffect(() => {
        if (!user) return
        async function load() {
            try {
                const res = await fetch(`/api/cadet?cadetId=${cadetId}&requesterId=${user!.id}`)
                if (res.status === 403) { router.replace('/dashboard'); return }
                const json = await res.json()
                if (json?.error) { setError(json.error) } else { setData(json) }
            } catch {
                setError('Failed to load cadet data')
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [user, cadetId, router])

    // Fetch workout logs lazily when tab is first opened
    useEffect(() => {
        if (activeTab !== 'workouts' || workoutLogs.length > 0) return
        setWorkoutsLoading(true)
        fetch(`/api/workout-logs?userId=${cadetId}`)
            .then(r => r.json())
            .then(d => setWorkoutLogs(Array.isArray(d) ? d : []))
            .finally(() => setWorkoutsLoading(false))
    }, [activeTab, cadetId, workoutLogs.length])

    if (loading) return (
        <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto space-y-6">
            <Skeleton className="h-6 w-32" />
            <div className="flex items-center gap-4">
                <Skeleton className="w-16 h-16 rounded-full" />
                <div className="space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3.5 w-24" />
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
                {[0,1,2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            </div>
            {[0,1,2,3,4].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
    )

    if (error) return (
        <div className="px-4 md:px-8 py-8 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <p className="text-sm text-muted-foreground">{error === 'forbidden' ? 'This cadet is not in your wing.' : 'Could not load cadet data.'}</p>
                <Link href="/dashboard/wing" className="text-sm text-primary mt-2 inline-block">← Back to wing</Link>
            </div>
        </div>
    )

    if (!data) return null

    const { profile, score, streak, dailySummary, accessLevel } = data
    const isFriendView = accessLevel === 'friend'

    // Last 14 days for chart
    const last14 = Array.from({ length: 14 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (13 - i))
        const key = d.toISOString().slice(0, 10)
        return { key, label: d.toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }), ...dailySummary[key] }
    })
    const maxCal = Math.max(...last14.map(d => d?.calories ?? 0), 1)

    const todayKey = new Date().toISOString().slice(0, 10)
    const recentByDay = Object.keys(dailySummary).sort((a, b) => b.localeCompare(a)).slice(0, 7)

    const ipptDays = profile.ippt_date
        ? Math.ceil((new Date(profile.ippt_date).getTime() - Date.now()) / 86_400_000)
        : null

    return (
        <div className="px-4 md:px-8 py-8 md:py-10">
            <div className="max-w-3xl mx-auto">
                {/* Back */}
                <Link
                    href={isFriendView ? '/dashboard/friends' : '/dashboard/wing'}
                    className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors mb-5"
                >
                    <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    {isFriendView ? 'Back to leaderboard' : 'Back to wing'}
                </Link>

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center font-display text-[22px] font-bold flex-shrink-0">
                        {initials(profile.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h1 className="font-display font-extrabold text-[26px] tracking-tight text-foreground leading-none">
                            {[profile.rank, profile.full_name].filter(Boolean).join(' ')}
                        </h1>
                        <div className="text-sm text-muted-foreground mt-0.5">
                            {[profile.wing && `${profile.wing} Wing`, profile.platoon && `Plt ${profile.platoon}`, profile.section && `Sec ${profile.section}`].filter(Boolean).join(' · ')}
                        </div>
                    </div>
                    {!isFriendView && profile.goal_mode && (
                        <span
                            className="text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full text-white flex-shrink-0"
                            style={{ background: GOAL_COLOR[profile.goal_mode] ?? '#0052CC' }}
                        >
                            {profile.goal_mode}
                        </span>
                    )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                    <StatPill label="Week score" value={score.toLocaleString()} sub="pts" />
                    <StatPill label="Streak" value={`${streak}d`} sub="consecutive days" />
                    <StatPill
                        label="IPPT"
                        value={ipptDays === null ? '—' : ipptDays < 0 ? 'Passed' : ipptDays === 0 ? 'Today' : `${ipptDays}d`}
                        sub={profile.ippt_date ? new Date(profile.ippt_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' }) : 'Not set'}
                    />
                </div>

                {/* Tabs — profile tab hidden for friend view */}
                {!isFriendView && (
                    <div className="flex items-center bg-muted dark:bg-[#091E42] rounded-full p-0.5 gap-0.5 w-fit mb-6">
                        {(['nutrition', 'profile'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setActiveTab(t)}
                                className={cn(
                                    'px-4 py-1.5 rounded-full text-[13px] font-medium transition-all capitalize',
                                    activeTab === t
                                        ? 'bg-card dark:bg-[#1F3460] text-foreground shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground',
                                )}
                            >
                                {t === 'nutrition' ? 'Nutrition' : 'Profile'}
                            </button>
                        ))}
                    </div>
                )}

                {activeTab === 'nutrition' && (
                    <div className="space-y-6">
                        {/* 14-day calorie chart */}
                        <div className="bg-card border border-border rounded-2xl p-5">
                            <div className="text-[13px] font-semibold text-foreground mb-4">Calorie intake — last 14 days</div>
                            <div className="flex items-end gap-1 h-24">
                                {last14.map(d => {
                                    const h = d?.calories ? Math.max(4, (d.calories / maxCal) * 80) : 4
                                    const logged = !!d?.calories
                                    return (
                                        <div key={d.key} className="flex-1 flex flex-col items-center gap-1" title={d.label}>
                                            <div
                                                className="w-full rounded-t-sm transition-all duration-500"
                                                style={{ height: h, background: logged ? 'var(--primary)' : 'var(--muted)' }}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[9px] text-muted-foreground">{last14[0]?.label}</span>
                                <span className="text-[9px] text-muted-foreground">{last14[13]?.label}</span>
                            </div>
                        </div>

                        {/* Today's summary */}
                        {(() => {
                            const today = dailySummary[todayKey]
                            return (
                                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                                    <div className="px-5 py-3 border-b border-border">
                                        <span className="text-[13px] font-semibold text-foreground">Today</span>
                                    </div>
                                    {!today ? (
                                        <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nothing logged today.</div>
                                    ) : (
                                        <div className="px-5 py-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[13px] text-muted-foreground">Calories</span>
                                                <span className="text-[15px] font-bold text-foreground">
                                                    {Math.round(today.calories)}
                                                    <span className="text-[11px] text-muted-foreground font-normal"> / {Math.round(today.calorie_target)} kcal</span>
                                                </span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-primary transition-all"
                                                    style={{ width: `${Math.min(100, (today.calories / (today.calorie_target || 2400)) * 100).toFixed(1)}%` }}
                                                />
                                            </div>
                                            <div className="grid grid-cols-3 gap-2 pt-1">
                                                {[
                                                    { label: 'Protein', value: today.protein, color: '#2684FF' },
                                                    { label: 'Carbs',   value: today.carbs,   color: '#FFAB00' },
                                                    { label: 'Fat',     value: today.fat,     color: '#FF5630' },
                                                ].map(m => (
                                                    <div key={m.label} className="text-center">
                                                        <div className="text-[13px] font-bold text-foreground" style={{ color: m.color }}>{Math.round(m.value)}g</div>
                                                        <div className="text-[10px] text-muted-foreground">{m.label}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                        {/* Recent days breakdown */}
                        <div className="bg-card border border-border rounded-2xl overflow-hidden">
                            <div className="px-5 py-3 border-b border-border">
                                <span className="text-[13px] font-semibold text-foreground">Recent days</span>
                            </div>
                            {recentByDay.length === 0 ? (
                                <div className="px-5 py-8 text-center text-sm text-muted-foreground">No logs in the last 30 days.</div>
                            ) : (
                                recentByDay.map(day => {
                                    const d = dailySummary[day]
                                    return (
                                        <div key={day} className="px-5 py-4 border-b border-border last:border-0">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[12px] font-semibold text-foreground">
                                                    {new Date(day).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-[11px] text-muted-foreground">{Math.round(d.calories)} / {Math.round(d.calorie_target)} kcal</span>
                                                    <span className="text-[13px] font-bold text-foreground">{Math.round(d.calories)}</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <MacroBar label="Protein" value={d.protein} max={160} color="#2684FF" />
                                                <MacroBar label="Carbs" value={d.carbs} max={280} color="#FFAB00" />
                                                <MacroBar label="Fat" value={d.fat} max={80} color="#FF5630" />
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'workouts' && (
                    <div className="bg-card border border-border rounded-2xl overflow-hidden">
                        <div className="px-5 py-3 border-b border-border">
                            <span className="text-[13px] font-semibold text-foreground">Workout history</span>
                        </div>
                        {workoutsLoading ? (
                            <div className="px-5 py-6 space-y-3">
                                {[0,1,2].map(i => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}
                            </div>
                        ) : workoutLogs.length === 0 ? (
                            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No workouts logged yet.</div>
                        ) : (
                            workoutLogs.map(log => {
                                const catColorMap: Record<string, string> = {
                                    strength: 'bg-primary/10 text-primary',
                                    cardio:   'bg-success-light text-success-dark',
                                    hiit:     'bg-warning-light text-warning-dark',
                                    other:    'bg-muted text-muted-foreground',
                                }
                                const cat = log.exercise_templates?.category ?? 'other'
                                return (
                                    <div key={log.id} className="px-5 py-3.5 border-b border-border last:border-0">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-[13px] font-semibold text-foreground">{log.name}</span>
                                                    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', catColorMap[cat])}>
                                                        {cat}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1 flex-wrap text-[11px] text-muted-foreground">
                                                    <span>{new Date(log.logged_at).toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                                                    {log.duration_min != null && log.duration_min > 0 && <span>{log.duration_min} min</span>}
                                                    {log.distance_km != null && <span>{log.distance_km} km</span>}
                                                    {log.heart_rate_avg != null && <span>{log.heart_rate_avg} bpm avg</span>}
                                                </div>
                                            </div>
                                            {log.calories != null && log.calories > 0 && (
                                                <div className="text-right flex-shrink-0">
                                                    <span className="text-[14px] font-bold text-foreground tabular-nums">{log.calories}</span>
                                                    <span className="text-[11px] text-muted-foreground ml-1">kcal</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}

                {activeTab === 'profile' && (
                    <div className="space-y-4">
                        <div className="bg-card border border-border rounded-2xl divide-y divide-border">
                            {[
                                { label: 'Full name', value: profile.full_name },
                                { label: 'Rank', value: profile.rank || '—' },
                                { label: 'Wing', value: profile.wing || '—' },
                                { label: 'Platoon', value: profile.platoon || '—' },
                                { label: 'Section', value: profile.section || '—' },
                                { label: 'Gender', value: profile.gender || '—' },
                                { label: 'Height', value: profile.height_cm ? `${profile.height_cm} cm` : '—' },
                                { label: 'Weight', value: profile.weight_kg ? `${profile.weight_kg} kg` : '—' },
                                { label: 'Goal mode', value: profile.goal_mode ? profile.goal_mode.charAt(0).toUpperCase() + profile.goal_mode.slice(1) : '—' },
                                { label: 'IPPT date', value: profile.ippt_date ? new Date(profile.ippt_date).toLocaleDateString('en-SG', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                            ].map(row => (
                                <div key={row.label} className="flex items-center justify-between px-5 py-3.5">
                                    <span className="text-[13px] text-muted-foreground">{row.label}</span>
                                    <span className="text-[13px] font-medium text-foreground">{row.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
