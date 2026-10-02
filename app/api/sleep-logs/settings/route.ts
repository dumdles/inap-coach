import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'
import { supabaseAdmin } from '@/app/api/cron/_lib'

// GET /api/sleep-logs/settings — the caller's sleep targets
export async function GET(req: NextRequest) {
    // Caller comes from the Bearer token — never from a userId the client sends
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error
    const userId = auth.user.id

    const { data } = await supabaseAdmin
        .from('user_sleep_settings')
        .select('target_hours, target_bedtime, target_wake_time')
        .eq('user_id', userId)
        .maybeSingle()

    return NextResponse.json(data ?? { target_hours: 7.5, target_bedtime: null, target_wake_time: null })
}

// PATCH /api/sleep-logs/settings  Body: { target_hours?, target_bedtime?, target_wake_time? }
export async function PATCH(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error
    const userId = auth.user.id

    const body = await req.json().catch(() => ({}))
    const { target_hours, target_bedtime, target_wake_time } = body

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
