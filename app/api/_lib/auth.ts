import { supabaseAdmin } from '@/app/api/cron/_lib'
import { NextRequest, NextResponse } from 'next/server'

/** The verified caller. Routes only need the id — everything else comes from `users`. */
export type AuthUser = { id: string; email?: string }

type AuthSuccess = { user: AuthUser; error?: never }
type AuthFailure = { user?: never; error: NextResponse }

/**
 * Verifies the Bearer token in the Authorization header.
 * Returns { user } on success, or { error: NextResponse } with 401 on failure.
 *
 * Uses getClaims(), which checks the JWT's signature locally against the
 * project's public signing keys (fetched once, then cached) — no round trip to
 * Supabase Auth on every request, which used to add ~1 network hop to every
 * API call. If the project still signs tokens with the legacy shared secret
 * (HS256), supabase-js falls back to asking the Auth server, as before.
 * Trade-off: a token stays valid until it expires (≤1h) even after sign-out.
 *
 * Usage:
 *   const auth = await verifyAuth(req)
 *   if (auth.error) return auth.error
 *   // auth.user.id is now the verified Supabase user id
 */
export async function verifyAuth(req: NextRequest): Promise<AuthSuccess | AuthFailure> {
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '')
    if (!token) return unauthorized()

    // getClaims returns { error } for a bad signature, but *throws* plain Errors
    // for an expired or malformed token — treat both the same way (401).
    let result: Awaited<ReturnType<typeof supabaseAdmin.auth.getClaims>>
    try {
        result = await supabaseAdmin.auth.getClaims(token)
    } catch {
        return unauthorized()
    }
    const { data, error } = result
    const claims = data?.claims
    // role must be 'authenticated' — rejects anon-key tokens, which are validly signed but have no user.
    if (error || !claims?.sub || claims.role !== 'authenticated') return unauthorized()

    return { user: { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined } }
}

function unauthorized(): AuthFailure {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}
