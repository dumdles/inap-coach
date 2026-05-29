import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { isInstructor } from '@/lib/scoring'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// PATCH /api/cadet-admin
// Body: { requesterId, cadetId, action: 'remove_section' | 'assign_section' | 'transfer_wing', newSection?: string, newWing?: string }
// Instructor-only. remove_section clears section; assign_section sets section to 1–4; transfer_wing moves cadet to another wing.
export async function PATCH(req: NextRequest) {
    const { requesterId, cadetId, action, newWing, newSection } = await req.json()

    if (!requesterId || !cadetId || !['remove_section', 'assign_section', 'transfer_wing'].includes(action))
        return NextResponse.json({ error: 'requesterId, cadetId, and valid action required' }, { status: 400 })

    if (action === 'transfer_wing' && !newWing)
        return NextResponse.json({ error: 'newWing required for transfer_wing' }, { status: 400 })

    if (action === 'assign_section' && !['1', '2', '3', '4'].includes(newSection))
        return NextResponse.json({ error: 'newSection must be 1–4' }, { status: 400 })

    const [{ data: requester }, { data: cadet }] = await Promise.all([
        supabaseAdmin.from('users').select('rank, wing').eq('id', requesterId).single(),
        supabaseAdmin.from('users').select('wing').eq('id', cadetId).single(),
    ])

    if (!requester || !cadet) return NextResponse.json({ error: 'not found' }, { status: 404 })
    if (!isInstructor(requester.rank) || requester.wing !== cadet.wing)
        return NextResponse.json({ error: 'forbidden' }, { status: 403 })

    const update =
        action === 'remove_section'  ? { section: null } :
        action === 'assign_section'  ? { section: newSection } :
        /* transfer_wing */            { wing: newWing, section: null } // clear section when transferring wings

    const { error } = await supabaseAdmin
        .from('users')
        .update(update)
        .eq('id', cadetId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
