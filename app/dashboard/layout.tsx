'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// ── Icons ─────────────────────────────────────────────────
function HomeIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" /><path d="M9 21V12h6v9" /></svg> }
function NutritionIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg> }
function WorkoutsIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6.5h11M6.5 17.5h11M3 12h18M6 6.5v11M18 6.5v11" /></svg> }
function ProgressIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg> }
function FriendsIcon() { return <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> }
function SettingsIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg> }
function LogoutIcon() { return <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg> }
function ChevronLeft() { return <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg> }
function ChevronRight() { return <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg> }

const MAIN_NAV = [
    { href: '/dashboard', label: 'Home', Icon: HomeIcon },
    { href: '/dashboard/nutrition', label: 'Nutrition', Icon: NutritionIcon },
    { href: '/dashboard/workouts', label: 'Workouts', Icon: WorkoutsIcon },
    { href: '/dashboard/progress', label: 'Progress', Icon: ProgressIcon },
    { href: '/dashboard/friends', label: 'Friends', Icon: FriendsIcon },
]

const SIDEBAR_EXPANDED_W = 220
const SIDEBAR_COLLAPSED_W = 64
const SIDEBAR_MARGIN = 12

function Sidebar({ expanded, onToggle, pathname, profile }: {
    expanded: boolean
    onToggle: () => void
    pathname: string
    profile: { rank?: string; full_name?: string } | null
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
                <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center font-display text-[13px] font-extrabold text-white flex-shrink-0">I</div>
                {expanded && (
                    <span className="font-display text-[15px] font-extrabold tracking-tight text-sidebar-foreground whitespace-nowrap">
                        INAP<span className="text-primary">·</span>Coach
                    </span>
                )}
            </div>

            {/* Divider */}
            <div className="mx-3 border-t border-sidebar-border mb-3" />

            {/* Main nav */}
            <nav className={cn('flex flex-col gap-0.5 flex-1 overflow-y-auto', expanded ? 'px-2.5' : 'px-2')}>
                {MAIN_NAV.map(item => <NavItem key={item.href} {...item} />)}
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
    const [profile, setProfile] = useState<{ rank?: string; full_name?: string } | null>(null)

    const isSettings = pathname.startsWith('/dashboard/settings')

    useEffect(() => {
        if (!isLoading && !user) router.replace('/login')
    }, [isLoading, user, router])

    useEffect(() => {
        if (!user) return
        supabase.from('users').select('rank, full_name').eq('id', user.id).single()
            .then(({ data }) => { if (data) setProfile(data) })
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
                <Sidebar expanded={expanded} onToggle={() => setExpanded(e => !e)} pathname={pathname} profile={profile} />
                <div
                    className="h-screen overflow-hidden animate-in fade-in duration-200"
                    style={{ marginLeft: contentMargin, animationFillMode: 'both' }}
                >
                    {children}
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            <Sidebar expanded={expanded} onToggle={() => setExpanded(e => !e)} pathname={pathname} profile={profile} />
            <main
                className="min-h-screen transition-all duration-300 ease-in-out overflow-y-auto"
                style={{ marginLeft: contentMargin }}
            >
                <div className="animate-in fade-in duration-200" style={{ animationFillMode: 'both' }}>
                    {children}
                </div>
            </main>
        </div>
    )
}
