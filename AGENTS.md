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
    cadet/                # Cadet profile
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

`useAuth()` from `app/context/auth-context.tsx` returns `{ user, loading }`. `user.id` is the Supabase UUID used as the FK across all tables. Server-side API routes use `supabaseAdmin` (service role key) from `app/api/cron/_lib.ts` or created inline — never the anon client.

## Database patterns

- All inserts/queries on the server use `supabaseAdmin` (service role, bypasses RLS).
- Client code uses `supabase` from `lib/supabase.ts` (anon key, respects RLS).
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
- Two sources: **manual** (LogModal) and **Polar** (auto-sync once per day via `/api/polar/exercises`).
- Manual logging: pick exercise template → fill duration, calories, distance, sets/reps/rounds.
  - Limits: duration 0–600 min, calories 0–5000, distance 0–200 km, sets 0–100, reps 0–1000, rounds 0–100.
- Polar dedup: `polar_exercise_id` unique constraint; duplicate inserts silently ignored (23505).
- Workout detail dialog shows GPX map if track data is available.

### Progress (`app/dashboard/progress/`)
- Weight logs (kg) and body fat % over time, shown as SVG line chart.
- Weight: 20–300 kg. Body fat: 1–60%.
- Polar steps and calories burned auto-imported from Polar cron.

### Insights (`app/dashboard/insights/`)
- Calls `/api/insights?userId=<uuid>` which generates schema-validated insights via `generateStructured()` (AI SDK, Gemini Flash → fallback model).
- Results cached 24h in `user_insights` table per user.
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

### Wing / leaderboard (`app/dashboard/wing/`)
- Cadets compete in wings. Points from IPPT scores, workout logs, nutrition adherence.
- Scoring logic in `lib/scoring.ts` and `SCORING_SYSTEM.md`.

### Cron jobs (`app/api/cron/`)
- All secured with `CRON_SECRET` header check.
- Jobs: macro-alerts, meal-reminders, ippt-reminders, nutrition-tips, leaderboard-movement, weekly-recap.
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
