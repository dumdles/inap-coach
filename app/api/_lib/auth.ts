import { supabaseAdmin } from '@/app/api/cron/_lib'
import { NextRequest, NextResponse } from 'next/server'
import { User } from '@supabase/supabase-js'

type AuthSuccess = { user: User; error?: never }
type AuthFailure = { user?: never; error: NextResponse }

/**
 * Verifies the Bearer token in the Authorization header against Supabase.
 * Returns { user } on success, or { error: NextResponse } with 401 on failure.
 *
 * Usage:
 *   const auth = await verifyAuth(req)
 *   if (auth.error) return auth.error
 *   // auth.user is now the verified Supabase user
 */
export async function verifyAuth(req: NextRequest): Promise<AuthSuccess | AuthFailure> {
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
    if (!token) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

    return { user }
}
