import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/users/suggested — for the caller
// Returns users from same section (then wing) not yet connected
export async function GET(req: NextRequest) {
    // Caller comes from the Bearer token — never from a userId the client sends
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error
    const userId = auth.user.id

    const { data: me } = await supabaseAdmin
        .from('users')
        .select('section, wing')
        .eq('id', userId)
        .single()

    if (!me) return NextResponse.json([])

    // Get existing friendship user IDs
    const { data: friendships } = await supabaseAdmin
        .from('friendships')
        .select('requester_id, addressee_id')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    const connectedIds = new Set<string>([userId])
    for (const f of friendships ?? []) {
        connectedIds.add(f.requester_id)
        connectedIds.add(f.addressee_id)
    }

    // Prefer same section first, then same wing
    const { data: sameSection } = me.section
        ? await supabaseAdmin
            .from('users')
            .select('id, full_name, rank, wing, section')
            .eq('section', me.section)
            .neq('id', userId)
            .limit(10)
        : { data: [] }

    const sectionIds = new Set((sameSection ?? []).map((u: { id: string }) => u.id))

    let suggestions = (sameSection ?? []).filter((u: { id: string }) => !connectedIds.has(u.id))

    // Top up with wing-mates if needed
    if (suggestions.length < 8) {
        const { data: wingMates } = await supabaseAdmin
            .from('users')
            .select('id, full_name, rank, wing, section')
            .eq('wing', me.wing)
            .neq('id', userId)
            .limit(20)

        const extra = (wingMates ?? []).filter(
            (u: { id: string }) => !connectedIds.has(u.id) && !sectionIds.has(u.id),
        )
        suggestions = [...suggestions, ...extra].slice(0, 8)
    }

    return NextResponse.json(
        suggestions.map((u: { id: string; full_name: string; rank: string; wing: string; section: string }) => ({
            id: u.id,
            full_name: u.full_name,
            rank: u.rank,
            wing: u.wing,
            section: u.section,
            sameSection: u.section === me.section,
        })),
    )
}
