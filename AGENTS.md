<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# fitrep — Agent & Codebase Guide

## What is fitrep?

A nutrition and fitness tracking web app built exclusively for **Officer Cadet School (OCS) cadets in Singapore**. Cadets live in camp Mon–Fri (cookhouse meals provided) and return home on weekends. The app helps them track meals, workouts, body weight, and gives AI-powered coaching insights.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router (`app/`) |
| Language | TypeScript |
| Database | Supabase (Postgres) via `@supabase/supabase-js` |
| Auth | Custom Supabase auth (email/password) + `app/context/auth-context.tsx` |
| Styling | Tailwind CSS v4 + shadcn/ui |
| AI | Vercel AI SDK v6 (`ai` + `@openrouter/ai-sdk-provider`) over OpenRouter (`OPENROUTER_API_KEY`). Gemini Flash primary with OpenRouter-native model fallback. Shared helpers in `app/api/_lib/ai.ts` |
| Fitness data | Polar Flow API (OAuth) |
| Notifications | Supabase `notifications` table — push-style, in-app only |
| Deployment | Vercel |

## Project structure

```
app/
  api/                    # Route handlers (Next.js App Router)
    _lib/                 # ai.ts (AI SDK helpers), auth.ts (verifyAuth), coach-prompt/data/tools.ts (AI coach chat)
    auth/                 # Supabase auth + Polar OAuth callbacks
    admin/                # Superadmin-only: analytics (Command console data), staff list, role changes
    cadet/                # Cadet profile
    challenges/           # Challenges: list/create, detail + live standings, cancel
    chat/                 # AI coach chat: streaming route, sessions, suggestion chips
    cron/                 # Scheduled jobs (Vercel Cron) — macro alerts, weekly recap, leaderboard
    food-items/           # CRUD for food items (custom and cookhouse)
    food-templates/       # Read-only preset food items (DB-seeded)
    insights/             # AI coaching (OpenRouter → GPT/Gemini)
    leaderboard/          # Wing leaderboard scoring
    notifications/        # In-app notifications
    polar/exercises/      # Fetch + import Polar workouts
    users/                # User search and suggestions
    weight-logs/          # Weight + body fat tracking
    wing-standings/       # Wing competition standings
    workout-logs/         # Workout CRUD + Polar dedup
  context/
    auth-context.tsx      # useAuth() — current user session
    theme-context.tsx     # Dark/light mode
  dashboard/
    admin/                # Superadmin Command console — tabs: Overview, Wings, Watchlist, Staff
    challenges/           # Challenges list, create dialog, detail standings
    coach/                # AI coach chat (useChat streaming UI + suggestion chips)
    friends/              # Friend management
    insights/             # AI insights page
    notifications/        # Notification list
    nutrition/            # Daily meal logging + macro dashboard
    page.tsx              # Dashboard home
    profile/              # Profile view
    progress/             # Weight chart + body comp
    settings/             # User settings (goals, profile edit)
    wing/                 # Wing standings + cadet detail pages
    workouts/             # Workout log + Polar sync
components/
  auth/                   # Login and signup forms
  nutrition/
    log-meal-dialog.tsx   # The main meal logging dialog (search, templates, custom food)
  ui/                     # shadcn/ui primitives + custom components
  workouts/
    gpx-map.tsx           # GPX track visualisation
    workout-detail-dialog.tsx
lib/
  analytics.ts            # Deterministic stats (trends, averages, adherence) shared by UI + AI
  polar.ts                # Polar Flow API helpers
  scoring.ts              # IPPT and wing scoring logic
  supabase.ts             # Supabase client (browser)
  tdee.ts                 # TDEE / macro targets / meal type detection
  utils.ts                # cn(), fmt(), general helpers
docs/
  DESIGN_SYSTEM.md        # Color tokens, typography, spacing — read before touching UI
```

## Key design rules

