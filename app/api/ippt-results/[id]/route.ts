import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// DELETE /api/ippt-results/<id> — delete one of the caller's own results
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    // Caller comes from the Bearer token — never from a userId the client sends
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error
    const userId = auth.user.id

    const { error } = await supabaseAdmin
        .from('ippt_results')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)  // ownership check

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
