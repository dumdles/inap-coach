import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'

// GET /api/admin/overview — superadmin-only, app-wide snapshot for the Admin console.
// Aggregates the last 7 days of logging per wing so Comd OCS can see at a glance
// which wings are engaged. Individual cadet drill-down reuses /dashboard/wing/cadet/[id]
// (superadmins pass the wing check in /api/cadet).

const DAYS = 7
const PAGE = 1000 // PostgREST caps responses at 1000 rows, so page through bigger tables

async function fetchAll<T>(table: string, columns: string, sinceIso: string): Promise<T[]> {
    const rows: T[] = []
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabaseAdmin
            .from(table).select(columns).gte('logged_at', sinceIso).range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        rows.push(...((data ?? []) as T[]))
        if (!data || data.length < PAGE) return rows
    }
}

type UserRow = { id: string; full_name: string | null; rank: string | null; wing: string | null; role: string }
type LogRow = { user_id: string }

export async function GET(req: NextRequest) {
    const auth = await requireRole(req, ['superadmin'])
    if (auth.error) return auth.error

    const since = new Date(Date.now() - DAYS * 86400_000).toISOString()

    try {
        const [users, meals, workouts, { count: pendingRequests }] = await Promise.all([
            (async () => {
                const all: UserRow[] = []
                for (let from = 0; ; from += PAGE) {
                    const { data, error } = await supabaseAdmin
                        .from('users').select('id, full_name, rank, wing, role').range(from, from + PAGE - 1)
                    if (error) throw new Error(error.message)
                    all.push(...((data ?? []) as UserRow[]))
                    if (!data || data.length < PAGE) return all
                }
            })(),
            fetchAll<LogRow>('meal_logs', 'user_id', since),
            fetchAll<LogRow>('workout_logs', 'user_id', since),
            supabaseAdmin.from('instructor_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        ])

        // Count logs per user so we can roll them up by wing.
        const mealsBy: Record<string, number> = {}
        const workoutsBy: Record<string, number> = {}
        for (const m of meals) mealsBy[m.user_id] = (mealsBy[m.user_id] ?? 0) + 1
        for (const w of workouts) workoutsBy[w.user_id] = (workoutsBy[w.user_id] ?? 0) + 1

        const cadets = users.filter(u => u.role === 'cadet')
        const wingMap: Record<string, { wing: string; cadets: number; active: number; meals: number; workouts: number; instructors: number }> = {}
        const wingOf = (u: UserRow) => {
            const key = u.wing ?? 'Unassigned'
            return (wingMap[key] ??= { wing: key, cadets: 0, active: 0, meals: 0, workouts: 0, instructors: 0 })
        }
        for (const u of users) if (u.role === 'instructor') wingOf(u).instructors++
        for (const u of cadets) {
            const w = wingOf(u)
            const m = mealsBy[u.id] ?? 0
            const wo = workoutsBy[u.id] ?? 0
            w.cadets++
            w.meals += m
            w.workouts += wo
            if (m + wo > 0) w.active++ // "active" = logged anything in the window
        }

        const wings = Object.values(wingMap)
            .map(w => ({
                ...w,
                activePct: w.cadets ? Math.round((w.active / w.cadets) * 100) : 0,
                mealsPerCadetDay: w.cadets ? +(w.meals / w.cadets / DAYS).toFixed(1) : 0,
                workoutsPerCadet: w.cadets ? +(w.workouts / w.cadets).toFixed(1) : 0,
            }))
            .sort((a, b) => b.activePct - a.activePct)

        const activeCadets = cadets.filter(u => (mealsBy[u.id] ?? 0) + (workoutsBy[u.id] ?? 0) > 0).length

        return NextResponse.json({
            windowDays: DAYS,
            totals: {
                cadets: cadets.length,
                instructors: users.filter(u => u.role === 'instructor').length,
                superadmins: users.filter(u => u.role === 'superadmin').length,
                activeCadets,
                activePct: cadets.length ? Math.round((activeCadets / cadets.length) * 100) : 0,
                meals: meals.length,
                workouts: workouts.length,
                pendingRequests: pendingRequests ?? 0,
            },
            wings,
            staff: users
                .filter(u => u.role !== 'cadet')
                .map(({ id, full_name, rank, wing, role }) => ({ id, full_name, rank, wing, role })),
        })
    } catch (e) {
        return NextResponse.json({ error: (e as Error).message }, { status: 500 })
    }
}