- **Design system**: Always use CSS custom property tokens (e.g. `text-primary`, `bg-muted`, `border-border`). Never hardcode hex values. See `docs/DESIGN_SYSTEM.md` for the full token reference.
- **Leave comments for junior developers**: Briefly explain what code does and how it links to related features if possible.
- **Validation**: All numeric user inputs must be validated both client-side (inline error under the field, shown on change) and server-side (API returns 400 with a message). Limits are domain-appropriate (e.g. duration max 600 min, weight 20–300 kg).
- **Dates & times**: Never use native `<input type="date|time|datetime-local">` — they render inconsistently across browsers. Use the in-app `DatePicker`, `TimePicker`, or `DateTimePicker` from `components/ui/` (all built on the shared Popover + Calendar, themed in 24h SGT).

## Authentication

`useAuth()` from `app/context/auth-context.tsx` returns `{ user, loading }`.
Password reset: `/auth/forgot-password` (sends the Supabase reset email) → `/auth/reset-password` (sets the new password; only works when opened from the email link). Needs Redirect URLs + custom SMTP configured in Supabase — see `docs/ROLES_AND_ENVIRONMENTS.md` → Password reset. `user.id` is the Supabase UUID used as the FK across all tables. Server-side API routes use `supabaseAdmin` (service role key) from `app/api/cron/_lib.ts` or created inline — never the anon client.

## Roles & access

`users.role` is `cadet` (default) | `instructor` | `superadmin` — see `lib/roles.ts` and `docs/roles_migration.sql`.
- **Rank never grants access.** Instructor-eligible ranks (`isInstructorRank` in `lib/scoring.ts`) can only *request* access from Settings → Profile; a superadmin approves it in the Admin console (`app/dashboard/admin`, `app/api/instructor-requests`).
- A DB trigger blocks the browser client from changing `role`; only service-role API routes can. Signup always inserts `role: 'cadet'`.
- Privileged API routes must call `requireRole(req, [...])` from `app/api/_lib/roles.ts` — never trust a `userId`/`requesterId` sent by the client.
- **Every user-data API route authenticates** with `verifyAuth` / `requireRole`. Client code calls them via `authFetch()` (`lib/auth-fetch.ts`), which attaches the Bearer token. Reads of *another* cadet's data (`?userId=`) go through `canViewUser()` in `app/api/_lib/access.ts` (self, superadmin, same-wing instructor, accepted friend). Intentionally public: `auth/signup`, `food-templates`, and the Polar OAuth callback (protected by the HMAC-signed `state` in `app/api/_lib/polar-state.ts`).
- Superadmin is granted only via SQL (bootstrap line at the bottom of the migration).
- **"View as" (role preview)**: superadmins can preview the app as a cadet or an instructor of any wing (`components/role-preview/view-as.tsx`; rules in `lib/role-preview.ts`). `authFetch` sends `x-preview-role` / `x-preview-wing`; `requireRole` and `canViewUser` honour them only for real superadmins, only to lower access, and refuse role-gated writes while previewing. Client code that reads `users.role`/`wing` directly must pass the profile through `applyPreview(profile, useRolePreview())`. New `canViewUser` callers: pass `readPreview(req)`.

### Command console (`app/dashboard/admin/`)
- Superadmin-only, tabbed (`layout.tsx` holds the role gate, top tab bar and 7d/28d switch). One fetch of `/api/admin/analytics` is shared by all tabs via `components/admin/admin-data.tsx`.
- All maths lives in `lib/admin-analytics.ts` (pure, no DB): KPIs with deltas vs the previous window, per-wing/daily aggregates, per-cadet watchlist flags (tune in `THRESHOLDS`) and the plain-English "What needs your attention" findings.
- Charts in `components/admin/charts.tsx` use the fixed `--viz-*` tokens in `globals.css` (colour-blind-validated; not affected by goal-mode theming).

## Client data loading (cache)

