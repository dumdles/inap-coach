'use client'

// Shared state for the Admin console tabs. The layout (app/dashboard/admin/layout.tsx)
// fetches /api/admin/analytics once per period and every tab reads it from here,
// so switching between Overview / Wings / Watchlist is instant.

import React, { createContext, useContext, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useApi } from '@/lib/use-data'
import type { CommandAnalytics } from '@/lib/admin-analytics'

export type Period = 7 | 28

type Ctx = {
    data: CommandAnalytics | null
    loading: boolean
    error: string
    period: Period
    setPeriod: (p: Period) => void
    reload: () => Promise<void>
}

const AdminDataContext = createContext<Ctx | null>(null)

/** Bearer header for admin API calls — the server re-checks superadmin on every request. */
export async function adminHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` }
}

export function AdminDataProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
    const [period, setPeriod] = useState<Period>(28)
    const [reloading, setReloading] = useState(false)

    // Cached per period via the shared data cache (lib/use-data.ts), so reopening
    // the console — or switching back to a period already viewed — is instant.
    // keepPreviousData keeps the old period on screen (dimmed) while a new one loads.
    const { data, isLoading, error: loadError, mutate } = useApi<CommandAnalytics>(
        enabled ? `/api/admin/analytics?days=${period}` : null,
        { keepPreviousData: true },
    )
    // `loading` dims the tabs / spins the refresh button: nothing cached for this
    // period yet, or Refresh was pressed. Quiet background refreshes don't dim.
    const loading = isLoading || reloading
    const error = loadError ? loadError.message || 'Could not load analytics' : ''

    // Refresh button — re-fetch the current period.
    async function reload() {
        setReloading(true)
        try { await mutate() } finally { setReloading(false) }
    }

    return (
        <AdminDataContext.Provider value={{ data: data ?? null, loading, error, period, setPeriod, reload }}>
            {children}
        </AdminDataContext.Provider>
    )
}

export function useAdminData() {
    const ctx = useContext(AdminDataContext)
    if (!ctx) throw new Error('useAdminData must be used inside AdminDataProvider')
    return ctx
}
