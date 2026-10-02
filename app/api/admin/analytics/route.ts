import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'
import { buildCommandAnalytics, sgDate, type AUser, type ASummary, type AWorkout, type ASleep, type AIppt } from '@/lib/admin-analytics'

// GET /api/admin/analytics?days=7|28 — superadmin-only.
// Fetches the raw rows for the current + previous window and hands them to
// lib/admin-analytics.ts, which does all the maths. Powers every tab of the
// Admin console except Staff.

const PAGE = 1000 // PostgREST caps responses at 1000 rows, so page through

async function fetchAll<T>(table: string, columns: string, filter?: { col: string; gte: string }): Promise<T[]> {
    const rows: T[] = []
    for (let from = 0; ; from += PAGE) {
        let q = supabaseAdmin.from(table).select(columns)
        if (filter) q = q.gte(filter.col, filter.gte)
        const { data, error } = await q.range(from, from + PAGE - 1)
        if (error) throw new Error(`${table}: ${error.message}`)
        rows.push(...((data ?? []) as T[]))
        if (!data || data.length < PAGE) return rows
    }
}

export async function GET(req: NextRequest) {
    const auth = await requireRole(req, ['superadmin'])
    if (auth.error) return auth.error

    const days = req.nextUrl.searchParams.get('days') === '7' ? 7 : 28
    const today = sgDate(new Date())
    // Current + previous window, so every KPI can show a delta.
    const since = new Date(Date.now() - (days * 2 + 1) * 86400_000)
    const sinceDate = sgDate(since)

    try {
        const [users, summaries, workouts, sleeps, ippt] = await Promise.all([
            fetchAll<AUser>('users', 'id, full_name, rank, wing, platoon, section, role, goal_mode, weight_kg, ippt_date'),
            fetchAll<ASummary>('daily_summaries', 'user_id, date, total_calories, total_protein_g, calorie_target', { col: 'date', gte: sinceDate }),
            fetchAll<AWorkout>('workout_logs', 'user_id, logged_at, duration_min', { col: 'logged_at', gte: since.toISOString() }),
            fetchAll<ASleep>('sleep_logs', 'user_id, night_date, duration_min', { col: 'night_date', gte: sinceDate }),
            // All IPPT results — we need each cadet's latest, however old.
            fetchAll<AIppt>('ippt_results', 'user_id, test_date, total_points, award'),
        ])
        return NextResponse.json(buildCommandAnalytics({ days, today, users, summaries, workouts, sleeps, ippt }))
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
