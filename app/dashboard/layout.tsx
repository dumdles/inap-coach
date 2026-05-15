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
import { useTheme } from '@/app/context/theme-context'
import type { GoalMode } from '@/app/context/theme-context'

// ── Icons ─────────────────────────────────────────────────
function HomeIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg> }
function NutritionIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg> }
function WorkoutsIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v16M18 4v16M2 8h4M18 8h4M2 16h4M18 16h4M6 12h12" /></svg> }
function ProgressIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg> }
function FriendsIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function WingIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 17.5h7M17.5 14v7"/></svg> }
function SettingsIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> }
function LogoutIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg> }
function ChevronLeft() { return <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg> }
function ChevronRight() { return <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg> }
function BellIcon({ size = 16 }: { size?: number }) { return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg> }
function CheckIcon() { return <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg> }

// ── Notification types ─────────────────────────────────────
type Notification = {
    id: string
    type: string
    title: string
    body: string | null
    read: boolean
    created_at: string
}

// ── Notification Panel ─────────────────────────────────────
function NotificationPanel({ userId, anchorRef, onClose }: {
    userId: string
    anchorRef: React.RefObject<HTMLElement | null>
    onClose: () => void
}) {
    const [items, setItems] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
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
        fetch(`/api/notifications?userId=${userId}`)
            .then(r => r.json())
            .then(data => { setItems(data ?? []); setLoading(false) })
    }, [userId])

    async function markAllRead() {
        await fetch(`/api/notifications?userId=${userId}`, { method: 'PATCH' })
        setItems(prev => prev.map(n => ({ ...n, read: true })))
    }

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

    function timeAgo(iso: string) {
        const diff = Date.now() - new Date(iso).getTime()
        const m = Math.floor(diff / 60000)
        if (m < 1) return 'just now'
        if (m < 60) return `${m}m ago`
        const h = Math.floor(m / 60)
        if (h < 24) return `${h}h ago`
        return `${Math.floor(h / 24)}d ago`
    }

    const unread = items.filter(n => !n.read).length

    const panel = (
        <div
            ref={panelRef}
            className="fixed z-[200] bg-popover border border-border rounded-2xl shadow-lg overflow-hidden flex flex-col"
            style={{ width: 320, maxHeight: 440, top: coords?.top ?? 0, left: coords?.left ?? 0 }}
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
                <span className="text-sm font-semibold text-foreground">Notifications</span>
                {unread > 0 && (
                    <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 transition-colors"
                    >
                        <CheckIcon /> Mark all read
                    </button>
                )}
            </div>
            <div className="flex-1 overflow-y-auto">
                {loading && (
                    <div className="flex items-center justify-center py-8">
                        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                    </div>
                )}
                {!loading && items.length === 0 && (
                    <div className="py-10 flex flex-col items-center text-sm text-muted-foreground">
                        <BellIcon size={24} />
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
                                <div className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</div>
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
                <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
        </div>
    )

    if (typeof document === 'undefined' || !coords) return null
    return createPortal(panel, document.body)
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
                    'flex items-center gap-2.5 rounded-xl transition-all duration-150 relative',
                    expanded ? 'px-3 py-2.5 w-full' : 'justify-center py-2.5 w-full',
                    'text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/60'
                )}
            >
                <span className="flex-shrink-0 relative">
                    <BellIcon />
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

const BASE_NAV = [
    { href: '/dashboard', label: 'Home', Icon: HomeIcon },
    { href: '/dashboard/nutrition', label: 'Nutrition', Icon: NutritionIcon },
    { href: '/dashboard/workouts', label: 'Workouts', Icon: WorkoutsIcon },
    { href: '/dashboard/progress', label: 'Progress', Icon: ProgressIcon },
    { href: '/dashboard/friends', label: 'Leaderboard', Icon: FriendsIcon },
]

const INSTRUCTOR_NAV = [
    { href: '/dashboard/wing', label: 'My Wing', Icon: WingIcon },
]

