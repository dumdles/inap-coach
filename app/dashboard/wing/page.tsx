'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isInstructor } from '@/lib/scoring'
import { Skeleton } from '@/components/ui/skeleton'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { ArrowLeftRight, ChevronRight, Flame, MoreHorizontal, Utensils } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
    ScatterChart, Scatter, ZAxis, ReferenceLine,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────────────────────

type GoalMode = 'bulk' | 'cut' | 'maintain' | 'ippt'

type CadetRow = {
    id: string
    full_name: string
    rank: string
    wing: string
    platoon: string | null
    section: string | null
    goal_mode: GoalMode | null
    score: number
    streak: number
    mealsToday: number
    position: number
}

type AdminAction = 'remove_section' | 'assign_section' | 'transfer_wing'

type AdminConfirm = { cadetId: string; cadetName: string } | null

// ── Goal mode meta ────────────────────────────────────────────────────────────

const GOAL_META: Record<GoalMode, { label: string; bg: string; text: string; fill: string }> = {
    bulk:     { label: 'Bulk',     bg: 'bg-primary/10',  text: 'text-primary',      fill: '#2684FF' },
    cut:      { label: 'Cut',      bg: 'bg-danger/10',   text: 'text-danger',       fill: '#FF5630' },
    maintain: { label: 'Maintain', bg: 'bg-success/10',  text: 'text-success',      fill: '#36B37E' },
    ippt:     { label: 'IPPT',     bg: 'bg-warning/10',  text: 'text-warning-dark', fill: '#FFAB00' },
}

function goalFill(mode: GoalMode | null | string): string {
    if (mode && mode in GOAL_META) return GOAL_META[mode as GoalMode].fill
    return '#A5ADBA'
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── Streak bar ────────────────────────────────────────────────────────────────

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
                        i < streak ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                    )}
                >
                    {d}
                </div>
            ))}
        </div>
    )
}

// ── Meal dots ─────────────────────────────────────────────────────────────────

function MealDots({ count }: { count: number }) {
    return (
        <div className="flex items-center gap-1">
            {[0, 1, 2].map(i => (
                <div key={i} className={cn('w-2.5 h-2.5 rounded-full', i < count ? 'bg-primary' : 'bg-muted')} />
            ))}
        </div>
    )
}

function StatusBadge({ mealsToday }: { mealsToday: number }) {
    const notLogged = mealsToday === 0

    return (
        <Badge
            variant="outline"
            className={cn(
                'h-6 rounded-full border-transparent px-2.5 text-[11px] font-semibold',
                notLogged
                    ? 'bg-destructive/10 text-destructive'
                    : mealsToday >= 3
                        ? 'bg-success/10 text-success'
                        : 'bg-warning/10 text-warning-dark',
            )}
        >
            {notLogged ? 'Not logged' : mealsToday >= 3 ? 'On track' : 'Partial'}
        </Badge>
    )
}

type AssignmentDialogProps = {
    cadet: CadetRow | null
    currentWing: string
    availableWings: string[]
    transferSection: string
    transferWing: string
    adminWorking: boolean
    onTransferSectionChange: (value: string) => void
    onTransferWingChange: (value: string) => void
    onAction: (cadetId: string, action: AdminAction) => void
    onClose: () => void
}

