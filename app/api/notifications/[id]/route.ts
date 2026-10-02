import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { verifyAuth } from '@/app/api/_lib/auth'

// PATCH /api/notifications/:id — mark one of the caller's notifications as read
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const { id } = await params
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('id', id)
        .eq('user_id', auth.user.id) // can only touch your own notifications

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
