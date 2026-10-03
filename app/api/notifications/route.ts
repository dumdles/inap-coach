import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, guardCron } from '@/app/api/cron/_lib'
import { verifyAuth } from '@/app/api/_lib/auth'

// GET /api/notifications?limit=<n> — the caller's notifications (Bearer token)
export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '30', 10) || 30, 200)

    const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('id, type, title, body, read, created_at')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

// PATCH /api/notifications — mark all of the caller's notifications as read
export async function PATCH(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('user_id', auth.user.id)
        .eq('read', false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

// POST /api/notifications — create a notification for any user.
// Server-to-server only: requires `Authorization: Bearer <CRON_SECRET>`.
// (Route handlers inside the app should call insertNotif() from app/api/cron/_lib directly.)
export async function POST(req: NextRequest) {
    const denied = guardCron(req)
    if (denied) return denied

    const { userId, type, title, body } = await req.json().catch(() => ({}))
    if (!userId || !title) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

    const { error } = await supabaseAdmin
        .from('notifications')
        .insert({ user_id: userId, type: type ?? 'info', title, body: body ?? null, read: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
}
