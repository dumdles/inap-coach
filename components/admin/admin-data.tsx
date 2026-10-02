'use client'

// Shared state for the Admin console tabs. The layout (app/dashboard/admin/layout.tsx)
// fetches /api/admin/analytics once per period and every tab reads it from here,
// so switching between Overview / Wings / Watchlist is instant.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
    const [data, setData] = useState<CommandAnalytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const reload = useCallback(async () => {
        setLoading(true)
        const res = await fetch(`/api/admin/analytics?days=${period}`, { headers: await adminHeaders() })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) setError(json.error ?? 'Could not load analytics')
        else { setData(json); setError('') }
        setLoading(false)
    }, [period])

    useEffect(() => { if (enabled) queueMicrotask(() => { void reload() }) }, [enabled, reload])

    return (
        <AdminDataContext.Provider value={{ data, loading, error, period, setPeriod, reload }}>
            {children}
        </AdminDataContext.Provider>
    )
}

export function useAdminData() {
    const ctx = useContext(AdminDataContext)
    if (!ctx) throw new Error('useAdminData must be used inside AdminDataProvider')
    return ctx
}
