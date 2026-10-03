import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin, insertNotif } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'

// PATCH /api/admin/role  Body: { userId, role: 'cadet' | 'instructor' }
// Superadmin-only: revoke or grant instructor access directly (e.g. cleaning up
// accounts backfilled by docs/roles_migration.sql). Superadmin itself is only
// granted via SQL, so nobody can escalate to it through the app.
export async function PATCH(req: NextRequest) {
    const auth = await requireRole(req, ['superadmin'])
    if (auth.error) return auth.error

    const { userId, role } = await req.json().catch(() => ({}))
    if (!userId || !['cadet', 'instructor'].includes(role))
        return NextResponse.json({ error: 'userId and role (cadet|instructor) required' }, { status: 400 })
    if (userId === auth.requester.id)
        return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })

    // .neq('role','superadmin') — superadmins can't demote each other from the UI.
    const { data, error } = await supabaseAdmin
        .from('users').update({ role }).eq('id', userId).neq('role', 'superadmin').select('id').maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    await insertNotif(userId, 'instructor_request',
        role === 'instructor' ? 'Instructor access granted' : 'Instructor access removed', null)
    return NextResponse.json({ ok: true })
}
