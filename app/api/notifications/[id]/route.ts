import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// PATCH /api/notifications/:id — mark single notification as read
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const { error } = await supabaseAdmin
        .from('notifications')
        .update({ read: true })
        .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