Dashboard pages load data through `useApi(path)` / `useData(name, loader)` from `lib/use-data.ts` (SWR, stale-while-revalidate) — not `useEffect` + `useState`. Revisiting a page renders the cached data instantly and refreshes it in the background; `isLoading` is only true when nothing is cached (that's when to show skeletons).
- `useData` names follow `<entity>:<screen>:<params>` (e.g. `meals:home:2026-10-03`); one name = one data shape. `useApi` keys are the path incl. query string.
- After a write: call the query's `mutate()`, plus `refreshData(prefix)` from `lib/data-cache.ts` for other screens showing that entity (e.g. `refreshData('meals:')`, `refreshData('/api/leaderboard')`).
- The cache is in-memory per tab, keyed by user id, and cleared on sign-out (`auth-context`). Don't cache form/edit state, search-as-you-type, or one-off actions.

## Database patterns

- All inserts/queries on the server use `supabaseAdmin` (service role, bypasses RLS).
- Client code uses `supabase` from `lib/supabase.ts` (anon key, respects RLS).
- **Supabase returns at most 1000 rows per request and silently drops the rest.** Any query that could exceed that must page with `fetchPaged()` (`app/api/_lib/paged.ts`) — or, better, aggregate in Postgres.
- **Latency:** Vercel functions run in `sin1` next to the Supabase project (Singapore); each sequential query is a round trip, so run independent queries with `Promise.all`. `verifyAuth` checks the JWT locally (`getClaims`) and `requireRole` returns the caller's wing/platoon/section — reuse them instead of re-querying `users`.
- **Leaderboard / wing standings** get per-day activity and meal streaks pre-aggregated by the `leaderboard_inputs()` Postgres function (`docs/performance_migration.sql`, wrapped by `app/api/_lib/leaderboard-inputs.ts`). Scoring rules stay in `lib/scoring.ts`. Never download raw log rows for a whole wing.
- Indexes live in the migration files in `docs/` — add one there when a new query filters a large table on a new column.
- Tables of interest: `users`, `meal_logs`, `food_items`, `food_templates`, `workout_logs`, `exercise_templates`, `weight_logs`, `notifications`, `friendships`, `workout_tags`, `wing_standings`.

## Feature rundown

### Nutrition (`app/dashboard/nutrition/`)
- Shows daily macro totals (calories, protein, carbs, fat) vs. TDEE targets.
- Meal logging via `components/nutrition/log-meal-dialog.tsx`:
  - Stage 1: search food items (DB) or browse cookhouse templates.
  - Stage 2: custom food entry (per-100g macros).
  - Stage 3: serving size + meal type + notes.
  - Quantity validated: 1–5000g. Custom macros: calories 0–900 kcal, protein/carbs/fat 0–100g per 100g.

### Workouts (`app/dashboard/workouts/`)
- Two sources: **manual** (LogModal) and **Polar** (background auto-sync at most once per day via `/api/polar/exercises`, only for cadets who've connected Polar; the list stays visible while it syncs).
- Manual logging: pick exercise template → fill duration, calories, distance, sets/reps/rounds.
  - Limits: duration 0–600 min, calories 0–5000, distance 0–200 km, sets 0–100, reps 0–1000, rounds 0–100.
- Polar dedup: `polar_exercise_id` unique constraint; duplicate inserts silently ignored (23505).
- Workout detail dialog shows GPX map if track data is available.

### Progress (`app/dashboard/progress/`)
- Weight logs (kg) and body fat % over time, shown as SVG line chart.
- Weight: 20–300 kg. Body fat: 1–60%.
- Polar steps and calories burned auto-imported from Polar cron.

### Insights (`app/dashboard/insights/`)
- Calls `/api/insights` (caller from the Bearer token) which generates schema-validated insights via `generateStructured()` (AI SDK, Gemini Flash → fallback model).
- Results cached 24h in `user_insights` table per user. Stale-while-revalidate: an expired cache is returned immediately and regenerated in the background with Next's `after()`; only a cadet's first visit waits for the AI.
- Pass `&refresh=1` to force regeneration.
- Loading state shows animated spinner + friendly "Analysing your data…" message (not a silent skeleton).

### AI Coach chat (`app/dashboard/coach/`)
- Streaming chatbot built on AI SDK `useChat` + `/api/chat` (`streamText` with tool calling, `stopWhen: stepCountIs(6)`).
- Tools in `app/api/_lib/coach-tools.ts` fetch the authed cadet's own data (nutrition, meals, workouts, weight, sleep, leaderboard, IPPT, TDEE targets) — userId comes from `verifyAuth`, never from the model. The coach proactively pulls multiple sources before planning answers. One write tool, `setIpptDate`, lets the coach save the cadet's upcoming IPPT date after they confirm one.
- Persona + per-service context in `app/api/_lib/coach-prompt.ts` (shared with insights via `SERVICE_CONTEXT`).
- Conversations persisted in `chat_sessions` / `chat_messages` (full UIMessage `parts` as jsonb, replaced wholesale in `onFinish`).
- Suggestion chips: static starter chips on the empty state; after each reply the client POSTs the conversation tail to `/api/chat/suggestions` for 3 AI-generated follow-up chips.
- Client auth: Bearer token + sessionId passed per request via `sendMessage` request-level options.
- Daily AI limit: each cadet gets `AI_DAILY_MESSAGE_LIMIT` coach messages per Singapore day. `app/api/_lib/ai-usage.ts` atomically consumes quota via the `increment_ai_usage` Postgres function (table `ai_usage`); `/api/chat` returns 429 `rate_limited` when exhausted. The UI reads `/api/chat/usage` to show remaining messages and disables the input at zero.
- `scripts/create-test-user.mjs` creates/resets a seeded test cadet (`coach-e2e-test@fitrep.local`) for local E2E testing.

### Challenges (`app/dashboard/challenges/`)
- Time-boxed competitions created by verified instructors (own wing, optional platoon) or superadmins (any wing / all wings). Migration: `docs/challenges_migration.sql`.
- Cadets in scope are **auto-enrolled**; scores are computed live from existing logs — no submissions. Metrics (training, nutrition, consistency), formats (individual, or section/platoon/wing teams ranked by members' *average*), validation and payouts all live in `lib/challenges.ts` (pure, unit-testable). Server glue (participants, log fetching, finalize) in `app/api/_lib/challenges.ts`.
- **Reps challenges (e.g. MTR — Meal Time Regime)**: metric `reps` counts sets × reps of the exercise templates in `challenges.exercise_ids` (migration: `docs/challenges_reps_migration.sql`, which also seeds Push-ups / Sit-ups / Pull-ups). The create dialog has a "Use MTR set" shortcut; the challenge page has a one-tap quick log (`components/challenges/quick-log-reps.tsx`) that posts each exercise as a normal workout log.
- UI is gamified and wide (`max-w-7xl`): list = trophy strip (medals, bonus points) + live cards with your place vs the leader; detail = standing card with the gap to the next place, race chart (cumulative score per SGT day, `cumulativeByDay` in `lib/challenges.ts` → `buildRace` in `app/api/_lib/challenges.ts`), your daily gains vs the average cadet, podium, standings and score distribution. Chart pieces live in `components/challenges/charts.tsx`; medal colours are the `--medal-*` tokens (always shown with the place number).
- Only the log tables a metric needs are fetched (`METRIC_SOURCES`).
- The challenge page UI is `components/challenges/arena.tsx` (pure presentation, fed by the real page or the demo). Quick logs update the page optimistically (`withLoggedReps`) and then re-fetch.
- **Editing** (`PATCH /api/challenges/[id]`, creator or superadmin): upcoming → any field; live → only title, description, end time and bonus (`LIVE_EDITABLE`); finished → none. The create dialog doubles as the edit dialog (`editing` prop) and locks the other fields once live. Participants are notified if the end time or bonus changes.
- **Win celebration**: a finished challenge with a final place shows `components/challenges/win-celebration.tsx` — confetti for the podium (once per device, `canvas-confetti`, respects reduced motion) and a shareable 1080×1920 PNG drawn by `lib/share-card.ts` (native share sheet → Instagram story, or download).
- **Demo** (`/dashboard/challenges/demo`, linked from the list): a playable MTR challenge with fake cadets generated in the browser (`lib/challenge-demo.ts`) — log a set to overtake the leader, "Finish now", celebrate and share. Nothing is written to the database; scoring uses the real rules.
- When a challenge ends it is finalized exactly once (lazily on view/list, and by `/api/cron/challenges`): places 1–3 earn 100/60/30% of its bonus into `challenge_awards`, which the leaderboard and wing standings add to scores (see `SCORING_SYSTEM.md`). Participants are notified on create and finish.

### Wing / leaderboard (`app/dashboard/wing/`)
- Cadets compete in wings. Points from IPPT scores, workout logs, nutrition adherence.
- Scoring logic in `lib/scoring.ts` and `SCORING_SYSTEM.md`.
- **My Wing** (instructors/superadmins) is built for 100–200 cadets — summarise, group, then list; never render one chart mark per cadet in a long list. Tabs:
  - **Overview**: stat tiles, the wing map (`components/wing/section-map.tsx` — a tile per platoon/section, a square per cadet, "colour by" today / last 7 days / score / goal; click → section pop-up) and a capped **Needs attention** list (silent 3+ days, patchy, no section).
  - **Roster** (`components/wing/roster.tsx`): one line per cadet, search (`p2 s3` works), quick views, filters, group-by-section (`content-visibility: auto` keeps 150+ rows smooth).
  - **Trends** (`components/wing/trends.tsx`): sections compared, score histogram + top/bottom 5, goal mix, streaks.
  - Maths in `lib/wing-overview.ts` (pure). Data: `/api/leaderboard?scope=wing`, whose rows carry `last7` (meals per day, oldest → today).
  - Superadmins get a **Demo wing** toggle (`lib/wing-demo.ts`, ~150 fake cadets in the browser, nothing saved).
  - Goal-mode chart colours are the validated `--viz-goal-*` tokens; sequential encodings use `--viz-heat-*`.

### Cron jobs (`app/api/cron/`)
- All secured with `CRON_SECRET` header check.
- Jobs: macro-alerts, meal-reminders, ippt-reminders, nutrition-tips, leaderboard-movement, weekly-recap, challenges (pays out ended challenges; also runs lazily when the Challenges page is opened).
- Scheduled via `vercel.json` cron config.

## Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser) |
| `SUPABASE_SECRET_KEY` | Supabase service role key (server only) |
| `OPENROUTER_API_KEY` | OpenRouter for AI insights + coach chat |
| `INSIGHTS_MODEL` | Override primary model (default: `google/gemini-3.1-flash-lite`) |
| `INSIGHTS_FALLBACK_MODEL` | Fallback model |
| `CHAT_MODEL` | Override coach chat model (default: same as `INSIGHTS_MODEL`; must support tool calling) |
| `AI_DAILY_MESSAGE_LIMIT` | Per-cadet daily AI coach message cap (default 25) |
| `POLAR_CLIENT_ID` / `POLAR_CLIENT_SECRET` | Polar Flow OAuth |
| `CRON_SECRET` | Protects cron route handlers |

## Before making UI changes

Read `docs/DESIGN_SYSTEM.md`. All color, typography, spacing, and component patterns are defined there. Use existing shadcn/ui primitives in `components/ui/` rather than introducing new ones.

## Before touching Next.js internals

Read the docs in `node_modules/next/dist/docs/` — this project may be on a version with breaking changes from training data.
