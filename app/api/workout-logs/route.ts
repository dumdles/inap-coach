import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/workout-logs?userId=<uuid>&category=<str>
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const userId = searchParams.get('userId')
    const category = searchParams.get('category')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    let query = supabaseAdmin
        .from('workout_logs')
        .select('id, template_id, source, name, duration_min, calories, distance_km, sets, reps, rounds, heart_rate_avg, notes, logged_at, polar_exercise_id, exercise_templates(id, name, category, icon)')
        .eq('user_id', userId)
        .order('logged_at', { ascending: false })
        .limit(50)

    if (category && category !== 'all') {
        query = query.eq('exercise_templates.category', category)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Filter by category in JS since Supabase join filters don't exclude rows
    const filtered = category && category !== 'all'
        ? (data ?? []).filter((l: Record<string, unknown>) => {
            const t = l.exercise_templates as { category?: string } | null
            return t?.category === category
        })
        : (data ?? [])

    return NextResponse.json(filtered)
}

// POST /api/workout-logs
export async function POST(req: NextRequest) {
    const body = await req.json()
    const {
        userId, templateId, source, name,
        duration_min, calories, distance_km, sets, reps, rounds,
        heart_rate_avg, notes, polar_exercise_id, logged_at,
        taggedUserIds,   // string[] — friends to tag
        taggerName,      // display name of the person logging (for notification body)
    } = body
    if (!userId || !name) return NextResponse.json({ error: 'userId and name required' }, { status: 400 })

    const payload: Record<string, unknown> = {
        user_id: userId,
        template_id: templateId ?? null,
        source: source ?? 'manual',
        name,
        duration_min: duration_min ?? null,
        calories: calories ?? null,
        distance_km: distance_km ?? null,
        sets: sets ?? null,
        reps: reps ?? null,
        rounds: rounds ?? null,
        heart_rate_avg: heart_rate_avg ?? null,
        notes: notes ?? null,
        polar_exercise_id: polar_exercise_id ?? null,
        logged_at: logged_at ?? new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin
        .from('workout_logs')
        .insert(payload)
        .select('id')
        .single()

    if (error) {
        // Ignore unique violation for Polar duplicates
        if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const logId = data.id

    // Insert tags and fire notifications
    if (Array.isArray(taggedUserIds) && taggedUserIds.length > 0) {
        await supabaseAdmin.from('workout_tags').insert(
            taggedUserIds.map((uid: string) => ({ workout_log_id: logId, tagged_user_id: uid }))
        )
        await supabaseAdmin.from('notifications').insert(
            taggedUserIds.map((uid: string) => ({
                user_id: uid,
                type: 'workout_tag',
                title: 'You were tagged in a workout',
                body: `${taggerName ?? 'Someone'} tagged you in a ${name} session.`,
            }))
        )
    }

    return NextResponse.json({ ok: true, id: logId })
}

// PATCH /api/workout-logs?id=<uuid>
export async function PATCH(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { duration_min, calories, distance_km, sets, reps, rounds, heart_rate_avg, notes } = await req.json()

    const { error } = await supabaseAdmin
        .from('workout_logs')
        .update({ duration_min, calories, distance_km, sets, reps, rounds, heart_rate_avg, notes })
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

// DELETE /api/workout-logs?id=<uuid>
export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await supabaseAdmin.from('workout_logs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
