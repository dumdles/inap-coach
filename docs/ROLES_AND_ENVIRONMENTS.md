# Roles & environments

## Roles

| Role | How you get it | What it unlocks |
|---|---|---|
| `cadet` | Default at sign-up | Own data, friends, leaderboards |
| `instructor` | Request in Settings → Profile (instructor rank required), approved by a superadmin | **My Wing** — own wing's cadets, section/wing admin |
| `superadmin` | SQL only (see `docs/roles_migration.sql`) | **Admin** console — every wing, verification queue, revoke access; can open any cadet's page |

Enforcement is server-side: `requireRole()` in `app/api/_lib/roles.ts` reads the
role from the verified session; a Postgres trigger stops the browser from
editing `users.role`. Hiding nav items in the UI is cosmetic only.

### Rolling out (per Supabase project)
1. Run `docs/roles_migration.sql` in the SQL editor.
2. Run the bootstrap line with your email to become superadmin.
3. Open **Admin** and revoke any backfilled instructor accounts that shouldn't have access
   (the migration grants `instructor` to every existing user with an instructor rank so nobody is locked out).

## Environments

| Branch | Deploys to | Database | Purpose |
|---|---|---|---|
| `main` | Production domain | Production Supabase | What cadets use |
| `staging` | Stable Vercel preview URL for the branch | Separate staging Supabase project (recommended) | Pilot features, demo to superiors |
| feature branches | Per-commit Vercel preview | Staging Supabase | Development |

Flow: feature branch → PR into `staging` → demo/pilot → PR `staging` → `main`.

### One-time Vercel setup for `staging`
1. **Stable URL** — Vercel already builds every pushed branch. The branch alias
   `<project>-git-staging-<team>.vercel.app` always points at the latest `staging` build.
   For a nicer link, add a domain (e.g. `staging.<your-domain>`) under
   Project → Settings → Domains and assign it to the `staging` branch.
2. **Make it public** — Project → Settings → Deployment Protection. Vercel Authentication
   is on for previews by default, which would make superiors log in to Vercel.
   Either turn it off for previews, or keep it on and use a *Shareable Link* for the staging URL.
   The app's own login still applies either way.
3. **Separate data** — create a second Supabase project, run every `docs/*.sql`
   migration there, and add its keys under Project → Settings → Environment Variables
   scoped to *Preview* + branch `staging` (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`). Without this, staging
   reads and writes production data and pilot migrations hit real cadets.
4. Cron jobs in `vercel.json` only run on production, so staging won't send real notifications.

## Password reset (Supabase Auth emails)

Flow: **Forgot password?** on the login page → `/auth/forgot-password` sends
`supabase.auth.resetPasswordForEmail(email, { redirectTo: <site>/auth/reset-password })`
→ the email link opens `/auth/reset-password`, which checks the link and calls
`supabase.auth.updateUser({ password })`. The page refuses to change a password
unless it was opened from a valid reset link.

One-time Supabase dashboard setup (do it per project — prod and staging):

1. **Authentication → URL Configuration**
   - *Site URL*: your production URL (e.g. `https://fitrep.vercel.app`).
   - *Redirect URLs*: add every origin the app runs on, with the path:
     - `https://<prod-domain>/auth/reset-password`
     - `https://*-dumdles-projects.vercel.app/**` (Vercel previews incl. staging)
     - `http://localhost:3000/**` (local dev)
     If the origin isn't listed, Supabase silently falls back to the Site URL.
2. **Authentication → Emails → SMTP Settings — required for real users.**
   Supabase's built-in sender only delivers to members of your Supabase
   organisation and is capped at 2 emails/hour for the whole project, so cadets
   would never get their link. Plug in a provider (e.g. Resend — free tier
   ~3,000 emails/month): host, port, username, password, sender address
   (e.g. `no-reply@<your-domain>`, the domain must be verified with the provider).
   Then raise the limit under **Authentication → Rate Limits** if needed.
3. **Authentication → Emails → Templates → Reset Password** (optional, recommended):
   the default template works as-is. For links that survive corporate email
   scanners pre-opening them, change the button link to
   `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery` — the reset page
   supports both styles.
