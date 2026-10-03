import { supabaseAdmin } from '@/app/api/cron/_lib'
import { hasInstructorAccess, isSuperadmin } from '@/lib/roles'

// Shared authorisation rules for "can user A see user B's data?".
// Used by read routes that serve another cadet's logs (e.g. the instructor /
// friend view at app/dashboard/wing/cadet/[id]). Mirrors app/api/cadet:
//   • yourself — always
//   • superadmin — anyone
//   • verified instructor — cadets in the same wing
//   • accepted friend — each other

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a canonical UUID. Validate client-supplied ids before putting them in PostgREST .or() filters. */
export function isUuid(v: unknown): v is string {
    return typeof v === 'string' && UUID_RE.test(v)
}

export async function canViewUser(requesterId: string, targetId: string): Promise<boolean> {
    if (requesterId === targetId) return true
    if (!isUuid(targetId)) return false

    const { data: users } = await supabaseAdmin.from('users').select('id, role, wing').in('id', [requesterId, targetId])
    const requester = users?.find(u => u.id === requesterId)
    const target = users?.find(u => u.id === targetId)
    if (!requester || !target) return false

    if (isSuperadmin(requester.role)) return true
    if (hasInstructorAccess(requester.role) && requester.wing && requester.wing === target.wing) return true

    const { data: friendship } = await supabaseAdmin
        .from('friendships')
        .select('id')
        .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${requesterId})`)
        .eq('status', 'accepted')
        .maybeSingle()
    return !!friendship
}
