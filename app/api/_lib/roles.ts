import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/api/cron/_lib'
import { verifyAuth } from '@/app/api/_lib/auth'
import type { Role } from '@/lib/roles'

export type Requester = { id: string; role: Role; wing: string | null; rank: string | null }

type Ok = { requester: Requester; error?: never }
type Fail = { requester?: never; error: NextResponse }

/**
 * Verifies the Bearer token and loads the caller's role + wing from `users`.
 * Pass `allowed` to restrict the route to certain roles (403 otherwise).
 *
 * Always use this instead of trusting a userId/requesterId sent by the client —
 * the role must come from the verified session, never from the request body.
 *
 *   const auth = await requireRole(req, ['superadmin'])
 *   if (auth.error) return auth.error
 */
export async function requireRole(req: NextRequest, allowed?: Role[]): Promise<Ok | Fail> {
    const auth = await verifyAuth(req)
    if (auth.error) return { error: auth.error }

    const { data } = await supabaseAdmin
        .from('users')
        .select('id, role, wing, rank')
        .eq('id', auth.user.id)
        .single()
    if (!data) return { error: NextResponse.json({ error: 'profile not found' }, { status: 404 }) }

    const requester = data as Requester
    if (allowed && !allowed.includes(requester.role))
        return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) }

    return { requester }
}
