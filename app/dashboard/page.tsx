'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { LogMealDialog } from '@/components/nutrition/log-meal-dialog'
import { cn } from '@/lib/utils'

function StatCard({
    label,
    value,
    unit,
    sub,
    color = 'primary',
    delay = 0,
}: {
    label: string
    value: string | number
    unit: string
    sub: string
    color?: 'primary' | 'success' | 'warning'
    delay?: number
}) {
    const accent: Record<string, string> = {
        primary: 'from-primary/10 to-primary/5 border-primary/20',
        success: 'from-success/10 to-success/5 border-success/20',
        warning: 'from-warning/10 to-warning/5 border-warning/20',
    }
    const dot: Record<string, string> = {
        primary: 'bg-primary',
        success: 'bg-success',
        warning: 'bg-warning',
    }
    return (
        <div
            className={cn(
                'rounded-2xl p-4 flex flex-col gap-3 border bg-gradient-to-br',
                'hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-default',
                'animate-in fade-in slide-in-from-bottom-3 duration-300',
                accent[color]
            )}
            style={{ animationDelay: `${delay}ms`, animationFillMode: 'both', boxShadow: '0 1px 4px rgba(9,30,66,0.07)' }}
        >
            <div className="flex items-center gap-2">
                <div className={cn('w-1.5 h-1.5 rounded-full', dot[color])} />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
            <div>
                <span className="text-3xl font-extrabold font-display text-foreground">{value}</span>
                <span className="text-sm text-muted-foreground ml-1.5">{unit}</span>
            </div>
            <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
    )
}

function SectionHeader({ title }: { title: string }) {
    return (
        <div className="flex items-center gap-3 mb-3">
            <h2 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                {title}
            </h2>
            <div className="flex-1 h-px bg-border" />
        </div>
    )
}

function QuickAction({
    label,
    description,
    icon,
    onClick,
    delay = 0,
}: {
    label: string
    description: string
    icon: React.ReactNode
    onClick?: () => void
    delay?: number
}) {
    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 text-left',
                'hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150',
                'active:scale-[0.98] group animate-in fade-in slide-in-from-bottom-2 duration-300'
            )}
            style={{ animationDelay: `${delay}ms`, animationFillMode: 'both', boxShadow: '0 1px 3px rgba(9,30,66,0.05)' }}
        >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:bg-primary/15 transition-colors duration-150">
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            <svg
                className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
            >
                <polyline points="9 18 15 12 9 6" />
            </svg>
        </button>
    )
}

export default function DashboardPage() {
    const { user } = useAuth()
    const [logMealOpen, setLogMealOpen] = useState(false)
    const [ipptDate, setIpptDate] = useState<string | null>(null)
    const displayName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Soldier'
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

    useEffect(() => {
        if (!user) return
        supabase.from('users').select('ippt_date').eq('id', user.id).single()
            .then(({ data }) => { if (data?.ippt_date) setIpptDate(data.ippt_date) })
    }, [user])

    const ipptDaysLeft = ipptDate
        ? Math.ceil((new Date(ipptDate).getTime() - Date.now()) / 86_400_000)
        : null

    return (
        <div className="min-h-screen px-4 sm:px-8 pt-8 pb-12">
            <div className="w-full max-w-2xl mx-auto space-y-8">

                {/* ── Header ── */}
                <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
                    <p className="text-sm text-muted-foreground">{greeting},</p>
                    <h1 className="font-display text-3xl font-extrabold text-foreground">{displayName}</h1>
                    <p className="text-xs text-muted-foreground mt-1">
                        {new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>

                {/* ── Today's summary ── */}
                <div>
                    <SectionHeader title="Today's summary" />
                    <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Calories" value="1,240" unit="/ 2,400 kcal" sub="52% of daily goal" color="primary" delay={80} />
                        <StatCard label="Protein"  value="68"    unit="/ 160 g"      sub="43% of daily goal" color="success" delay={130} />
                        <StatCard label="Workouts" value="1"     unit="session"      sub="Morning run · 5.2 km" color="warning" delay={180} />
                        <StatCard label="Steps"    value="6,430" unit="steps"        sub="64% of 10,000 goal" color="primary" delay={230} />
                    </div>
                </div>

                {/* ── IPPT countdown ── */}
                {ipptDaysLeft !== null && ipptDaysLeft >= 0 && (
                    <div
                        className="rounded-2xl p-5 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-3 duration-300"
                        style={{
                            animationDelay: '260ms',
                            animationFillMode: 'both',
                            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                            boxShadow: '0 4px 20px color-mix(in srgb, var(--color-primary) 30%, transparent)',
                        }}
                    >
                        <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="text-xs font-bold uppercase tracking-widest text-white/70 mb-0.5">IPPT Countdown</div>
                            <div className="font-display text-2xl font-extrabold text-white">
                                {ipptDaysLeft === 0 ? 'Today!' : `${ipptDaysLeft} day${ipptDaysLeft === 1 ? '' : 's'}`}
                            </div>
                            <div className="text-xs text-white/60 mt-0.5">
                                {ipptDaysLeft === 0
                                    ? "Good luck — you've got this"
                                    : ipptDaysLeft <= 7
                                        ? 'Final week — dial in your nutrition'
                                        : ipptDaysLeft <= 30
                                            ? 'Last stretch — stay consistent'
                                            : 'Keep your training consistent'}
                            </div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="font-display font-extrabold text-white/15" style={{ fontSize: ipptDaysLeft > 99 ? 28 : 36 }}>
                                {ipptDaysLeft === 0 ? '!' : ipptDaysLeft}
                            </div>
                        </div>
                    </div>
                )}
                {ipptDaysLeft === null && (
                    <div
                        className="rounded-2xl p-4 flex items-center gap-3 border border-dashed border-border animate-in fade-in slide-in-from-bottom-3 duration-300 cursor-pointer hover:border-primary/40 transition-colors"
                        style={{ animationDelay: '260ms', animationFillMode: 'both' }}
                        onClick={() => window.location.href = '/dashboard/settings#goal'}
                    >
                        <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                            <svg className="w-5 h-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-foreground">Set your IPPT date</div>
                            <div className="text-xs text-muted-foreground">Add it in Settings → Goal mode to see your countdown</div>
                        </div>
                        <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="9 18 15 12 9 6" /></svg>
                    </div>
                )}

                {/* ── Quick actions ── */}
                <div>
                    <SectionHeader title="Quick actions" />
                    <div className="space-y-2">
                        <QuickAction
                            label="Log a meal"
                            description="Track your calories and macros"
                            onClick={() => setLogMealOpen(true)}
                            delay={300}
                            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" /></svg>}
                        />
                        <QuickAction
                            label="Start a workout"
                            description="Log your training session"
                            delay={340}
                            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 6.5v11M18 6.5v11" /></svg>}
                        />
                        <QuickAction
                            label="Run IPPT simulator"
                            description="Estimate your score before the test"
                            delay={380}
                            icon={<svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>}
                        />
                    </div>
                </div>
            </div>

            <LogMealDialog open={logMealOpen} onOpenChange={setLogMealOpen} />
        </div>
    )
}
