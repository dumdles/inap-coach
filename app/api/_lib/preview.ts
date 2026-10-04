import type { NextRequest } from 'next/server'
import { PREVIEW_HEADERS, parsePreview, type RolePreview } from '@/lib/role-preview'

/**
 * The superadmin "View as" preview requested by this call (headers set by
 * authFetch), or null. This only *reads* the request — requireRole and
 * canViewUser decide whether to honour it (only for real superadmins).
 * See lib/role-preview.ts.
 */
export function readPreview(req: NextRequest): RolePreview | null {
    const role = req.headers.get(PREVIEW_HEADERS.role)
    if (!role) return null
    let wing = req.headers.get(PREVIEW_HEADERS.wing)
    try { wing = wing ? decodeURIComponent(wing) : null } catch { wing = null }
    return parsePreview(role, wing)
}
