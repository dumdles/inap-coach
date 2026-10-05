import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { verifyAuth } from '@/app/api/_lib/auth'
import { isSuperadmin, type Role } from '@/lib/roles'
import { readPreview } from '@/app/api/_lib/preview'

export type Requester = { id: string; role: Role; wing: string | null; rank: string | null; platoon: string | null; section: string | null }

type Ok = { requester: Requester; error?: never }
type Fail = { requester?: never; error: NextResponse }

/**
 * Verifies the Bearer token and loads the caller's role + wing/platoon/section
 * from `users` (one query — routes can reuse these instead of re-fetching).
 * Pass `allowed` to restrict the route to certain roles (403 otherwise).
 *
 * Always use this instead of trusting a userId/requesterId sent by the client —
 * the role must come from the verified session, never from the request body.
 *
 * Superadmin "View as" (lib/role-preview.ts): when a real superadmin sends the
 * preview headers, the returned requester carries the previewed role/wing, so
 * the route behaves exactly as for that role. Previews only ever lower access,
 * and role-gated writes are refused while previewing.
 *
 *   const auth = await requireRole(req, ['superadmin'])
 *   if (auth.error) return auth.error
 */
export async function requireRole(req: NextRequest, allowed?: Role[]): Promise<Ok | Fail> {
    const auth = await verifyAuth(req)
    if (auth.error) return { error: auth.error }

    const { data } = await supabaseAdmin
        .from('users')
        .select('id, role, wing, rank, platoon, section')
        .eq('id', auth.user.id)
        .single()
    if (!data) return { error: NextResponse.json({ error: 'profile not found' }, { status: 404 }) }

    let requester = data as Requester
    const preview = readPreview(req)
    const previewing = !!preview && isSuperadmin(requester.role)
    if (previewing) requester = { ...requester, role: preview.role, wing: preview.wing ?? requester.wing }

    if (allowed && !allowed.includes(requester.role))
        return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }

    // A preview is for looking, not acting as someone else.
    if (previewing && req.method !== 'GET' && req.method !== 'HEAD')
        return { error: NextResponse.json({ error: `You're viewing as ${preview.role === 'cadet' ? 'a cadet' : 'an instructor'} — exit the preview to make changes.` }, { status: 403 }) }

    return { requester }
}
