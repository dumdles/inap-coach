'use client'

// ── My Wing (instructors + superadmins) ───────────────────────────────────────
// Built for wings of 100–200 cadets: summarise first, group second, list last.
//   • Overview — 4 stat tiles, the wing map (a tile per section, a square per
//     cadet: components/wing/section-map.tsx) and a short "Needs attention" list.
//   • Roster — every cadet, one line each, with search, quick views, filters and
//     grouping by section (components/wing/roster.tsx).
//   • Trends — sections compared, score distribution, goal mix, streaks
//     (components/wing/trends.tsx).
// Maths lives in lib/wing-overview.ts. Data: GET /api/leaderboard?scope=wing.
// Superadmins can switch on a fake 150-cadet "demo wing" (lib/wing-demo.ts) to
// preview the page at real scale — nothing is read or written for it.

import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, FlaskConical, X } from 'lucide-react'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { hasInstructorAccess, isSuperadmin } from '@/lib/roles'
import { applyPreview } from '@/lib/role-preview'
import { useRolePreview } from '@/lib/use-role-preview'
import { authFetch } from '@/lib/auth-fetch'
import { useApi, useData } from '@/lib/use-data'
import { refreshData } from '@/lib/data-cache'
import {
    MAX_WEEKLY_SCORE, groupStats, groupWing, needsAttention, weakestSectionToday,
    type WingCadet,
} from '@/lib/wing-overview'
import { DEMO_WING, isDemoCadet, makeDemoWing } from '@/lib/wing-demo'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SectionMap } from '@/components/wing/section-map'
import { AttentionList } from '@/components/wing/attention-list'
import { Roster, type RosterView } from '@/components/wing/roster'
import { SectionDialog } from '@/components/wing/section-dialog'
import { Trends } from '@/components/wing/trends'
import { CadetSearch } from '@/components/wing/cadet-search'
import { AssignmentDialog, type AdminAction } from '@/components/wing/assignment-dialog'
import type { ColorBy } from '@/components/wing/shared'

type Tab = 'overview' | 'roster' | 'trends'
const DEMO_KEY = 'fitrep:wing-demo'

