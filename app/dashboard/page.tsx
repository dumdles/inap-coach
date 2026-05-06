'use client'

import React from 'react'
import { useAuth } from '@/app/context/auth-context'

function StatCard({
    label,
    value,
    unit,
    sub,
    color = 'primary',
}: {
    label: string
    value: string | number
    unit: string
    sub: string
    color?: 'primary' | 'success' | 'warning'
}) {
    const dot: Record<string, string> = {
        primary: 'bg-primary',
        success:  'bg-success',
        warning:  'bg-warning',
    }
    const ring: Record<string, string> = {
        primary: 'ring-primary/20',
        success:  'ring-success/20',
        warning:  'ring-warning/20',
    }
    return (
        <div className={`bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 ring-1 ${ring[color]}`}>
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${dot[color]}`} />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
            </div>
            <div>
                <span className="text-3xl font-extrabold font-display text-foreground">{value}</span>
                <span className="text-sm text-muted-foreground ml-1">{unit}</span>
            </div>
            <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
    )
}

function SectionHeader({ title }: { title: string }) {
    return (
        <h2 className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3">
            {title}
        </h2>
    )
}

function QuickAction({ label, description, icon }: { label: string; description: string; icon: React.ReactNode }) {
    return (
        <button className="w-full bg-card border border-border rounded-2xl p-4 flex items-center gap-4 text-left hover:border-primary/50 transition-colors duration-150 active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {icon}
            </div>
            <div>
                <div className="text-sm font-semibold text-foreground">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            <svg className="w-4 h-4 text-muted-foreground ml-auto shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="9 18 15 12 9 6" />
            </svg>
        </button>
    )
}

export default function DashboardPage() {
    const { user } = useAuth()
    const displayName = user?.user_metadata?.full_name?.split(' ')[0] ?? 'Soldier'
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

    return (
        <div className="max-w-2xl px-8 pt-10 pb-10 space-y-8">
            {/* Header */}
            <div>
                <p className="text-sm text-muted-foreground">{greeting},</p>
                <h1 className="font-display text-3xl font-extrabold text-foreground">{displayName}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                    {new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
            </div>

            {/* Today's summary */}
            <div>
                <SectionHeader title="Today's summary" />
                <div className="grid grid-cols-2 gap-3">
                    <StatCard
                        label="Calories"
                        value="1,240"
                        unit="/ 2,400 kcal"
                        sub="52% of daily goal"
                        color="primary"
                    />
                    <StatCard
                        label="Protein"
                        value="68"
                        unit="/ 160 g"
                        sub="43% of daily goal"
                        color="success"
                    />
                    <StatCard
                        label="Workouts"
                        value="1"
                        unit="session"
                        sub="Morning run · 5.2 km"
                        color="warning"
                    />
                    <StatCard
                        label="Steps"
                        value="6,430"
                        unit="steps"
                        sub="64% of 10,000 goal"
                        color="primary"
                    />
                </div>
            </div>

            {/* IPPT countdown */}
            <div className="bg-primary/10 border border-primary/30 rounded-2xl p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                    </svg>
                </div>
                <div className="flex-1">
                    <div className="text-xs font-bold uppercase tracking-widest text-primary mb-0.5">IPPT Countdown</div>
                    <div className="font-display text-2xl font-extrabold text-foreground">47 days</div>
                    <div className="text-xs text-muted-foreground">Keep your training consistent</div>
                </div>
            </div>

            {/* Quick actions */}
            <div>
                <SectionHeader title="Quick actions" />
                <div className="space-y-2">
                    <QuickAction
                        label="Log a meal"
                        description="Track your calories and macros"
                        icon={
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3" />
                            </svg>
                        }
                    />
                    <QuickAction
                        label="Start a workout"
                        description="Log your training session"
                        icon={
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 6.5v11M18 6.5v11" />
                            </svg>
                        }
                    />
                    <QuickAction
                        label="Run IPPT simulator"
                        description="Estimate your score before the test"
                        icon={
                            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                            </svg>
                        }
                    />
                </div>
            </div>
        </div>
    )
}