const SIDEBAR_EXPANDED_W = 220
const SIDEBAR_COLLAPSED_W = 64
const SIDEBAR_MARGIN = 12

// ── Mobile bell (floating top-right) ──────────────────────
function MobileBell({ userId, unread, setUnread }: { userId: string; unread: number; setUnread: (n: number | ((prev: number) => number)) => void }) {
    const [open, setOpen] = useState(false)
    const buttonRef = useRef<HTMLButtonElement>(null)

    return (
        <div className="fixed top-4 right-4 z-50 md:hidden">
            <button
                ref={buttonRef}
                onClick={() => { setOpen(o => !o); setTimeout(() => setUnread(0), 2000) }}
                className="w-10 h-10 rounded-full bg-card border border-border shadow-md flex items-center justify-center relative text-foreground hover:bg-accent transition-colors"
            >
                <BellIcon size={18} />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center px-1">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>
            {open && (
                <NotificationPanel userId={userId} anchorRef={buttonRef} onClose={() => setOpen(false)} />
            )}
        </div>
    )
}

// ── Mobile bottom nav ──────────────────────────────────────
function MobileBottomNav({ pathname, profile }: {
    pathname: string
    profile: { rank?: string } | null
}) {
    const allNav = [
        ...BASE_NAV,
        ...(profile?.rank && isInstructor(profile.rank) ? INSTRUCTOR_NAV : []),
    ]

    return (
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
            {allNav.slice(0, 5).map(({ href, label, Icon }) => {
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
        </nav>
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

    const NavItem = ({ href, label, Icon }: { href: string; label: string; Icon: () => React.ReactElement }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
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
                <span className="flex-shrink-0"><Icon /></span>
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
                    <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor"><circle cx="12" cy="4" r="1.8"/><path d="M9.5 8.5c-.4.1-.8.4-1 .8L7 12.5c-.2.5 0 1.1.5 1.3.5.2 1.1 0 1.3-.5l.9-2.1 1 .9-1.5 4.5c-.2.5.1 1.1.6 1.3.5.2 1.1-.1 1.3-.6l1-3 1 1.2V20c0 .6.4 1 1 1s1-.4 1-1v-4.5c0-.3-.1-.5-.3-.7l-1.4-1.7 .6-1.8 .7 .7c.2.2.4.3.7.3H17c.6 0 1-.4 1-1s-.4-1-1-1h-1.7l-1.5-1.5c-.5-.5-1.2-.7-1.9-.5l-2.4.7z"/></svg>
                </div>
                {expanded && (
                    <span className="font-display text-[15px] font-extrabold tracking-tight text-sidebar-foreground whitespace-nowrap">
                        INAP<span className="text-primary">·</span>Coach
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
                        <SettingsIcon /> Settings
                    </Link>
                    <div
                        onClick={async () => {
                            setUserMenuOpen(false)
                            await signOut()
                            router.replace('/login')
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-destructive hover:bg-destructive/10 transition-colors duration-100 cursor-pointer w-full border-none bg-transparent"
                    >
                        <LogoutIcon /> Sign out
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
                {expanded ? <ChevronLeft /> : <ChevronRight />}
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

    const isSettings = pathname.startsWith('/dashboard/settings')

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

    if (isSettings) {
        return (
            <div className="bg-background">
                <style>{`@media (min-width: 768px) { .dash-content { margin-left: ${contentMargin}px; } }`}</style>
                <div className="hidden md:block">
                    <Sidebar expanded={expanded} onToggle={() => setExpanded(e => !e)} pathname={pathname} profile={profile} userId={user.id} unread={unread} setUnread={setUnread} />
                </div>
                <div className="dash-content h-screen overflow-hidden animate-in fade-in duration-200 pb-28 md:pb-0" style={{ animationFillMode: 'both' }}>
                    {children}
                </div>
                <MobileBell userId={user.id} unread={unread} setUnread={setUnread} />
                <MobileBottomNav pathname={pathname} profile={profile} />
            </div>
        )
    }

    return (
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
            <MobileBottomNav pathname={pathname} profile={profile} />
        </div>
    )
}
