import { supabase } from '@/lib/supabase'

/**
 * fetch() for our own /api routes with the signed-in user's Bearer token attached.
 *
 * Every user-data API route identifies the caller from this token (verifyAuth /
 * requireRole in app/api/_lib) — never from a userId in the URL or body — so
 * client code should call authFetch instead of plain fetch for /api/*.
 * Works with any body type (JSON string, FormData…); it only adds the header.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession()
    const headers = new Headers(init.headers)
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
    return fetch(input, { ...init, headers })
}
