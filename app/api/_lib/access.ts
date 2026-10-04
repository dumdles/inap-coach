import { supabaseAdmin } from '@/app/api/cron/_lib'
import { hasInstructorAccess, isSuperadmin } from '@/lib/roles'
import type { RolePreview } from '@/lib/role-preview'

// Shared authorisation rules for "can user A see user B's data?".
// Used by read routes that serve another cadet's logs (e.g. the instructor /
// friend view at app/dashboard/wing/cadet/[id]). Mirrors app/api/cadet:
//   • yourself — always
//   • superadmin — anyone
//   • verified instructor — cadets in the same wing
//   • accepted friend — each other
// Pass readPreview(req) so a superadmin using "View as" gets the previewed
// role's answer (lib/role-preview.ts); it's ignored for everyone else.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for a canonical UUID. Validate client-supplied ids before putting them in PostgREST .or() filters. */
export function isUuid(v: unknown): v is string {
    return typeof v === 'string' && UUID_RE.test(v)
}

export async function canViewUser(requesterId: string, targetId: string, preview: RolePreview | null = null): Promise<boolean> {
    if (requesterId === targetId) return true
    if (!isUuid(targetId)) return false

    const { data: users } = await supabaseAdmin.from('users').select('id, role, wing').in('id', [requesterId, targetId])
    const requester = users?.find(u => u.id === requesterId)
    const target = users?.find(u => u.id === targetId)
    if (!requester || !target) return false

    let { role, wing } = requester
    if (preview && isSuperadmin(role)) { role = preview.role; wing = preview.wing ?? wing }

    if (isSuperadmin(role)) return true
    if (hasInstructorAccess(role) && wing && wing === target.wing) return true

    const { data: friendship } = await supabaseAdmin
        .from('friendships')
        .select('id')
        .or(`and(requester_id.eq.${requesterId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${requesterId})`)
        .eq('status', 'accepted')
        .maybeSingle()
    return !!friendship
}