export default function WingPage() {
    const { user } = useAuth()
    const router = useRouter()
    const [period, setPeriod] = useState<'week' | 'month'>('week')
    const [tab, setTab] = useState<Tab>('overview')
    const [colorBy, setColorBy] = useState<ColorBy>('today')
    const [rosterView, setRosterView] = useState<RosterView>('all')
    const [openSection, setOpenSection] = useState<{ key: string; cadetId?: string } | null>(null)
    const [managing, setManaging] = useState<WingCadet | null>(null)
    const [transferWing, setTransferWing] = useState('')
    const [transferSection, setTransferSection] = useState('')
    const [adminWorking, setAdminWorking] = useState(false)
    // Demo wing (superadmins only) — remembered for this tab.
    const [demoOn, setDemoOn] = useState(() => { try { return sessionStorage.getItem(DEMO_KEY) === '1' } catch { return false } })

    // ── Data ──────────────────────────────────────────────────────────────────
    const { data: profileRow = null } = useData<{ rank: string; wing: string; role: string } | null>('profile:wing', async uid => {
        const { data, error } = await supabase.from('users').select('rank, wing, role').eq('id', uid).single()
        if (error) throw error
        return data
    })
    // Superadmin "View as" swaps in the previewed role + wing (lib/role-preview.ts).
    const preview = useRolePreview()
    const profile = useMemo(() => applyPreview(profileRow, preview), [profileRow, preview])
    const canDemo = isSuperadmin(profileRow?.role) // real role, so it also works while previewing
    const demo = canDemo && demoOn

    // Only instructors / superadmins may view the wing console.
    useEffect(() => {
        if (profile && !hasInstructorAccess(profile.role)) router.replace('/dashboard')
    }, [profile, router])

    const { data: availableWings = [] } = useData<string[]>('wings:list', async () => {
        const { data, error } = await supabase.from('ocs_wings').select('name').order('name')
        if (error) throw error
        return (data ?? []).map(w => w.name)
    })

    // Wing roster + scores, cached per period (lib/use-data.ts).
    const { data: lbData, isLoading, mutate: mutateCadets } = useApi<WingCadet[]>(
        profile && !demo ? `/api/leaderboard?scope=wing&wing=${encodeURIComponent(profile.wing)}&period=${period}` : null,
    )
    const demoCadets = useMemo(() => (demo ? makeDemoWing() : []), [demo])
    const cadets = useMemo(() => demo ? demoCadets : Array.isArray(lbData) ? lbData : [], [demo, demoCadets, lbData])
    const loading = !demo && isLoading

    const groups = useMemo(() => groupWing(cadets), [cadets])
    const stats = useMemo(() => groupStats(cadets), [cadets])
    const attention = useMemo(() => needsAttention(cadets), [cadets])
    const weakest = useMemo(() => weakestSectionToday(groups), [groups])
    const sectionsByKey = useMemo(() => new Map(groups.flatMap(p => p.sections).map(s => [s.key, s] as const)), [groups])
    const sectionCount = useMemo(() => groups.flatMap(p => p.sections).filter(s => s.section !== null).length, [groups])
    const platoonCount = groups.filter(p => p.platoon !== null).length

    function toggleDemo() {
        const next = !demoOn
        setDemoOn(next)
        try { if (next) sessionStorage.setItem(DEMO_KEY, '1'); else sessionStorage.removeItem(DEMO_KEY) } catch { /* storage blocked */ }
    }

    function openCadet(c: WingCadet) {
        if (isDemoCadet(c.id)) setOpenSection({ key: `${c.platoon ?? ''}|${c.section ?? ''}`, cadetId: c.id })
        else router.push(`/dashboard/wing/cadet/${c.id}`)
    }

    function showRoster(view: RosterView) {
        setRosterView(view)
        setTab('roster')
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    function manage(c: WingCadet) {
        setOpenSection(null)
        setManaging(c)
        setTransferWing('')
        setTransferSection(c.section ?? '')
    }

    const handleAdminAction = async (cadetId: string, action: AdminAction) => {
        if (!user) return
        setAdminWorking(true)
        try {
            const body: Record<string, string> = { cadetId, action }
            if (action === 'transfer_wing') body.newWing = transferWing
            if (action === 'assign_section') body.newSection = transferSection
            // The server identifies the instructor from the token (authFetch), not from the body.
            const res = await authFetch('/api/cadet-admin', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
            // Update the cached roster straight away (no refetch yet)…
            const update = (rows: WingCadet[]) => {
                if (action === 'remove_section') return rows.map(c => c.id === cadetId ? { ...c, section: null } : c)
                if (action === 'assign_section') return rows.map(c => c.id === cadetId ? { ...c, section: transferSection } : c)
                return rows.filter(c => c.id !== cadetId) // transferred out of this wing
            }
            await mutateCadets(prev => (Array.isArray(prev) ? update(prev) : prev), { revalidate: false })
            // …then re-fetch every cached leaderboard (this page, Home, Friends) in the background.
            void refreshData('/api/leaderboard')
        } finally {
            setAdminWorking(false)
            setManaging(null)
            setTransferWing('')
            setTransferSection('')
        }
    }

    if (!profile || !hasInstructorAccess(profile.role)) return null
    const wingName = demo ? DEMO_WING : profile.wing
    const pct = (n: number) => (stats.count ? Math.round((n / stats.count) * 100) : 0)

    return (
        <div className="px-4 md:px-8 py-8 md:py-10 max-w-7xl mx-auto">
            {/* ── Header ───────────────────────────────────────────────────── */}
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
                <div>
                    <h1 className="font-display font-extrabold text-[32px] tracking-tight text-foreground leading-none mb-1">{wingName} Wing</h1>
                    <p className="text-sm text-muted-foreground tabular-nums">
                        {loading ? 'Loading cadets…' : `${stats.count} cadets${platoonCount ? ` · ${platoonCount} platoons` : ''}${sectionCount ? ` · ${sectionCount} sections` : ''}`}
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <CadetSearch cadets={cadets} onPick={openCadet} />
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-muted dark:bg-background rounded-full p-0.5 gap-0.5">
                            {(['week', 'month'] as const).map(p => (
                                <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p}
                                    className={cn('px-3 py-1.5 rounded-full text-[12px] font-medium transition-all whitespace-nowrap',
                                        period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                                    {p === 'week' ? 'This week' : 'This month'}
                                </button>
                            ))}
                        </div>
                        {canDemo && (
                            <button onClick={toggleDemo} aria-pressed={demo} title="Preview My Wing with 150 fake cadets"
                                className={cn('h-9 px-3 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5 border transition-colors whitespace-nowrap',
                                    demo ? 'bg-primary/10 border-primary/40 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
                                <FlaskConical size={14} /> Demo wing
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {demo && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-primary/5 px-4 py-2.5 text-[13px]">
                    <FlaskConical size={16} className="text-primary shrink-0" />
                    <span className="flex-1 text-foreground">Demo wing — 150 fake cadets generated in your browser. Nothing here is real or saved.</span>
                    <button onClick={toggleDemo} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"><X size={14} /> Exit</button>
                </div>
            )}

            <Tabs value={tab} onValueChange={v => setTab(v as Tab)} className="gap-5">
                <TabsList>
                    <TabsTrigger value="overview" className="px-4">Overview</TabsTrigger>
                    <TabsTrigger value="roster" className="px-4">Roster <span className="text-muted-foreground tabular-nums">{stats.count || ''}</span></TabsTrigger>
                    <TabsTrigger value="trends" className="px-4">Trends</TabsTrigger>
                </TabsList>

                {loading ? (
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
                        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4">
                            <Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" />
                        </div>
                    </div>
                ) : cadets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                        <p className="text-sm text-muted-foreground">No cadets in {wingName} Wing yet.</p>
                    </div>
                ) : (
                    <>
                        <TabsContent value="overview" className="flex flex-col gap-4">
                            {/* ── Stat tiles ── */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <StatTile label="Logged today" value={stats.loggedToday} of={stats.count} bar={pct(stats.loggedToday)} note={`${pct(stats.loggedToday)}% of the wing`} />
                                <StatTile label="Logged this week" value={stats.active7} of={stats.count} bar={pct(stats.active7)} note="at least one meal in 7 days" />
                                <StatTile label="Avg score" value={stats.avgScore} bar={Math.min(100, (stats.avgScore / MAX_WEEKLY_SCORE) * 100)}
                                    note={`of ${MAX_WEEKLY_SCORE} · ${period === 'week' ? 'this week' : 'this month'}`} />
                                <StatTile label="Silent 3+ days" value={stats.silent} of={stats.count} danger={stats.silent > 0}
                                    note={stats.silent ? 'View in roster →' : 'Everyone logged recently'}
                                    onClick={stats.silent ? () => showRoster('silent') : undefined} />
                            </div>

                            {/* ── Wing map + needs attention ── */}
                            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start">
                                <SectionMap groups={groups} colorBy={colorBy} onColorBy={setColorBy}
                                    weakestKey={stats.loggedToday > 0 && weakest && weakest.stats.todayRate < 0.5 ? weakest.key : null}
                                    onOpenSection={(key, cadetId) => setOpenSection({ key, cadetId })} />
                                {/* Phones: the short attention list comes before the long map */}
                                <div className="order-first lg:order-none lg:sticky lg:top-6">
                                    <AttentionList items={attention} weakest={weakest} nobodyToday={stats.loggedToday === 0}
                                        onSeeAll={() => showRoster('attention')} onOpenSection={key => setOpenSection({ key })} />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="roster">
                            <Roster cadets={cadets} view={rosterView} onView={setRosterView} onManage={demo ? undefined : manage} />
                        </TabsContent>

                        <TabsContent value="trends">
                            <Trends cadets={cadets} groups={groups} />
                        </TabsContent>
                    </>
                )}
            </Tabs>

            <SectionDialog
                section={openSection ? sectionsByKey.get(openSection.key) ?? null : null}
                highlightId={openSection?.cadetId}
                onClose={() => setOpenSection(null)}
                onManage={demo ? undefined : manage}
            />

            <AssignmentDialog
                cadet={managing}
                currentWing={profile.wing}
                availableWings={availableWings}
                transferSection={transferSection}
                transferWing={transferWing}
                adminWorking={adminWorking}
                onTransferSectionChange={setTransferSection}
                onTransferWingChange={setTransferWing}
                onAction={handleAdminAction}
                onClose={() => { setManaging(null); setTransferWing(''); setTransferSection('') }}
            />
        </div>
    )
}

function StatTile({ label, value, of, bar, note, danger, onClick }: {
    label: string
    value: number
    of?: number
    /** 0–100 fill for the thin bar under the number. */
    bar?: number
    note: string
    danger?: boolean
    onClick?: () => void
}) {
    const Tag = onClick ? 'button' : 'div'
    return (
        <Tag onClick={onClick} className={cn('rounded-2xl bg-card border border-border p-4 md:p-5 text-left',
            onClick && 'hover:border-foreground/20 transition-colors', danger && 'border-danger/30')}>
            <div className={cn('text-xs mb-1.5 inline-flex items-center gap-1', danger ? 'text-danger font-medium' : 'text-muted-foreground')}>
                {danger && <AlertTriangle size={12} />}{label}
            </div>
            <div className="flex items-baseline gap-1.5">
                <span className="font-display font-extrabold text-3xl text-foreground tabular-nums">{value.toLocaleString()}</span>
                {of !== undefined && <span className="text-sm text-muted-foreground tabular-nums">/ {of}</span>}
            </div>
            {bar !== undefined && (
                <div className="mt-2 h-1.5 bg-muted dark:bg-background rounded-full overflow-hidden" aria-hidden>
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${bar}%`, background: 'var(--viz-accent)' }} />
                </div>
            )}
            <div className={cn('text-[11px] mt-1.5', danger ? 'text-danger' : 'text-muted-foreground')}>{note}</div>
        </Tag>
    )
}
