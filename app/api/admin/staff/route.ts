import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { requireRole } from '@/app/api/_lib/roles'

// GET /api/admin/staff — superadmin-only list of instructors + superadmins
// for the Staff tab. Role changes go through PATCH /api/admin/role.
export async function GET(req: NextRequest) {
    const auth = await requireRole(req, ['superadmin'])
    if (auth.error) return auth.error

    const { data, error } = await supabaseAdmin
        .from('users')
        .select('id, full_name, rank, wing, role, email')
        .in('role', ['instructor', 'superadmin'])
        .order('wing', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
}
