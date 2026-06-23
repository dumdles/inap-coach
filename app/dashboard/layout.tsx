'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { isInstructor } from '@/lib/scoring'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { BottomSheet } from '@/components/ui/bottom-sheet'
import { FabProvider, useFabEntry } from '@/app/context/fab-context'
import { useTheme } from '@/app/context/theme-context'
import type { GoalMode } from '@/app/context/theme-context'
import {
    Home, Utensils, Dumbbell, Moon, TrendingUp,
    Trophy, Brain, LayoutGrid, Bell, Settings, LogOut,
    ChevronLeft, ChevronRight, Check, SportShoe, MoreHorizontal, Calculator, Sparkles,
    Pencil, Plus,
} from 'lucide-react'

// ── Notification types ─────────────────────────────────────
type Notification = {
    id: string
    type: string
    title: string
    body: string | null
    read: boolean
    created_at: string
}

function notifTimeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    return `${Math.floor(h / 24)}d ago`
}

// ── Notification list ──────────────────────────────────────
// Shared notification chrome (header + scrollable list + "View all" footer).
// Reused by the desktop anchored popover (NotificationPanel) and the mobile
// bottom sheet (MobileBell) so both stay in sync. Fetches its own data.
function NotificationList({ userId, onClose }: { userId: string; onClose: () => void }) {
    const [items, setItems] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch(`/api/notifications?userId=${userId}`)
            .then(r => r.json())
            .then(data => { setItems(data ?? []); setLoading(false) })
            .catch(() => setLoading(false))
    }, [userId])

    async function markAllRead() {
        await fetch(`/api/notifications?userId=${userId}`, { method: 'PATCH' })
        setItems(prev => prev.map(n => ({ ...n, read: true })))
    }

    const unread = items.filter(n => !n.read).length

    return (
        <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unread > 0 && (
                    <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                    >
                        <Check size={13} /> Mark all read
                    </button>
                )}
            </div>
            <div className="overflow-y-auto max-h-[55vh]">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                )}
                {!loading && items.length === 0 && (
                    <div className="py-10 flex flex-col items-center text-sm text-muted-foreground">
                        <Bell size={24} />
                        <p className="mt-2">No notifications yet</p>
                    </div>
                )}
                {!loading && items.map(n => (
                    <div
                        key={n.id}
                        className={cn(
                            'px-4 py-3 border-b border-border/50 last:border-0 transition-colors',
                            !n.read && 'bg-primary/5'
                        )}
                    >
                        <div className="flex items-start gap-2.5">
                            {!n.read && (
                                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            )}
                            <div className={cn('flex-1 min-w-0', n.read && 'pl-4')}>
                                <div className="text-[13px] font-medium text-foreground leading-snug">{n.title}</div>
                                {n.body && <div className="text-[12px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.body}</div>}
                                <div className="text-[11px] text-muted-foreground/60 mt-1">{notifTimeAgo(n.created_at)}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
            <a
                href="/dashboard/notifications"
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 py-2.5 border-t border-border text-[12px] font-medium text-primary hover:bg-primary/5 transition-colors flex-shrink-0"
            >
                View all notifications
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </a>
        </>
    )
}

// ── Desktop notification popover ───────────────────────────
// Anchored popover used by the sidebar bell. (Mobile uses a bottom sheet.)
function NotificationPanel({ userId, anchorRef, onClose }: {
    userId: string
    anchorRef: React.RefObject<HTMLElement | null>
    onClose: () => void
}) {
    const panelRef = useRef<HTMLDivElement>(null)
    const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

    useEffect(() => {
        if (anchorRef.current) {
            const r = anchorRef.current.getBoundingClientRect()
            const PANEL_W = 320
            const GAP = 8
            const vw = window.innerWidth
            // Right-align if anchoring near the right edge would overflow
            const rawLeft = r.left
            const left = rawLeft + PANEL_W + GAP > vw
                ? Math.max(GAP, r.right - PANEL_W)
                : rawLeft
            setCoords({ top: r.bottom + GAP, left })
        }
    }, [anchorRef])

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
                anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [onClose, anchorRef])

    if (typeof document === 'undefined' || !coords) return null
    return createPortal(
        <div
            ref={panelRef}
            className="fixed z-[200] bg-popover border border-border rounded-2xl shadow-lg overflow-hidden flex flex-col"
            style={{ width: 320, top: coords.top, left: coords.left }}
        >
            <NotificationList userId={userId} onClose={onClose} />
        </div>,
        document.body
    )
}

// ── Shared unread count (one fetch, visibility-aware, 5 min poll) ──
function useUnreadCount(userId: string) {
    const [unread, setUnread] = useState(0)
    const fetch$ = useCallback(() => {
        if (!userId || document.hidden) return
        fetch(`/api/notifications?userId=${userId}`)
            .then(r => r.json())
            .then((data: Notification[]) => setUnread((data ?? []).filter(n => !n.read).length))
            .catch(() => {})
    }, [userId])
    useEffect(() => {
        fetch$()
        const id = setInterval(fetch$, 5 * 60_000)
        document.addEventListener('visibilitychange', fetch$)
        return () => { clearInterval(id); document.removeEventListener('visibilitychange', fetch$) }
    }, [fetch$])
    return [unread, setUnread] as const
}

// ── Bell button with unread badge ──────────────────────────
function NotificationBell({ userId, expanded, unread, setUnread }: { userId: string; expanded: boolean; unread: number; setUnread: (n: number | ((prev: number) => number)) => void }) {
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)

    function handleOpen() {
        setOpen(o => !o)
        if (!open) setTimeout(() => setUnread(0), 2000)
    }

    return (
        <>
            <button
                ref={buttonRef}
                onClick={handleOpen}
                title="Notifications"
                className={cn(
                    'flex items-center gap-2.5 rounded-xl transition-all duration-150 relative group',
                    expanded ? 'px-3 py-2.5 w-full' : 'justify-center py-2.5 w-full',
                    'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
                )}
            >
                <span className="flex-shrink-0 relative transition-transform duration-200 group-hover:-rotate-12">
                    <Bell size={18} />
                    {unread > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </span>
                {expanded && <span className="text-[13px] font-medium whitespace-nowrap">Notifications</span>}
            </button>
            {open && (
                <NotificationPanel
                    userId={userId}
                    anchorRef={buttonRef}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    )
}

// ── Nav items ──────────────────────────────────────────────
// iconClassName is applied to the icon wrapper — use group-hover: classes for hover animations
const BASE_NAV = [
    { href: '/dashboard',                        label: 'Home',        Icon: () => <Home size={18} />,         iconClassName: 'group-hover:-translate-y-0.5' },
    { href: '/dashboard/nutrition',              label: 'Nutrition',   Icon: () => <Utensils size={18} />,     iconClassName: 'group-hover:rotate-12' },
    { href: '/dashboard/workouts',               label: 'Workouts',    Icon: () => <Dumbbell size={18} />,     iconClassName: 'group-hover:-rotate-12' },
    { href: '/dashboard/sleep',                  label: 'Sleep',       Icon: () => <Moon size={18} />,         iconClassName: 'group-hover:-rotate-12' },
    { href: '/dashboard/progress',               label: 'Progress',    Icon: () => <TrendingUp size={18} />,   iconClassName: 'group-hover:-translate-y-0.5' },
    { href: '/dashboard/ippt',                   label: 'IPPT',        Icon: () => <SportShoe size={18} />,    iconClassName: 'group-hover:-translate-y-1' },
    { href: '/dashboard/friends',                label: 'Leaderboard', Icon: () => <Trophy size={18} />,       iconClassName: 'group-hover:scale-110' },
    { href: '/dashboard/insights',               label: 'Insights',    Icon: () => <Brain size={18} />,        iconClassName: 'group-hover:scale-110' },
    { href: '/dashboard/coach',                  label: 'AI Coach',    Icon: () => <Sparkles size={18} />,     iconClassName: 'group-hover:scale-110' },
    { href: '/dashboard/nutrition/calculator',   label: 'Calculator',  Icon: () => <Calculator size={18} />,  iconClassName: 'group-hover:scale-110' },
]

const INSTRUCTOR_NAV = [
    { href: '/dashboard/wing', label: 'My Wing', Icon: () => <LayoutGrid size={18} />, iconClassName: 'group-hover:scale-110' },
]

type NavItem = (typeof BASE_NAV)[number]

// Default mobile bottom-bar tabs. Cadets can customise these (see useNavTabs);
// AI Coach ships in the bar by default in place of Sleep.
const DEFAULT_PRIMARY_HREFS = ['/dashboard', '/dashboard/nutrition', '/dashboard/workouts', '/dashboard/coach']
const NAV_TABS_KEY = 'fitrep:nav-tabs'

// Resolve a list of hrefs into BASE_NAV items, in canonical nav order.
function resolveTabs(hrefs: string[]): NavItem[] {
    return BASE_NAV.filter(item => hrefs.includes(item.href))
}

// Reads/writes the cadet's chosen bottom-bar tabs from localStorage (per-device).
// Returns the resolved primary (bar) + overflow ("More" sheet) item lists.
function useNavTabs() {
    const [primaryHrefs, setPrimaryHrefs] = useState<string[]>(DEFAULT_PRIMARY_HREFS)

    useEffect(() => {
        try {
            const raw = localStorage.getItem(NAV_TABS_KEY)
            if (!raw) return
            const parsed = JSON.parse(raw)
            // Validate: exactly 4 known hrefs, else fall back to the default.
            const valid = Array.isArray(parsed)
                && parsed.length === 4
                && parsed.every((h: unknown) => BASE_NAV.some(n => n.href === h))
            if (valid) setPrimaryHrefs(parsed)
        } catch { /* ignore malformed storage */ }
    }, [])

    const setPrimary = useCallback((hrefs: string[]) => {
        setPrimaryHrefs(hrefs)
        try { localStorage.setItem(NAV_TABS_KEY, JSON.stringify(hrefs)) } catch { /* ignore */ }
    }, [])

    const primary = resolveTabs(primaryHrefs)            // tabs shown in the bottom bar
    const overflow = BASE_NAV.filter(n => !primaryHrefs.includes(n.href)) // rest → "More"

    return { primaryHrefs, primary, overflow, setPrimary }
}

const SIDEBAR_EXPANDED_W = 220
const SIDEBAR_COLLAPSED_W = 64
const SIDEBAR_MARGIN = 12

// ── Mobile bell (floating top-right) ──────────────────────
// Opens notifications as a bottom sheet. While already on the full notifications
// page the bell is inert — tapping it does nothing (no sheet re-trigger).
function MobileBell({ userId, unread, setUnread }: { userId: string; unread: number; setUnread: (n: number | ((prev: number) => number)) => void }) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()
    const onNotifPage = pathname.startsWith('/dashboard/notifications')

    return (
        <div className="fixed top-4 right-4 z-50 md:hidden">
            <button
                onClick={() => {
                    if (onNotifPage) return
                    setOpen(true)
                    setTimeout(() => setUnread(0), 2000)
                }}
                className="w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center relative text-foreground hover:bg-accent transition-colors"
            >
                <Bell size={18} />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center px-1">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>
            <BottomSheet open={open} onClose={() => setOpen(false)}>
                <NotificationList userId={userId} onClose={() => setOpen(false)} />
            </BottomSheet>
        </div>
    )
}

// ── More sheet (overflow nav for mobile) ──────────────────
function MobileMoreSheet({ open, onClose, pathname, profile, overflow, primaryHrefs, setPrimary }: {
    open: boolean
    onClose: () => void
    pathname: string
    profile: { rank?: string; full_name?: string; wing?: string } | null
    overflow: NavItem[]
    primaryHrefs: string[]
    setPrimary: (hrefs: string[]) => void
}) {
    const { signOut } = useAuth()
    const router = useRouter()
    // Customise mode lets the cadet pick which 4 tabs sit in the bottom bar.
    const [editing, setEditing] = useState(false)
    // Local draft of the selected bar tabs while editing (committed on "Done").
    const [draft, setDraft] = useState<string[]>(primaryHrefs)

    // Reset the draft whenever the sheet (re)opens or the saved set changes.
    useEffect(() => { if (open) { setEditing(false); setDraft(primaryHrefs) } }, [open, primaryHrefs])

    // Instructors get an extra "My Wing" tab pinned in the overflow grid.
    const overflowNav = [
        ...overflow,
        ...(profile?.rank && isInstructor(profile.rank) ? INSTRUCTOR_NAV : []),
    ]

    function toggleDraft(href: string) {
        setDraft(prev => {
            if (prev.includes(href)) return prev.filter(h => h !== href)
            if (prev.length >= 4) return prev // cap at 4 — must deselect one first
            return [...prev, href]
        })
    }

    function saveCustomisation() {
        // Persist in canonical order so the bar order is stable.
        setPrimary(BASE_NAV.filter(n => draft.includes(n.href)).map(n => n.href))
        setEditing(false)
    }

    return (
        <BottomSheet open={open} onClose={onClose} contentClassName="px-2 pt-1 pb-3">
            {/* Header — title + customise toggle */}
            <div className="flex items-center justify-between px-3 pb-2">
                <span className="text-[13px] font-semibold text-foreground">
                    {editing ? 'Choose 4 bar tabs' : 'More'}
                </span>
                {editing ? (
                    <button
                        onClick={saveCustomisation}
                        disabled={draft.length !== 4}
                        className={cn(
                            'flex items-center gap-1 text-[12px] font-semibold transition-colors',
                            draft.length === 4 ? 'text-primary hover:text-primary/80' : 'text-muted-foreground/50 cursor-not-allowed'
                        )}
                    >
                        <Check size={14} /> Done ({draft.length}/4)
                    </button>
                ) : (
                    <button
                        onClick={() => setEditing(true)}
                        className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <Pencil size={13} /> Customise
                    </button>
                )}
            </div>

            {editing ? (
                /* ── Customise editor: pick which tabs live in the bottom bar ── */
                <div className="px-1">
                    <div className="grid grid-cols-4 gap-1">
                        {BASE_NAV.map(({ href, label, Icon }) => {
                            const selected = draft.includes(href)
                            const full = draft.length >= 4 && !selected
                            return (
                                <button
                                    key={href}
                                    onClick={() => toggleDraft(href)}
                                    disabled={full}
                                    className={cn(
                                        'relative flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-[11px] font-semibold tracking-[0.02em] transition-colors duration-150',
                                        selected
                                            ? 'bg-primary/10 text-primary ring-1 ring-primary/40'
                                            : full
                                                ? 'text-foreground/25 cursor-not-allowed'
                                                : 'text-foreground/60 hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    {selected && (
                                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center">
                                            <Check size={10} strokeWidth={3} />
                                        </span>
                                    )}
                                    <Icon />
                                    <span>{label}</span>
                                </button>
                            )
                        })}
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 text-center mt-2 px-4">
                        Pick exactly 4 tabs for the bottom bar. The rest stay here in More.
                    </p>
                </div>
            ) : (
                <>
                    {/* Overflow nav grid */}
                    <div className="grid grid-cols-4 gap-1">
                        {overflowNav.map(({ href, label, Icon }) => {
                            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    onClick={onClose}
                                    className={cn(
                                        'flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-[11px] font-semibold tracking-[0.02em] transition-colors duration-150',
                                        active
                                            ? 'bg-primary/10 text-primary'
                                            : 'text-foreground/60 hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    <Icon />
                                    <span>{label}</span>
                                </Link>
                            )
                        })}
                    </div>

                    <div className="mx-2 my-3 border-t border-border" />

                    {/* Settings & sign out */}
                    <Link
                        href="/dashboard/settings"
                        onClick={onClose}
                        className={cn(
                            'flex items-center gap-3 px-4 py-3 rounded-2xl text-[14px] font-medium transition-colors duration-150',
                            pathname.startsWith('/dashboard/settings')
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground hover:bg-muted'
                        )}
                    >
                        <Settings size={18} />
                        Settings
                    </Link>
                    <button
                        onClick={async () => {
                            onClose()
                            await signOut()
                            router.replace('/login')
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 rounded-2xl text-[14px] font-medium text-destructive hover:bg-destructive/10 transition-colors duration-150"
                    >
                        <LogOut size={18} />
                        Sign out
                    </button>
                </>
            )}
        </BottomSheet>
    )
}

// ── Mobile bottom nav ──────────────────────────────────────
function MobileBottomNav({ pathname, profile, primary, overflow, primaryHrefs, setPrimary }: {
    pathname: string
    profile: { rank?: string } | null
    primary: NavItem[]
    overflow: NavItem[]
    primaryHrefs: string[]
    setPrimary: (hrefs: string[]) => void
}) {
    const [moreOpen, setMoreOpen] = useState(false)

    // "More" tab appears active when the current page is in the overflow set
    const overflowActive = [...overflow, ...INSTRUCTOR_NAV].some(
        ({ href }) => pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
    )

    return (
        <>
            <nav
                className="fixed z-50 flex md:hidden items-center"
                style={{
                    bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
                    left: '16px',
                    right: '16px',
                    background: 'rgba(255,255,255,0.35)',
                    backdropFilter: 'blur(28px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(28px) saturate(200%)',
                    borderRadius: '999px',
                    border: '1px solid rgba(255,255,255,0.45)',
                    boxShadow: '0 8px 32px rgba(9,30,66,0.14), 0 1.5px 6px rgba(9,30,66,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
                    padding: '6px',
                    gap: '2px',
                }}
            >
                {primary.map(({ href, label, Icon }) => {
                    const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex flex-col items-center justify-center gap-[3px] flex-1 py-2 px-1 text-[9px] font-semibold tracking-[0.04em] transition-all duration-200 rounded-[999px]',
                                active
                                    ? 'text-primary bg-white/70 shadow-sm'
                                    : 'text-foreground/50 hover:text-foreground/80',
                            )}
                            style={active ? { boxShadow: '0 1px 4px rgba(9,30,66,0.10)' } : undefined}
                        >
                            <Icon />
                            <span>{label}</span>
                        </Link>
                    )
                })}

                {/* More button — opens the overflow sheet */}
                <button
                    onClick={() => setMoreOpen(true)}
                    className={cn(
                        'flex flex-col items-center justify-center gap-[3px] flex-1 py-2 px-1 text-[9px] font-semibold tracking-[0.04em] transition-all duration-200 rounded-[999px] border-none cursor-pointer',
                        overflowActive
                            ? 'text-primary bg-white/70 shadow-sm'
                            : 'text-foreground/50 hover:text-foreground/80',
                    )}
                    style={overflowActive ? { boxShadow: '0 1px 4px rgba(9,30,66,0.10)' } : undefined}
                >
                    <MoreHorizontal size={18} />
                    <span>More</span>
                </button>
            </nav>

            <MobileMoreSheet
                open={moreOpen}
                onClose={() => setMoreOpen(false)}
                pathname={pathname}
                profile={profile}
                overflow={overflow}
                primaryHrefs={primaryHrefs}
                setPrimary={setPrimary}
            />
        </>
    )
}

// ── Contextual FAB (mobile, floating above the nav) ────────
// Renders the action the current page registered via useFab() — e.g. log a meal
// on the dashboard, log sleep on the sleep page, log a workout on workouts.
// Pages own their own log dialogs; the FAB only triggers them. Hidden on routes
// that register no action.
function MobileFab() {
    const entry = useFabEntry()
    if (!entry) return null

    return (
        <button
            onClick={entry.trigger}
            aria-label={entry.label}
            className="fixed right-4 z-50 md:hidden w-14 h-14 rounded-[1.25rem] bg-primary text-white flex items-center justify-center transition-transform active:scale-95 hover:scale-105"
            style={{
                // Sit above the floating nav pill with a comfortable gap.
                bottom: 'calc(env(safe-area-inset-bottom) + 104px)',
                boxShadow: '0 8px 24px rgba(9,30,66,0.28), 0 2px 6px rgba(9,30,66,0.18)',
            }}
        >
            {/* Page glyph + a small "+" badge to signal an "add/log" action */}
            <span className="relative">
                {entry.icon}
                <span className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-white text-primary flex items-center justify-center">
                    <Plus size={11} strokeWidth={3} />
                </span>
            </span>
        </button>
    )
}

function Sidebar({ expanded, onToggle, pathname, profile, userId, unread, setUnread }: {
    expanded: boolean
    onToggle: () => void
    pathname: string
    profile: { rank?: string; full_name?: string; wing?: string } | null
    userId: string
    unread: number
    setUnread: (n: number | ((prev: number) => number)) => void
}) {
    const { user, signOut } = useAuth()
    const router = useRouter()
    const [userMenuOpen, setUserMenuOpen] = useState(false)

    const displayName = profile?.full_name ?? user?.user_metadata?.full_name ?? ''
    const rank = profile?.rank ?? ''
    const initials = displayName
        .split(' ').map((w: string) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'

    const NavItem = ({ href, label, Icon, iconClassName }: {
        href: string
        label: string
        Icon: () => React.ReactElement
        iconClassName?: string
    }) => {
        // A nav item is active if the path starts with its href,
        // unless a more specific nav item also matches (e.g. /nutrition/calculator beats /nutrition).
        const active = pathname === href || (
            href !== '/dashboard' &&
            pathname.startsWith(href) &&
            !BASE_NAV.some(n => n.href !== href && n.href.startsWith(href + '/') && pathname.startsWith(n.href))
        )
        return (
            <Link
                href={href}
                title={!expanded ? label : undefined}
                className={cn(
                    'flex items-center gap-3 rounded-xl transition-all duration-150 group relative',
                    expanded ? 'px-3 py-2.5' : 'justify-center py-2.5',
                    active
                        ? 'bg-sidebar-accent text-sidebar-foreground font-semibold'
                        : 'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
                )}
            >
                <span className={cn('flex-shrink-0 transition-transform duration-200', iconClassName)}>
                    <Icon />
                </span>
                {expanded && (
                    <span className="text-[13px] font-medium whitespace-nowrap overflow-hidden">
                        {label}
                    </span>
                )}
                {active && (
                    <span className="absolute left-0 top-2 bottom-2 w-[3px] bg-primary rounded-r-full" />
                )}
                {!expanded && (
                    <span className="absolute left-full ml-3 px-2.5 py-1.5 bg-popover text-popover-foreground border border-border text-[12px] font-medium rounded-lg whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-100 shadow-lg z-50">
                        {label}
                    </span>
                )}
            </Link>
        )
    }

    return (
        <aside
            className="fixed top-3 left-3 bottom-3 z-40 flex flex-col rounded-2xl overflow-hidden transition-all duration-300 ease-in-out bg-sidebar ring-1 ring-sidebar-border/60"
            style={{
                width: expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W,
                boxShadow: '0 8px 32px rgba(9,30,66,0.14), 0 2px 8px rgba(9,30,66,0.08)',
            }}
        >
            {/* Logo */}
            <div className={cn('flex items-center gap-2.5 px-4 py-5 flex-shrink-0', !expanded && 'justify-center px-0')}>
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-white flex-shrink-0">
                    <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><circle cx="12" cy="4" r="1.8" /><path d="M9.5 8.5c-.4.1-.8.4-1 .8L7 12.5c-.2.5 0 1.1.5 1.3.5.2 1.1 0 1.3-.5l.9-2.1 1 .9-1.5 4.5c-.2.5.1 1.1.6 1.3.5.2 1.1-.1 1.3-.6l1-3 1 1.2V20c0 .6.4 1 1 1s1-.4 1-1v-4.5c0-.3-.1-.5-.3-.7l-1.4-1.7 .6-1.8 .7 .7c.2.2.4.3.7.3H17c.6 0 1-.4 1-1s-.4-1-1-1h-1.7l-1.5-1.5c-.5-.5-1.2-.7-1.9-.5l-2.4.7z" /></svg>
                </div>
                {expanded && (
                    <span className="font-display text-[15px] font-extrabold tracking-tight text-sidebar-foreground whitespace-nowrap">
                        FitRep
                    </span>
                )}
            </div>

            {/* Divider */}
            <div className="mx-3 border-t border-sidebar-border mb-3" />

            {/* Main nav */}
            <nav className={cn('flex flex-col gap-0.5 flex-1 overflow-y-auto overflow-x-hidden', expanded ? 'px-2.5' : 'px-2')}>
                {BASE_NAV.map(item => <NavItem key={item.href} {...item} />)}
                {profile?.rank && isInstructor(profile.rank) && (
                    <>
                        <div className={cn('mx-1 border-t border-sidebar-border my-1.5', !expanded && 'mx-0')} />
                        {INSTRUCTOR_NAV.map(item => <NavItem key={item.href} {...item} />)}
                    </>
                )}
                <div className={cn('mx-1 border-t border-sidebar-border my-1.5', !expanded && 'mx-0')} />
                <NotificationBell userId={userId} expanded={expanded} unread={unread} setUnread={setUnread} />
            </nav>

            {/* Divider */}
            <div className="mx-3 border-t border-sidebar-border mt-3 mb-2" />

            {/* User section — click to open popover */}
            <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={cn(
                            'flex items-center gap-2.5 mx-2.5 mb-2 rounded-xl px-2 py-2 transition-colors duration-150 border-none cursor-pointer w-[calc(100%-20px)] text-left',
                            'bg-sidebar-accent/40 hover:bg-sidebar-accent',
                            !expanded && 'justify-center mx-2 w-[calc(100%-16px)]'
                        )}
                    >
                        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                            {initials}
                        </div>
                        {expanded && (
                            <div className="min-w-0 flex-1">
                                <div className="text-[12px] font-semibold text-sidebar-foreground truncate">
                                    {[rank, displayName].filter(Boolean).join(' ') || 'Cadet'}
                                </div>
                                <div className="text-[10px] text-sidebar-foreground/45 truncate">{user?.email}</div>
                            </div>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent side="right" align="end" sideOffset={10} className="w-44 p-3 gap-1">
                    <Link
                        href="/dashboard/settings"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-foreground hover:bg-accent transition-colors duration-100 cursor-pointer"
                    >
                        <Settings size={15} /> Settings
                    </Link>
                    <div
                        onClick={async () => {
                            setUserMenuOpen(false)
                            await signOut()
                            router.replace('/login')
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors duration-100 cursor-pointer w-full border-none bg-transparent"
                    >
                        <LogOut size={15} /> Sign out
                    </div>
                </PopoverContent>
            </Popover>

            {/* Collapse toggle */}
            <button
                onClick={onToggle}
                className={cn(
                    'flex items-center justify-center mx-2.5 mb-3 h-8 rounded-xl transition-all duration-150 border-none cursor-pointer flex-shrink-0',
                    'bg-sidebar-accent/40 hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground/70',
                    !expanded && 'mx-2'
                )}
                title={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
                {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
            </button>
        </aside>
    )
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, isLoading } = useAuth()
    const router = useRouter()
    const pathname = usePathname()
    const [expanded, setExpanded] = useState(true)
    const [profile, setProfile] = useState<{ rank?: string; full_name?: string; wing?: string } | null>(null)
    const { setGoalMode } = useTheme()
    const [unread, setUnread] = useUnreadCount(user?.id ?? '')
    const { primary, overflow, primaryHrefs, setPrimary } = useNavTabs()

    // Settings and the AI coach manage their own internal scroll region (a
    // fixed-height shell with one scrollable pane inside), instead of letting
    // the whole page scroll like every other dashboard route. Without this,
    // mobile Safari's dynamic viewport units leave a sliver of scrollable
    // space below the coach's input field instead of pinning it to the nav.
    const isSettings = pathname.startsWith('/dashboard/settings')
    const isCoach = pathname.startsWith('/dashboard/coach')
    const fixedShell = isSettings || isCoach

    useEffect(() => {
        if (!isLoading && !user) router.replace('/login')
    }, [isLoading, user, router])

    useEffect(() => {
        if (!user) return
        supabase.from('users').select('rank, full_name, wing, goal_mode').eq('id', user.id).single()
            .then(({ data }) => {
                if (data) {
                    setProfile(data)
                    if (data.goal_mode) setGoalMode(data.goal_mode as GoalMode)
                }
            })
    }, [user])

    if (isLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
        )
    }

    const sidebarW = expanded ? SIDEBAR_EXPANDED_W : SIDEBAR_COLLAPSED_W
    const contentMargin = sidebarW + SIDEBAR_MARGIN * 2

    if (fixedShell) {
        return (
            <FabProvider>
                <div className="bg-background">
                    <style>{`@media (min-width: 768px) { .dash-content { margin-left: ${contentMargin}px; } }`}</style>
                    <div className="hidden md:block">
                        <Sidebar expanded={expanded} onToggle={() => setExpanded(e => !e)} pathname={pathname} profile={profile} userId={user.id} unread={unread} setUnread={setUnread} />
                    </div>
                    <div className="dash-content h-screen overflow-hidden animate-in fade-in duration-200 pb-28 md:pb-0" style={{ animationFillMode: 'both' }}>
                        {children}
                    </div>
                    <MobileBell userId={user.id} unread={unread} setUnread={setUnread} />
                    <MobileFab />
                    <MobileBottomNav pathname={pathname} profile={profile} primary={primary} overflow={overflow} primaryHrefs={primaryHrefs} setPrimary={setPrimary} />
                </div>
            </FabProvider>
        )
    }

    return (
        <FabProvider>
            <div className="min-h-screen bg-background">
                <style>{`@media (min-width: 768px) { .dash-content { margin-left: ${contentMargin}px; transition: margin-left 300ms ease; } }`}</style>
                <div className="hidden md:block">
                    <Sidebar expanded={expanded} onToggle={() => setExpanded(e => !e)} pathname={pathname} profile={profile} userId={user.id} unread={unread} setUnread={setUnread} />
                </div>
                <main className="dash-content min-h-screen overflow-y-auto pb-28 md:pb-0">
                    <div className="animate-in fade-in duration-200" style={{ animationFillMode: 'both' }}>
                        {children}
                    </div>
                </main>
                <MobileBell userId={user.id} unread={unread} setUnread={setUnread} />
                <MobileFab />
                <MobileBottomNav pathname={pathname} profile={profile} primary={primary} overflow={overflow} primaryHrefs={primaryHrefs} setPrimary={setPrimary} />
            </div>
        </FabProvider>
    )
}
