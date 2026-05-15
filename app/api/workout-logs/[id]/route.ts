import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { fetchPolar } from '@/lib/polar'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/workout-logs/[id]?userId=<uuid>
// Returns the workout log with tagged users and optionally GPS data from Polar.
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

    // Attempt to fetch GPS from Polar if this is a Polar exercise with a route
    let gpxData: string | null = null
    if (log.polar_exercise_id && log.source === 'polar') {
        try {
            const exerciseDetail = await fetchPolar(log.user_id, `/exercises/${log.polar_exercise_id}`)
            if (exerciseDetail?.has_route) {
                const gpx = await fetchPolar(log.user_id, `/exercises/${log.polar_exercise_id}/gpx`)
                gpxData = typeof gpx === 'string' ? gpx : null
            }
        } catch {
            // GPS not available — not a fatal error
        }
    }

    return NextResponse.json({
        ...log,
        tags: (tags ?? []).map(t => t.users),
        gpx: gpxData,
    })
}
