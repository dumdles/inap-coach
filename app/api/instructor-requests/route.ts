import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, insertNotif } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'
import { isInstructorRank } from '@/lib/scoring'
import { isSuperadmin } from '@/lib/roles'

// Instructor verification flow
// ────────────────────────────
// 1. A user whose rank is instructor-eligible (Settings → Profile) POSTs a
//    request with their appointment. Their role stays 'cadet' meanwhile.
// 2. Superadmins see pending requests in the Admin console (GET ?scope=pending)
//    and PATCH approve/reject. Approval sets users.role = 'instructor'.
// 3. The requester gets an in-app notification either way.

const APPOINTMENT_MIN = 3
const APPOINTMENT_MAX = 120

// GET /api/instructor-requests              → caller's latest request (or null)
// GET /api/instructor-requests?scope=pending → all pending (superadmin only)
export async function GET(req: NextRequest) {
    const auth = await requireRole(req)
    if (auth.error) return auth.error
    const { requester } = auth

    if (req.nextUrl.searchParams.get('scope') === 'pending') {
        if (!isSuperadmin(requester.role)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
        const { data, error } = await supabaseAdmin
            .from('instructor_requests')
            .select('id, rank, wing, appointment, created_at, user:users!instructor_requests_user_id_fkey(id, full_name, email)')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        return NextResponse.json(data ?? [])
    }

    const { data } = await supabaseAdmin
        .from('instructor_requests')
        .select('id, status, appointment, review_note, created_at, reviewed_at')
        .eq('user_id', requester.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
    return NextResponse.json({ role: requester.role, request: data ?? null })
}

// POST /api/instructor-requests  Body: { appointment: string }
export async function POST(req: NextRequest) {
    const auth = await requireRole(req, ['cadet'])
    if (auth.error) return auth.error
    const { requester } = auth

    const { appointment } = await req.json().catch(() => ({}))
    const trimmed = typeof appointment === 'string' ? appointment.trim() : ''
    if (trimmed.length < APPOINTMENT_MIN || trimmed.length > APPOINTMENT_MAX)
        return NextResponse.json({ error: `Appointment must be ${APPOINTMENT_MIN}–${APPOINTMENT_MAX} characters` }, { status: 400 })

    // Rank is read from the DB (what they saved in Settings), not the request body.
    if (!requester.rank || !isInstructorRank(requester.rank))
        return NextResponse.json({ error: 'Set an instructor rank in your profile first' }, { status: 400 })

    const { data, error } = await supabaseAdmin
        .from('instructor_requests')
        .insert({ user_id: requester.id, rank: requester.rank, wing: requester.wing, appointment: trimmed })
        .select('id, status, appointment, review_note, created_at, reviewed_at')
        .single()

    // 23505 = unique violation on the "one pending request per user" index
    if (error?.code === '23505') return NextResponse.json({ error: 'You already have a pending request' }, { status: 409 })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Let every superadmin know there's something to review.
    const { data: admins } = await supabaseAdmin.from('users').select('id').eq('role', 'superadmin')
    await Promise.all((admins ?? []).map(a =>
        insertNotif(a.id, 'instructor_request', 'New instructor request', `${requester.rank} · ${trimmed}`),
    ))

    return NextResponse.json(data, { status: 201 })
}

// PATCH /api/instructor-requests  Body: { requestId, decision: 'approve' | 'reject', note?: string }
export async function PATCH(req: NextRequest) {
    const auth = await requireRole(req, ['superadmin'])
    if (auth.error) return auth.error

    const { requestId, decision, note } = await req.json().catch(() => ({}))
    if (!requestId || !['approve', 'reject'].includes(decision))
        return NextResponse.json({ error: 'requestId and decision (approve|reject) required' }, { status: 400 })
    if (note != null && (typeof note !== 'string' || note.length > 280))
        return NextResponse.json({ error: 'Note must be at most 280 characters' }, { status: 400 })

    // Only flip requests that are still pending, so a double-click can't re-review.
    const { data: request, error } = await supabaseAdmin
        .from('instructor_requests')
        .update({
            status: decision === 'approve' ? 'approved' : 'rejected',
            reviewed_by: auth.requester.id,
            reviewed_at: new Date().toISOString(),
            review_note: note?.trim() || null,
        })
        .eq('id', requestId)
        .eq('status', 'pending')
        .select('user_id')
        .maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!request) return NextResponse.json({ error: 'Request not found or already reviewed' }, { status: 404 })

    if (decision === 'approve') {
        // Don't downgrade a superadmin who happened to also file a request.
        const { error: roleErr } = await supabaseAdmin
            .from('users').update({ role: 'instructor' }).eq('id', request.user_id).eq('role', 'cadet')
        if (roleErr) return NextResponse.json({ error: roleErr.message }, { status: 500 })
        await insertNotif(request.user_id, 'instructor_request', 'Instructor access approved', 'You now have access to My Wing.')
    } else {
        await insertNotif(request.user_id, 'instructor_request', 'Instructor request not approved', note?.trim() || null)
    }

    return NextResponse.json({ ok: true })
}
