// ── Roles ────────────────────────────────────────────────────────────────────
// A user's *role* decides what they can access. It lives in `users.role` and
// can only be changed server-side (service role key) — see
// docs/roles_migration.sql for the trigger that enforces this.
//
//   cadet       → default for everyone at sign-up
//   instructor  → granted only after a superadmin approves an instructor
//                 request (app/api/instructor-requests). Sees "My Wing".
//   superadmin  → app owner / Comd OCS. Sees every wing + the Admin console
//                 (app/dashboard/admin) and approves instructor requests.
//
// Rank is still self-declared and is used only to decide whether someone is
// *eligible* to request instructor access (see INSTRUCTOR_RANKS in
// lib/scoring.ts). Rank alone never grants access.

export const ROLES = ['cadet', 'instructor', 'superadmin'] as const
export type Role = (typeof ROLES)[number]

/** Instructors and superadmins both get instructor tooling (e.g. My Wing). */
export function hasInstructorAccess(role: string | null | undefined): boolean {
    return role === 'instructor' || role === 'superadmin'
}

export function isSuperadmin(role: string | null | undefined): boolean {
    return role === 'superadmin'
}
