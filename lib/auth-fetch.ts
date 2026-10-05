import { supabase } from '@/lib/supabase'
import { PREVIEW_HEADERS } from '@/lib/role-preview'
import { getRolePreview } from '@/lib/use-role-preview'

/**
 * fetch() for our own /api routes with the signed-in user's Bearer token attached.
 *
 * Every user-data API route identifies the caller from this token (verifyAuth /
 * requireRole in app/api/_lib) — never from a userId in the URL or body — so
 * client code should call authFetch instead of plain fetch for /api/*.
 * Works with any body type (JSON string, FormData…); it only adds headers.
 * While a superadmin is using "View as" (lib/role-preview.ts) it also sends the
 * previewed role/wing; the server ignores them for everyone else.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const { data: { session } } = await supabase.auth.getSession()
    const headers = new Headers(init.headers)
    if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`)
    const preview = getRolePreview()
    if (preview) {
        headers.set(PREVIEW_HEADERS.role, preview.role)
        // Header values must be plain ASCII, so the wing name is URI-encoded.
        if (preview.wing) headers.set(PREVIEW_HEADERS.wing, encodeURIComponent(preview.wing))
    }
    return fetch(input, { ...init, headers })
}
