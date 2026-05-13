import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// GET /api/friendships?userId=<uuid>
// Returns { friends: [...], pending_sent: [...], pending_received: [...] }
export async function GET(req: NextRequest) {
    const userId = req.nextUrl.searchParams.get('userId')
    if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
        .from('friendships')
        .select(`
            id, status, requester_id, addressee_id,
            requester:users!friendships_requester_id_fkey(id, full_name, rank, wing),
            addressee:users!friendships_addressee_id_fkey(id, full_name, rank, wing)
        `)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const friends = (data ?? [])
        .filter(r => r.status === 'accepted')
        .map(r => (r.requester_id === userId ? r.addressee : r.requester))

    const pendingSent = (data ?? [])
        .filter(r => r.status === 'pending' && r.requester_id === userId)
        .map(r => ({ ...r.addressee, friendshipId: r.id }))

    const pendingReceived = (data ?? [])
        .filter(r => r.status === 'pending' && r.addressee_id === userId)
        .map(r => ({ ...r.requester, friendshipId: r.id }))

    return NextResponse.json({ friends, pendingSent, pendingReceived })
}

// POST /api/friendships — send request
// Body: { requesterId, addresseeId }
export async function POST(req: NextRequest) {
    const { requesterId, addresseeId } = await req.json()
    if (!requesterId || !addresseeId)
        return NextResponse.json({ error: 'requesterId and addresseeId required' }, { status: 400 })

    // Check for existing relationship in either direction
    const { data: existing } = await supabaseAdmin
        .from('friendships')
        .select('id, status')
        .or(
            `and(requester_id.eq.${requesterId},addressee_id.eq.${addresseeId}),` +
            `and(requester_id.eq.${addresseeId},addressee_id.eq.${requesterId})`,
        )
        .maybeSingle()

    if (existing) {
        if (existing.status === 'accepted')
            return NextResponse.json({ error: 'Already friends' }, { status: 409 })
        return NextResponse.json({ error: 'Request already pending' }, { status: 409 })
    }

    const { data, error } = await supabaseAdmin
        .from('friendships')
        .insert({ requester_id: requesterId, addressee_id: addresseeId, status: 'pending' })
        .select('id')
        .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
}

// PATCH /api/friendships — accept or reject
// Body: { friendshipId, action: 'accept' | 'reject' }
export async function PATCH(req: NextRequest) {
    const { friendshipId, action } = await req.json()
    if (!friendshipId || !['accept', 'reject'].includes(action))
        return NextResponse.json({ error: 'friendshipId and action required' }, { status: 400 })

    if (action === 'reject') {
        const { error } = await supabaseAdmin
            .from('friendships')
            .delete()
            .eq('id', friendshipId)
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json({ ok: true })
    }

    const { error } = await supabaseAdmin
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}

// DELETE /api/friendships?id=<uuid> — unfriend
export async function DELETE(req: NextRequest) {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const { error } = await supabaseAdmin.from('friendships').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
}
