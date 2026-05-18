import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { fetchPolar } from '@/lib/polar'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/workout-logs/[id]?userId=<uuid>
// Returns the workout with tags and GPS track. GPX is served from the DB cache where
// available; if it's missing but has_route is true, it's fetched from Polar and cached.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data: log, error } = await supabaseAdmin
        .from('workout_logs')
        .select('*, exercise_templates(id, name, category, icon)')
        .eq('id', id)
        .single()

    if (error || !log) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Fetch tagged users
    const { data: tags } = await supabaseAdmin
        .from('workout_tags')
        .select('tagged_user_id, users(id, full_name, rank)')
        .eq('workout_log_id', id)

    // Resolve GPX: use cached value if present, otherwise fetch from Polar and cache it
    let gpx: string | null = log.gpx ?? null

    if (!gpx && log.source === 'polar' && log.polar_exercise_id && log.has_route) {
        try {
            const result = await fetchPolar(log.user_id, `/exercises/${log.polar_exercise_id}/gpx`)
            if (typeof result === 'string' && result) {
                gpx = result
                // Cache so future opens are instant
                await supabaseAdmin
                    .from('workout_logs')
                    .update({ gpx })
                    .eq('id', id)
            }
        } catch {
            // GPS unavailable — not fatal
        }
    }

    // For legacy rows (synced before has_route was tracked) attempt a one-time fetch
    // only when has_route is still false and we haven't stored gpx yet
    if (!gpx && log.source === 'polar' && log.polar_exercise_id && !log.has_route) {
        try {
            const detail = await fetchPolar(log.user_id, `/exercises/${log.polar_exercise_id}`)
            if (detail?.has_route) {
                // Update the cached flag so we don't re-check next time
                await supabaseAdmin
                    .from('workout_logs')
                    .update({ has_route: true })
                    .eq('id', id)

                const result = await fetchPolar(log.user_id, `/exercises/${log.polar_exercise_id}/gpx`)
                if (typeof result === 'string' && result) {
                    gpx = result
                    await supabaseAdmin
                        .from('workout_logs')
                        .update({ gpx })
                        .eq('id', id)
                }
            }
        } catch {
            // GPS unavailable — not fatal
        }
    }

    return NextResponse.json({
        ...log,
        tags: (tags ?? []).map(t => t.users),
        gpx,
    })
}
