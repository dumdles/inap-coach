// ── Role preview ("View as") ──────────────────────────────────────────────────
// Lets a superadmin see FitRep the way a cadet or an instructor of a chosen
// wing sees it — nav, pages, buttons AND what the APIs return — without
// switching accounts. The superadmin's own logs still show (it's their
// account); only the role and wing are swapped.
//
// How it works:
//   • The choice lives in the browser tab (lib/use-role-preview.ts, sessionStorage).
//   • authFetch (lib/auth-fetch.ts) sends it as two headers on every /api call.
//   • requireRole / canViewUser (app/api/_lib) apply it — but ONLY when the
//     signed-in user really is a superadmin, and only to *lower* access
//     (cadet / instructor). A cadet sending these headers gets nothing.
//   • Client screens that read users.role directly pass the profile through
//     applyPreview() so they match what the server does.
//   • While previewing, role-gated API writes (create a challenge, approve
//     requests…) are refused, so a preview can't change anything as someone else.
//
// Pure module: safe to import from both client and server code.

export const PREVIEW_ROLES = ['cadet', 'instructor'] as const
export type PreviewRole = (typeof PREVIEW_ROLES)[number]

/** What the superadmin is previewing. `wing: null` = keep their own wing. */
export type RolePreview = { role: PreviewRole; wing: string | null }

export const PREVIEW_HEADERS = { role: 'x-preview-role', wing: 'x-preview-wing' } as const

export const PREVIEW_ROLE_LABEL: Record<PreviewRole, string> = { cadet: 'Cadet', instructor: 'Instructor' }

/** Validates raw values (from headers or storage); anything unexpected → no preview. */
export function parsePreview(role: unknown, wing: unknown): RolePreview | null {
    if (!PREVIEW_ROLES.includes(role as PreviewRole)) return null
    const w = typeof wing === 'string' ? wing.trim().slice(0, 64) : ''
    return { role: role as PreviewRole, wing: w || null }
}

/**
 * The profile as the previewed role would see it. No-op unless the profile's
 * real role is superadmin (so a stale preview can never affect anyone else).
 */
export function applyPreview<T extends { role?: string | null; wing?: string | null }>(profile: T, preview: RolePreview | null): T
export function applyPreview<T extends { role?: string | null; wing?: string | null }>(profile: T | null | undefined, preview: RolePreview | null): T | null
export function applyPreview<T extends { role?: string | null; wing?: string | null }>(profile: T | null | undefined, preview: RolePreview | null): T | null {
    if (!profile) return null
    if (!preview || profile.role !== 'superadmin') return profile
    return { ...profile, role: preview.role, wing: preview.wing ?? profile.wing ?? null }
}
