import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/app/api/_lib/auth'
import { isUuid } from '@/app/api/_lib/access'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
)

// All handlers act as the signed-in user (Bearer token) — never a userId from the client.

// GET /api/friendships
// Returns { friends: [...], pending_sent: [...], pending_received: [...] } for the caller
export async function GET(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error
    const userId = auth.user.id

    const { data, error } = await supabaseAdmin
        .from('friendships')
        .select(`
            id, status, requester_id, addressee_id,
            requester:users!friendships_requester_id_fkey(id, full_name, rank, wing),
            addressee:users!friendships_addressee_id_fkey(id, full_name, rank, wing)
        `)
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Include friendshipId so the client can call DELETE /api/friendships?id=<uuid>
    const friends = (data ?? [])
        .filter(r => r.status === 'accepted')
        .map(r => ({ ...(r.requester_id === userId ? r.addressee : r.requester), friendshipId: r.id }))

    const pendingSent = (data ?? [])
        .filter(r => r.status === 'pending' && r.requester_id === userId)
        .map(r => ({ ...r.addressee, friendshipId: r.id }))

    const pendingReceived = (data ?? [])
        .filter(r => r.status === 'pending' && r.addressee_id === userId)
        .map(r => ({ ...r.requester, friendshipId: r.id }))

    return NextResponse.json({ friends, pendingSent, pendingReceived })
}

// POST /api/friendships — send request
// Body: { addresseeId } — the requester is the caller
export async function POST(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error
    const requesterId = auth.user.id

    const { addresseeId } = await req.json().catch(() => ({}))
    // addresseeId goes into a PostgREST filter below, so it must be a real UUID
    if (!isUuid(addresseeId))
        return NextResponse.json({ error: 'valid addresseeId required' }, { status: 400 })
    if (addresseeId === requesterId)
        return NextResponse.json({ error: 'You cannot add yourself' }, { status: 400 })

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
// Only the *addressee* of a pending request can accept or reject it.
export async function PATCH(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const { friendshipId, action } = await req.json().catch(() => ({}))
    if (!friendshipId || !['accept', 'reject'].includes(action))
        return NextResponse.json({ error: 'friendshipId and action required' }, { status: 400 })

    const query = action === 'reject'
        ? supabaseAdmin.from('friendships').delete()
        : supabaseAdmin.from('friendships').update({ status: 'accepted' })
    const { data, error } = await query
        .eq('id', friendshipId)
        .eq('addressee_id', auth.user.id)
        .eq('status', 'pending')
        .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
}

// DELETE /api/friendships?id=<uuid> — unfriend or cancel a sent request.
// Either side of the friendship may delete it; nobody else can.
export async function DELETE(req: NextRequest) {
    const auth = await verifyAuth(req)
    if (auth.error) return auth.error

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const me = auth.user.id
    const { data, error } = await supabaseAdmin
        .from('friendships')
        .delete()
        .eq('id', id)
        .or(`requester_id.eq.${me},addressee_id.eq.${me}`)
        .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
}
