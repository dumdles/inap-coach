'use client'

// ── Admin console shell (superadmin only) ─────────────────────────────────────
// Wraps every /dashboard/admin/* page with:
//   • a role gate (non-superadmins are sent back to /dashboard — the APIs also
//     re-check, so this is UX, not security)
//   • a top tab bar (Overview · Wings · Watchlist · Staff) that complements the
//     app sidebar, plus the 7d / 28d period switch for the analytics tabs
//   • AdminDataProvider, so all analytics tabs share one fetch

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Layers, ListChecks, Users, RefreshCw } from 'lucide-react'
import { useAuth } from '@/app/context/auth-context'
import { supabase } from '@/lib/supabase'
import { isSuperadmin } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { AdminDataProvider, useAdminData, type Period } from '@/components/admin/admin-data'

const TABS = [
    { href: '/dashboard/admin', label: 'Overview', Icon: LayoutDashboard },
    { href: '/dashboard/admin/wings', label: 'Wings', Icon: Layers },
    { href: '/dashboard/admin/watchlist', label: 'Watchlist', Icon: ListChecks },
    { href: '/dashboard/admin/staff', label: 'Staff', Icon: Users },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()
    const router = useRouter()
    const [allowed, setAllowed] = useState(false)

    useEffect(() => {
        if (!user) return
        supabase.from('users').select('role').eq('id', user.id).single().then(({ data }) => {
            if (!isSuperadmin(data?.role)) router.replace('/dashboard')
            else setAllowed(true)
        })
    }, [user, router])

    if (!allowed) return null

    return (
        <AdminDataProvider enabled={allowed}>
            <div className="px-4 md:px-8 py-8 md:py-10 max-w-6xl mx-auto">
                <AdminHeader />
                {children}
            </div>
        </AdminDataProvider>
    )
}

function AdminHeader() {
    const pathname = usePathname()
    const { period, setPeriod, loading, reload, data } = useAdminData()
    const onStaff = pathname.startsWith('/dashboard/admin/staff')
    const isActive = (href: string) => href === '/dashboard/admin' ? pathname === href : pathname.startsWith(href)

    return (
        <div className="mb-6">
            <div className="flex flex-col gap-1 mb-5">
                <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Command</div>
                <h1 className="font-display font-extrabold text-[32px] tracking-tight text-foreground leading-none">OCS overview</h1>
                <p className="text-sm text-muted-foreground">
                    {data ? `${data.totals.cadets} cadets across ${data.totals.wings} wings` : 'All wings'}
                    {!onStaff && ` · last ${period} days vs the ${period} before`}
                </p>
            </div>

            {/* Tab bar + period controls share one row on desktop; on phones the
                period switch sits above the tabs so all four tabs stay visible */}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-3 sm:border-b sm:border-border">
                <nav className="flex gap-1 overflow-x-auto scrollbar-hide border-b border-border sm:border-b-0 sm:-mb-px" aria-label="Admin sections">
                    {TABS.map(({ href, label, Icon }) => (
                        <Link key={href} href={href}
                            aria-current={isActive(href) ? 'page' : undefined}
                            className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors',
                                isActive(href)
                                    ? 'border-foreground text-foreground'
                                    : 'border-transparent text-muted-foreground hover:text-foreground',
                            )}>
                            <Icon size={15} aria-hidden />{label}
                        </Link>
                    ))}
                </nav>
                {!onStaff && (
                    <div className="flex items-center justify-end gap-2 sm:pb-2 shrink-0">
                        <button onClick={() => void reload()} disabled={loading} title="Refresh"
                            className="hidden sm:inline-flex w-8 h-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50">
                            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
                        </button>
                        <div className="flex items-center bg-muted dark:bg-background rounded-full p-0.5 gap-0.5">
                            {([7, 28] as Period[]).map(p => (
                                <button key={p} onClick={() => setPeriod(p)}
                                    className={cn(
                                        'px-3 py-1 rounded-full text-[12px] font-medium transition-all',
                                        period === p ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                                    )}>
                                    {p}d
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
