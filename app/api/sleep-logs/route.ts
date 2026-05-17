import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'

// GET /api/sleep-logs?userId=<uuid>&limit=<n>
export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') ?? '60', 10)
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
        .from('sleep_logs')
        .select('id, source, night_date, sleep_start, sleep_end, duration_min, sleep_score, ans_charge_status, deep_min, rem_min, light_min, awake_min, heart_rate_avg, hrv_avg, rating, notes, polar_date, created_at')
        .eq('user_id', userId)
        .order('night_date', { ascending: false })
        .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

type SleepLogPayload = {
    userId: string
    source?: 'manual' | 'polar' | 'apple_health'
    night_date?: string
    sleep_start: string
    sleep_end: string
    duration_min?: number
    sleep_score?: number | null
    ans_charge_status?: number | null
    deep_min?: number | null
    rem_min?: number | null
    light_min?: number | null
    awake_min?: number | null
    heart_rate_avg?: number | null
    hrv_avg?: number | null
    rating?: number | null
    notes?: string | null
    polar_date?: string | null
}

// POST /api/sleep-logs
export async function POST(req: NextRequest) {
    const body = (await req.json()) as SleepLogPayload
    const { userId, sleep_start, sleep_end } = body
    if (!userId || !sleep_start || !sleep_end) {
        return NextResponse.json({ error: 'userId, sleep_start, sleep_end required' }, { status: 400 })
    }

    const start = new Date(sleep_start)
    const end = new Date(sleep_end)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) {
        return NextResponse.json({ error: 'Invalid sleep_start / sleep_end' }, { status: 400 })
    }

    const durationMin = body.duration_min ?? Math.round((end.getTime() - start.getTime()) / 60000)
    const nightDate = body.night_date ?? end.toISOString().slice(0, 10)

    const payload = {
        user_id: userId,
        source: body.source ?? 'manual',
        night_date: nightDate,
        sleep_start: start.toISOString(),
        sleep_end: end.toISOString(),
        duration_min: durationMin,
        sleep_score: body.sleep_score ?? null,
        ans_charge_status: body.ans_charge_status ?? null,
        deep_min: body.deep_min ?? null,
        rem_min: body.rem_min ?? null,
        light_min: body.light_min ?? null,
        awake_min: body.awake_min ?? null,
        heart_rate_avg: body.heart_rate_avg ?? null,
        hrv_avg: body.hrv_avg ?? null,
        rating: body.rating ?? null,
        notes: body.notes ?? null,
        polar_date: body.polar_date ?? null,
    }

    // Upsert on (user_id, night_date) so re-syncs and re-entries update the
    // existing row rather than failing on the unique constraint.
    const { data, error } = await supabaseAdmin
        .from('sleep_logs')
        .upsert(payload, { onConflict: 'user_id,night_date' })
        .select('id')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id })
}

// PATCH /api/sleep-logs?id=<uuid>
export async function PATCH(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await req.json()
    const allowed = [
        'sleep_start', 'sleep_end', 'duration_min', 'sleep_score', 'ans_charge_status',
        'deep_min', 'rem_min', 'light_min', 'awake_min', 'heart_rate_avg', 'hrv_avg',
        'rating', 'notes',
    ] as const
    const patch: Record<string, unknown> = {}
    for (const k of allowed) if (k in body) patch[k] = body[k]

    if (patch.sleep_start && patch.sleep_end) {
        const start = new Date(patch.sleep_start as string)
        const end = new Date(patch.sleep_end as string)
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start && !patch.duration_min) {
            patch.duration_min = Math.round((end.getTime() - start.getTime()) / 60000)
        }
    }

    const { error } = await supabaseAdmin.from('sleep_logs').update(patch).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

// DELETE /api/sleep-logs?id=<uuid>
export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const { error } = await supabaseAdmin.from('sleep_logs').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
