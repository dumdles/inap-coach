import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/notifications?userId=<uuid>
export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('id, type, title, body, read, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}

// PATCH /api/notifications?userId=<uuid>  — mark all as read
export async function PATCH(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('user_id', userId)
        .eq('read', false)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

// POST /api/notifications  — create a notification (server-to-server)
export async function POST(req: NextRequest) {
    const { userId, type, title, body } = await req.json()
    if (!userId || !title) return NextResponse.json({ error: 'missing fields' }, { status: 400 })

    const { error } = await supabaseAdmin
        .from('notifications')
        .insert({ user_id: userId, type: type ?? 'info', title, body: body ?? null, read: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true }, { status: 201 })
}
