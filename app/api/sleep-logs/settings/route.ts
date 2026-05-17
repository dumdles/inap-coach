import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'

// GET /api/sleep-logs/settings?userId=<uuid>
export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data } = await supabaseAdmin
        .from('user_sleep_settings')
        .select('target_hours, target_bedtime, target_wake_time')
        .eq('user_id', userId)
        .maybeSingle()

    return NextResponse.json(data ?? { target_hours: 7.5, target_bedtime: null, target_wake_time: null })
}

// PATCH /api/sleep-logs/settings
export async function PATCH(req: NextRequest) {
    const body = await req.json()
    const { userId, target_hours, target_bedtime, target_wake_time } = body
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const payload = {
        user_id: userId,
        target_hours: target_hours ?? 7.5,
        target_bedtime: target_bedtime ?? null,
        target_wake_time: target_wake_time ?? null,
        updated_at: new Date().toISOString(),
    }

    const { error } = await supabaseAdmin
        .from('user_sleep_settings')
        .upsert(payload, { onConflict: 'user_id' })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