function AssignmentDialog({
    cadet,
    currentWing,
    availableWings,
    transferSection,
    transferWing,
    adminWorking,
    onTransferSectionChange,
    onTransferWingChange,
    onAction,
    onClose,
}: AssignmentDialogProps) {
    return (
        <Dialog open={Boolean(cadet)} onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent className="gap-5 rounded-2xl sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Manage assignment</DialogTitle>
                    <DialogDescription>
                        {cadet ? `${cadet.rank} ${cadet.full_name} · ${cadet.platoon ?? 'No platoon'}${cadet.section ? ` · Section ${cadet.section}` : ''}` : 'Update cadet assignment.'}
                    </DialogDescription>
                </DialogHeader>

                {cadet && (
                    <div className="grid gap-4">
                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Section{cadet.section ? ` · currently Sec ${cadet.section}` : ''}
                            </p>
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <Select value={transferSection} onValueChange={onTransferSectionChange}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select section..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {['1', '2', '3', '4'].map(s => (
                                            <SelectItem key={s} value={s}>Section {s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={() => onAction(cadet.id, 'assign_section')}
                                    disabled={adminWorking || !transferSection}
                                    isLoading={adminWorking && Boolean(transferSection)}
                                    className="w-full sm:w-auto"
                                >
                                    Assign
                                </Button>
                            </div>
                            {cadet.section && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onAction(cadet.id, 'remove_section')}
                                    disabled={adminWorking}
                                    className="mt-3 text-muted-foreground"
                                >
                                    Remove from section
                                </Button>
                            )}
                        </div>

                        <div className="rounded-xl border border-border bg-muted/30 p-4">
                            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Transfer wing</p>
                            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                <Select value={transferWing} onValueChange={onTransferWingChange}>
                                    <SelectTrigger className="h-11">
                                        <SelectValue placeholder="Select wing..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableWings.filter(w => w !== currentWing).map(w => (
                                            <SelectItem key={w} value={w}>{w} Wing</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={() => onAction(cadet.id, 'transfer_wing')}
                                    disabled={adminWorking || !transferWing}
                                    isLoading={adminWorking && Boolean(transferWing)}
                                    className="w-full sm:w-auto"
                                >
                                    Transfer
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={adminWorking}>Cancel</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

// ── Score Bar Chart ───────────────────────────────────────────────────────────
// Horizontal bar chart of each cadet's weekly score, coloured by goal mode.

function ScoreChart({ cadets }: { cadets: CadetRow[] }) {
    const data = [...cadets]
        .sort((a, b) => b.score - a.score)
        .map(c => ({
            name: c.full_name.split(' ').pop() || c.full_name.split(' ')[0],
            score: c.score,
            goal: c.goal_mode,
        }))

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex items-start justify-between mb-1">
                <h3 className="text-[13px] font-semibold text-foreground">Score ranking</h3>
                <span className="text-[10px] text-muted-foreground">max 840 pts/wk</span>
            </div>
            <p className="text-[11px] text-muted-foreground mb-4">Bars coloured by goal mode</p>
            <div style={{ height: Math.max(200, data.length * 26) }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ left: 4, right: 32, top: 0, bottom: 0 }} barCategoryGap="30%">
                        <XAxis
                            type="number"
                            domain={[0, 840]}
                            tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            dataKey="name"
                            type="category"
                            width={68}
                            tick={{ fontSize: 11, fill: 'var(--color-foreground)' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--color-muted)', opacity: 0.5 }}
                            content={({ payload }) => {
                                if (!payload?.[0]) return null
                                const d = payload[0].payload as typeof data[0]
                                const meta = d.goal ? GOAL_META[d.goal as GoalMode] : null
                                return (
                                    <div className="bg-popover border border-border rounded-xl px-3 py-2 text-[12px] shadow-md">
                                        <div className="font-semibold text-foreground">{d.name}</div>
                                        <div className="text-muted-foreground">{d.score.toLocaleString()} pts</div>
                                        {meta && <div className={cn('text-[11px] font-medium mt-0.5', meta.text)}>{meta.label} mode</div>}
                                    </div>
                                )
                            }}
                        />
                        <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={18}>
                            {data.map((entry, i) => (
                                <Cell key={i} fill={goalFill(entry.goal)} fillOpacity={0.9} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}

// ── Goal mode donut (CSS conic-gradient) ──────────────────────────────────────

function GoalDonut({ cadets }: { cadets: CadetRow[] }) {
    const KEYS: GoalMode[] = ['bulk', 'cut', 'maintain', 'ippt']

    const counts = useMemo(() => {
        const c: Record<GoalMode, number> = { bulk: 0, cut: 0, maintain: 0, ippt: 0 }
        for (const cadet of cadets) {
            if (cadet.goal_mode && cadet.goal_mode in c) c[cadet.goal_mode]++
        }
        return c
    }, [cadets])

    const total = cadets.length || 1
    let cumPct = 0
    const stops = KEYS.flatMap(k => {
        const pct = (counts[k] / total) * 100
        if (pct === 0) return []
        const from = cumPct
        cumPct += pct
        return [`${GOAL_META[k].fill} ${from.toFixed(1)}%`, `${GOAL_META[k].fill} ${cumPct.toFixed(1)}%`]
    })
    if (stops.length === 0) stops.push('#A5ADBA 0%', '#A5ADBA 100%')

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-4">Goal mode breakdown</h3>
            <div className="flex items-center gap-5">
                <div
                    className="relative shrink-0 w-[76px] h-[76px] rounded-full"
                    style={{ background: `conic-gradient(${stops.join(', ')})` }}
                >
                    <div className="absolute inset-[13px] rounded-full bg-card flex items-center justify-center">
                        <span className="text-[13px] font-bold text-foreground">{cadets.length}</span>
                    </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-4 gap-y-2">
                    {KEYS.map(k => (
                        <div key={k} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: GOAL_META[k].fill }} />
                            <span className="text-[11px] text-muted-foreground">{GOAL_META[k].label}</span>
                            <span className="text-[11px] font-bold text-foreground ml-auto">{counts[k]}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ── Streak histogram ──────────────────────────────────────────────────────────
// Buckets cadets by streak length; higher streaks get warmer colours.

const STREAK_BUCKETS = [
    { label: '0d',   min: 0, max: 0,  fill: '#FF5630' },
    { label: '1–2d', min: 1, max: 2,  fill: '#FFAB00' },
    { label: '3–5d', min: 3, max: 5,  fill: '#2684FF' },
    { label: '6–7d', min: 6, max: 99, fill: '#36B37E' },
]

function StreakHistogram({ cadets }: { cadets: CadetRow[] }) {
    const data = STREAK_BUCKETS.map(b => ({
        label: b.label,
        count: cadets.filter(c => c.streak >= b.min && c.streak <= b.max).length,
        fill: b.fill,
    }))

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-1">Streak distribution</h3>
            <p className="text-[11px] text-muted-foreground mb-3">Cadets grouped by logging streak</p>
            <ResponsiveContainer width="100%" height={110}>
                <BarChart data={data} margin={{ left: -8, right: 8, top: 4, bottom: 0 }} barCategoryGap="30%">
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis hide allowDecimals={false} />
                    <Tooltip
                        cursor={{ fill: 'var(--color-muted)', opacity: 0.4 }}
                        content={({ payload }) => {
                            if (!payload?.[0]) return null
                            const d = payload[0].payload as typeof data[0]
                            return (
                                <div className="bg-popover border border-border rounded-lg px-2.5 py-1.5 text-[11px] shadow-sm">
                                    <span className="font-semibold text-foreground">{d.label}</span>
                                    <span className="text-muted-foreground ml-1">· {d.count} cadet{d.count !== 1 ? 's' : ''}</span>
                                </div>
                            )
                        }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {data.map((entry, i) => (
                            <Cell key={i} fill={entry.fill} fillOpacity={entry.count === 0 ? 0.2 : 0.9} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

// ── Consistency × Performance scatter chart ───────────────────────────────────
// Each dot is a cadet. X = streak, Y = score. Quadrant lines at x=3.5, y=420.
// Top-right = Stars. Bottom-left = Needs support.

type ScatterPoint = { x: number; y: number; name: string; goal: GoalMode | null; id: string }

function EngagementScatter({ cadets }: { cadets: CadetRow[] }) {
    const data: ScatterPoint[] = cadets.map(c => ({
        x: Math.min(c.streak, 7),
        y: c.score,
        name: c.full_name,
        goal: c.goal_mode,
        id: c.id,
    }))

    return (
        <div className="bg-card border border-border rounded-2xl p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                    <h3 className="text-[13px] font-semibold text-foreground">Consistency × Performance</h3>
                    <p className="text-[11px] text-muted-foreground">Streak vs weekly score — each dot is a cadet</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {(Object.entries(GOAL_META) as [GoalMode, typeof GOAL_META[GoalMode]][]).map(([key, meta]) => (
                        <div key={key} className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ background: meta.fill }} />
                            <span className="text-[10px] text-muted-foreground">{meta.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ top: 8, right: 16, bottom: 32, left: 8 }}>
                    <XAxis
                        dataKey="x"
                        type="number"
                        name="Streak"
                        domain={[0, 7]}
                        ticks={[0, 1, 2, 3, 4, 5, 6, 7]}
                        label={{ value: 'Streak (days)', position: 'insideBottom', offset: -16, fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <YAxis
                        dataKey="y"
                        type="number"
                        name="Score"
                        domain={[0, 840]}
                        ticks={[0, 210, 420, 630, 840]}
                        tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                    />
                    <ZAxis range={[52, 52]} />
                    {/* Quadrant dividers */}
                    <ReferenceLine x={3.5} stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth={1} />
                    <ReferenceLine y={420} stroke="var(--color-border)" strokeDasharray="4 4" strokeWidth={1} />
                    <Tooltip
                        cursor={false}
                        content={({ payload }) => {
                            if (!payload?.[0]) return null
                            const d = payload[0].payload as ScatterPoint
                            const meta = d.goal ? GOAL_META[d.goal] : null
                            return (
                                <div className="bg-popover border border-border rounded-xl px-3 py-2 text-[12px] shadow-md">
                                    <div className="font-semibold text-foreground">{d.name}</div>
                                    <div className="text-muted-foreground">{d.y.toLocaleString()} pts · {d.x}d streak</div>
                                    {meta && <div className={cn('text-[11px] font-medium mt-0.5', meta.text)}>{meta.label} mode</div>}
                                </div>
                            )
                        }}
                    />
                    <Scatter
                        data={data}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        shape={(props: any) => {
                            const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScatterPoint }
                            return (
                                <circle
                                    cx={cx}
                                    cy={cy}
                                    r={7}
                                    fill={goalFill(payload.goal)}
                                    fillOpacity={0.85}
                                    stroke="var(--color-background)"
                                    strokeWidth={1.5}
                                />
                            )
                        }}
                    />
                </ScatterChart>
            </ResponsiveContainer>

            {/* Quadrant guide */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 pt-3 mt-1 border-t border-border text-[11px] text-muted-foreground">
                <span><span className="text-success font-semibold">↗ Top-right:</span> High streak + high score — Stars</span>
                <span><span className="text-danger font-semibold">↙ Bottom-left:</span> Low on both — Needs support</span>
                <span><span className="text-warning-dark font-semibold">↖ Top-left:</span> High score, low streak — Inconsistent</span>
                <span><span className="text-primary font-semibold">↘ Bottom-right:</span> Consistent, building score</span>
            </div>
        </div>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WingPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [profile, setProfile] = useState<{ rank: string; wing: string } | null>(null)
    const [cadets, setCadets] = useState<CadetRow[]>([])
    const [period, setPeriod] = useState<'week' | 'month'>('week')
    const [loading, setLoading] = useState(true)
    const [sortBy, setSortBy] = useState<'score' | 'streak' | 'name'>('score')
    const [availableWings, setAvailableWings] = useState<string[]>([])
    const [filterSection, setFilterSection] = useState<string | null>(null)
    const [filterPlatoon, setFilterPlatoon] = useState<string | null>(null)
    const [adminConfirm, setAdminConfirm] = useState<AdminConfirm>(null)
    const [transferWing, setTransferWing] = useState('')
    const [transferSection, setTransferSection] = useState('')
    const [adminWorking, setAdminWorking] = useState(false)
    const cadetListRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!user) return
        supabase.from('users').select('rank, wing').eq('id', user.id).single()
            .then(({ data }) => {
                if (!data) return
                setProfile(data)
                if (!isInstructor(data.rank)) router.replace('/dashboard')
            })
        // Fetch all wings from the reference table (not distinct user values, so the list is always complete)
        supabase.from('ocs_wings').select('name').order('name').then(({ data }) => {
            if (data) setAvailableWings(data.map(w => w.name))
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

    useEffect(() => {
        queueMicrotask(() => {
            void fetchCadets()
        })
    }, [fetchCadets])

    // Derive unique sections and platoons for filter chips
    const allSections = useMemo(() =>
        [...new Set(cadets.map(c => c.section).filter(Boolean) as string[])].sort(),
    [cadets])
    const allPlatoons = useMemo(() =>
        [...new Set(cadets.map(c => c.platoon).filter(Boolean) as string[])].sort(),
    [cadets])

    const handleAdminAction = async (cadetId: string, action: AdminAction) => {
        if (!user) return
        setAdminWorking(true)
        try {
            const body: Record<string, string> = { requesterId: user.id, cadetId, action }
            if (action === 'transfer_wing') body.newWing = transferWing
            if (action === 'assign_section') body.newSection = transferSection
            const res = await fetch('/api/cadet-admin', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
            if (action === 'remove_section') {
                setCadets(prev => prev.map(c => c.id === cadetId ? { ...c, section: null } : c))
            } else if (action === 'assign_section') {
                setCadets(prev => prev.map(c => c.id === cadetId ? { ...c, section: transferSection } : c))
            } else {
                // transfer_wing — remove from this wing's view entirely
                setCadets(prev => prev.filter(c => c.id !== cadetId))
            }
        } finally {
            setAdminWorking(false)
            setAdminConfirm(null)
            setTransferWing('')
            setTransferSection('')
        }
    }

    const filtered = cadets.filter(c =>
        (!filterSection || c.section === filterSection) &&
        (!filterPlatoon || c.platoon === filterPlatoon),
    )

    const sorted = [...filtered].sort((a, b) => {
        if (sortBy === 'score')  return b.score - a.score
        if (sortBy === 'streak') return b.streak - a.streak
        return a.full_name.localeCompare(b.full_name)
    })
    const selectedCadet = adminConfirm ? cadets.find(c => c.id === adminConfirm.cadetId) ?? null : null

    useEffect(() => {
        if (loading || !cadetListRef.current) return
        const rows = cadetListRef.current.querySelectorAll('[data-cadet-row]')
        gsap.fromTo(
            rows,
            { autoAlpha: 0, y: 14 },
            { autoAlpha: 1, y: 0, duration: 0.38, ease: 'power2.out', stagger: 0.035, overwrite: true },
        )
    }, [loading, sortBy, filterSection, filterPlatoon, sorted.length])

    // Derived stats (from filtered set so filters affect overview cards too)
    const loggingToday   = filtered.filter(c => c.mealsToday > 0).length
    const notLoggedToday = filtered.filter(c => c.mealsToday === 0)
    const avgScore       = filtered.length ? Math.round(filtered.reduce((s, c) => s + c.score, 0) / filtered.length) : 0
    const topStreak      = filtered.reduce((max, c) => Math.max(max, c.streak), 0)
    const complianceRate = filtered.length ? Math.round((loggingToday / filtered.length) * 100) : 0
    const topStreaker    = filtered.reduce((best, c) => c.streak > (best?.streak ?? 0) ? c : best, filtered[0])

    if (!profile || !isInstructor(profile.rank)) return null

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-5xl mx-auto">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="font-display font-extrabold text-[32px] tracking-tight text-foreground leading-none mb-1">
                        {profile.wing} Wing
                    </h1>
                    <p className="text-sm text-muted-foreground">Nutrition &amp; performance overview</p>
                </div>
                <div className="flex items-center bg-muted dark:bg-background rounded-full p-0.5 gap-0.5 mt-1">
                    {(['week', 'month'] as const).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={cn(
                                'px-4 py-1.5 rounded-full text-[13px] font-medium transition-all',
                                period === p
                                    ? 'bg-card text-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {p === 'week' ? 'This week' : 'This month'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Section / Platoon filters ───────────────────────────────────── */}
            {(allSections.length > 0 || allPlatoons.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 mb-6 bg-white border dark:bg-background/50 rounded-xl px-3 py-2">
                    {allPlatoons.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Platoon</span>
                            {allPlatoons.map(p => (
                                <button
                                    key={p}
                                    onClick={() => setFilterPlatoon(filterPlatoon === p ? null : p)}
                                    className={cn(
                                        'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                                        filterPlatoon === p
                                            ? 'bg-foreground text-background border-foreground'
                                            : 'border-border text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    )}
                    {allSections.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {allPlatoons.length > 0 && <div className="w-px h-4 bg-border mx-1" />}
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Section</span>
                            {allSections.map(s => (
                                <button
                                    key={s}
                                    onClick={() => setFilterSection(filterSection === s ? null : s)}
                                    className={cn(
                                        'px-3 py-1 rounded-full text-xs font-medium border transition-all',
                                        filterSection === s
                                            ? 'bg-foreground text-background border-foreground'
                                            : 'border-border text-muted-foreground hover:text-foreground',
                                    )}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                    {(filterSection || filterPlatoon) && (
                        <button
                            onClick={() => { setFilterSection(null); setFilterPlatoon(null) }}
                            className="text-[11px] text-muted-foreground hover:text-foreground ml-1 underline underline-offset-2"
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}

            {/* ── Stat cards ─────────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="rounded-2xl bg-card border border-border p-5">
                    <div className="text-xs text-muted-foreground mb-2">Cadets</div>
                    <div className="font-display font-extrabold text-3xl text-foreground">{filtered.length}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                        {filterSection || filterPlatoon ? `${filtered.length} of ${cadets.length} shown` : `${profile.wing} Wing`}
                    </div>
                </div>

                <div className="rounded-2xl bg-card border border-border p-5">
                    <div className="text-xs text-muted-foreground mb-2">Avg score</div>
                    <div className="font-display font-extrabold text-3xl text-foreground">{avgScore.toLocaleString()}</div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (avgScore / 840) * 100)}%` }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">of 840 max/week</div>
                </div>

                <div className="rounded-2xl bg-card border border-border p-5">
                    <div className="text-xs text-muted-foreground mb-2">Logged today</div>
                    <div className="flex items-end gap-1.5">
                        <div className="font-display font-extrabold text-3xl text-foreground">{loggingToday}</div>
                        <div className="text-base text-muted-foreground mb-0.5">/ {cadets.length}</div>
                    </div>
                    <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                            className={cn('h-full rounded-full transition-all duration-700',
                                complianceRate >= 80 ? 'bg-emerald-500' : complianceRate >= 50 ? 'bg-amber-400' : 'bg-destructive')}
                            style={{ width: `${complianceRate}%` }}
                        />
                    </div>
                    <div className={cn('text-[10px] mt-1 font-medium',
                        complianceRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : complianceRate >= 50 ? 'text-amber-600' : 'text-destructive')}>
                        {complianceRate}% compliance
                    </div>
                </div>

                <div className="rounded-2xl bg-card border border-border p-5">
                    <div className="text-xs text-muted-foreground mb-2">Top streak</div>
                    <div className="flex items-end gap-1.5">
                        <div className="font-display font-extrabold text-3xl text-foreground">{topStreak}</div>
                        <div className="text-base text-muted-foreground mb-0.5 flex items-center gap-1">
                            days
                            <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" className="text-warning">
                                <path d="M12 2C10 5.5 8 7 8.5 10.5 7 9.5 7 7 7 7 5.5 9 6 12 6 12 6 15.5 8.2 18.5 11 18.5s5-3 5-6.5c0-2.5-1.5-4-1.5-4s0 2-1 2.5C14 8 12 2 12 2Z" />
                            </svg>
                        </div>
                    </div>
                    {topStreaker && (
                        <div className="text-xs text-muted-foreground mt-1 truncate">by {topStreaker.full_name.split(' ')[0]}</div>
                    )}
                </div>
            </div>

            {/* ── Visualisations ─────────────────────────────────────────────── */}
            {loading ? (
                <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mb-4">
                    <Skeleton className="h-80 rounded-2xl" />
                    <div className="space-y-4">
                        <Skeleton className="h-36 rounded-2xl" />
                        <Skeleton className="h-40 rounded-2xl" />
                    </div>
                </div>
            ) : filtered.length > 0 ? (
                <>
                    {/* Row 1: Score bar (left) + Goal donut + Streak histogram (right) */}
                    <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-4 mb-4">
                        <ScoreChart cadets={filtered} />
                        <div className="flex flex-col gap-4">
                            <GoalDonut cadets={filtered} />
                            <StreakHistogram cadets={filtered} />
                        </div>
                    </div>

                    {/* Row 2: Scatter chart full-width */}
                    <div className="mb-4">
                        <EngagementScatter cadets={filtered} />
                    </div>
                </>
            ) : null}

            {/* ── Attention panel ─────────────────────────────────────────────── */}
            {!loading && notLoggedToday.length > 0 && (
                <div className="bg-danger/5 border border-danger/20 rounded-2xl p-5 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-danger shrink-0" />
                        <h3 className="text-[13px] font-semibold text-foreground">
                            {notLoggedToday.length} cadet{notLoggedToday.length !== 1 ? 's' : ''} haven&apos;t logged today
                        </h3>
                        <span className="ml-auto text-[10px] text-muted-foreground">{complianceRate}% compliance</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {notLoggedToday.map(c => (
                            <Link
                                key={c.id}
                                href={`/dashboard/wing/cadet/${c.id}`}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-card border border-border rounded-full text-[12px] hover:border-danger/30 transition-colors"
                            >
                                <div className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0', avatarColor(c.full_name))}>
                                    {initials(c.full_name)}
                                </div>
                                <span className="font-medium text-foreground">{c.full_name.split(' ')[0]}</span>
                                {c.goal_mode && (
                                    <span className={cn('text-[9px] font-semibold px-1.5 py-0.5 rounded-full', GOAL_META[c.goal_mode].bg, GOAL_META[c.goal_mode].text)}>
                                        {GOAL_META[c.goal_mode].label}
                                    </span>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Sort controls ────────────────────────────────────────────────── */}
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

            {/* ── Cadet table ──────────────────────────────────────────────────── */}
            {loading ? (
                <div className="grid gap-3">
                    {[0, 1, 2, 3, 4, 5].map(i => (
                        <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
            ) : cadets.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">No cadets found in {profile.wing} Wing.</p>
                </div>
            ) : sorted.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                    <p className="text-sm text-muted-foreground">No cadets match the active filters.</p>
                </div>
            ) : (
                <div ref={cadetListRef}>
                    <div className="mb-3 flex items-end justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold text-foreground">Cadet roster</h2>
                            <p className="text-xs text-muted-foreground">{sorted.length} cadet{sorted.length !== 1 ? 's' : ''} shown by {sortBy}</p>
                        </div>
                    </div>

                    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card shadow-sm md:block">
                        <Table>
                            <TableHeader className="bg-muted/40">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="w-14 text-[11px] uppercase tracking-wider text-muted-foreground">#</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Cadet</TableHead>
                                    <TableHead className="text-right text-[11px] uppercase tracking-wider text-muted-foreground">Score</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Streak</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Meals</TableHead>
                                    <TableHead className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                                    <TableHead className="w-12" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sorted.map((c, idx) => (
                                    <TableRow key={c.id} data-cadet-row className={cn(c.mealsToday === 0 && 'bg-destructive/[0.03] hover:bg-destructive/[0.05]')}>
                                        <TableCell className="font-semibold text-muted-foreground">{idx + 1}</TableCell>
                                        <TableCell>
                                            <Link href={`/dashboard/wing/cadet/${c.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                                                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white', avatarColor(c.full_name))}>
                                                    {initials(c.full_name)}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="truncate font-semibold text-foreground">{c.full_name}</div>
                                                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                                        <span>{c.rank}</span>
                                                        {c.platoon && <span>{c.platoon}</span>}
                                                        {c.section && <span>Sec {c.section}</span>}
                                                        {c.goal_mode && (
                                                            <Badge variant="outline" className={cn('h-5 border-transparent text-[10px]', GOAL_META[c.goal_mode].bg, GOAL_META[c.goal_mode].text)}>
                                                                {GOAL_META[c.goal_mode].label}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </Link>
                                        </TableCell>
                                        <TableCell className="text-right font-display text-lg font-bold tabular-nums text-foreground">{c.score.toLocaleString()}</TableCell>
                                        <TableCell><StreakBar streak={Math.min(c.streak, 7)} /></TableCell>
                                        <TableCell><MealDots count={Math.min(c.mealsToday, 3)} /></TableCell>
                                        <TableCell><StatusBadge mealsToday={c.mealsToday} /></TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-9 w-9 text-muted-foreground hover:text-primary"
                                                onClick={() => {
                                                    setAdminConfirm({ cadetId: c.id, cadetName: c.full_name })
                                                    setTransferWing('')
                                                    setTransferSection(c.section ?? '')
                                                }}
                                                title="Manage cadet assignment"
                                            >
                                                <ArrowLeftRight size={16} />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="grid gap-3 md:hidden">
                        {sorted.map((c, idx) => (
                            <Card key={c.id} data-cadet-row size="sm" className={cn('rounded-2xl border border-border shadow-sm', c.mealsToday === 0 && 'ring-destructive/20')}>
                                <CardContent className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className={cn('mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[13px] font-bold text-white', avatarColor(c.full_name))}>
                                            {initials(c.full_name)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-muted-foreground">#{idx + 1}</span>
                                                <StatusBadge mealsToday={c.mealsToday} />
                                            </div>
                                            <Link href={`/dashboard/wing/cadet/${c.id}`} className="mt-1 block truncate text-base font-semibold text-foreground">
                                                {c.full_name}
                                            </Link>
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                                <span>{c.rank}</span>
                                                {c.platoon && <span>{c.platoon}</span>}
                                                {c.section && <span>Sec {c.section}</span>}
                                                {c.goal_mode && (
                                                    <Badge variant="outline" className={cn('h-5 border-transparent text-[10px]', GOAL_META[c.goal_mode].bg, GOAL_META[c.goal_mode].text)}>
                                                        {GOAL_META[c.goal_mode].label}
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-muted-foreground"
                                            onClick={() => {
                                                setAdminConfirm({ cadetId: c.id, cadetName: c.full_name })
                                                setTransferWing('')
                                                setTransferSection(c.section ?? '')
                                            }}
                                            title="Manage cadet assignment"
                                        >
                                            <MoreHorizontal size={18} />
                                        </Button>
                                    </div>

                                    <div className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-muted/20">
                                        <div className="p-3">
                                            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Score</div>
                                            <div className="mt-1 font-display text-xl font-bold tabular-nums text-foreground">{c.score.toLocaleString()}</div>
                                        </div>
                                        <div className="p-3">
                                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                <Flame size={12} /> Streak
                                            </div>
                                            <div className="mt-1 text-sm font-semibold text-foreground">{Math.min(c.streak, 7)} days</div>
                                        </div>
                                        <div className="p-3">
                                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                <Utensils size={12} /> Meals
                                            </div>
                                            <div className="mt-2"><MealDots count={Math.min(c.mealsToday, 3)} /></div>
                                        </div>
                                    </div>

                                    <Link href={`/dashboard/wing/cadet/${c.id}`} className="flex items-center justify-between text-sm font-semibold text-primary">
                                        View cadet details
                                        <ChevronRight size={16} />
                                    </Link>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            <AssignmentDialog
                cadet={selectedCadet}
                currentWing={profile.wing}
                availableWings={availableWings}
                transferSection={transferSection}
                transferWing={transferWing}
                adminWorking={adminWorking}
                onTransferSectionChange={setTransferSection}
                onTransferWingChange={setTransferWing}
                onAction={handleAdminAction}
                onClose={() => { setAdminConfirm(null); setTransferWing(''); setTransferSection('') }}
            />
        </div>
    )
}
