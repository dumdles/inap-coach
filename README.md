# INAP·Coach

A fitness and nutrition coaching web app built for Singapore Armed Forces (SAF) cadets and instructors. It tracks meals, workouts, weight progress, and unit standings — with role-based views for cadets vs. instructors.

---

## Table of Contents

- [What it does](#what-it-does)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Architecture overview](#architecture-overview)
- [Data model](#data-model)
- [Onboarding: getting started locally](#onboarding-getting-started-locally)
- [Key concepts for new developers](#key-concepts-for-new-developers)
- [Design system](#design-system)
- [API routes](#api-routes)
- [Environment variables](#environment-variables)

---

## What it does

| Feature | Who sees it |
|---|---|
| Dashboard with daily nutrition summary | All users |
| Meal logging + calorie/protein tracking | All users |
| Workout logging (Polar wearable data: steps, calories) | All users |
| Body weight check-ins and progress charts | All users |
| Points leaderboard with logging streaks | All users |
| Friends / follow system | All users |
| Wing standings (unit-level aggregates) | Instructors only |
| Goal modes: Bulk, Cut, Maintain, IPPT | All users |
| In-app notifications | All users |

Calorie and protein targets are computed per-user using the Mifflin-St Jeor TDEE formula, adjusted by activity level and goal mode.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI components | shadcn/ui + Radix UI primitives |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Forms | react-hook-form |
| Backend / database | Supabase (Postgres + Auth) |
| Hosting | Vercel |

---

## Project structure

```
inap-coach/
├── app/                        # Next.js App Router pages and API routes
│   ├── api/                    # Server-side API route handlers
│   │   ├── auth/signup/        # User registration
│   │   ├── cadet/              # Cadet profile operations
│   │   ├── food-items/         # Food search and off-search
│   │   ├── friendships/        # Follow/unfollow, friend list
│   │   ├── leaderboard/        # Points rankings
│   │   ├── notifications/      # In-app notification CRUD
│   │   ├── users/              # User search, suggested users
│   │   ├── weight-logs/        # Body weight check-ins
│   │   └── wing-standings/     # Unit-level leaderboard (instructors)
│   ├── context/
│   │   ├── auth-context.tsx    # Global auth state (user, session, signIn/Out)
│   │   └── theme-context.tsx   # Goal mode theming (bulk/cut/maintain/ippt)
│   ├── dashboard/              # All post-login pages
│   │   ├── layout.tsx          # Sidebar + mobile nav shell
│   │   ├── page.tsx            # Home dashboard
│   │   ├── nutrition/          # Meal logging and daily targets
│   │   ├── workouts/           # Workout log
│   │   ├── progress/           # Weight chart + check-in history
│   │   ├── friends/            # Leaderboard + friend management
│   │   ├── wing/               # Instructor-only wing standings
│   │   ├── profile/            # User profile editing
│   │   └── settings/           # App settings
│   ├── login/                  # Login page
│   ├── signup/                 # Sign-up page
│   ├── globals.css             # Global CSS and Tailwind config
│   └── layout.tsx              # Root layout (providers)
├── components/
│   ├── auth/                   # Login and signup form components
│   ├── nutrition/              # Meal logging dialog
│   └── ui/                     # shadcn/ui base components (button, card, etc.)
├── lib/
│   ├── supabase.ts             # Supabase client + auth helpers
│   ├── scoring.ts              # Points calculation and streak logic
│   ├── tdee.ts                 # TDEE / calorie / protein calculations
│   └── utils.ts                # Shared utilities (cn, etc.)
├── docs/
│   └── DESIGN_SYSTEM.md        # Color tokens, typography, spacing rules
└── public/
    └── design-system/          # HTML design system reference
```

---

## Architecture overview

```
Browser
  │
  ├── Next.js App Router (app/)
  │     ├── Client components  →  React state, user interactions
  │     └── Server components  →  Initial data fetching (where used)
  │
  ├── API Routes (app/api/**)
  │     └── Thin handlers — validate input, query Supabase, return JSON
  │
  └── Supabase
        ├── Auth  →  Email/password sessions, JWT tokens
        └── Postgres  →  All application data (users, meals, workouts, etc.)
```

### Auth flow

1. `AuthProvider` (`app/context/auth-context.tsx`) wraps the entire app and holds the current `user` and `session`.
2. On mount it calls `supabase.auth.getSession()` and subscribes to `onAuthStateChange` for token refreshes.
3. `app/dashboard/layout.tsx` reads `useAuth()` — if no user is present after loading, it redirects to `/login`.
4. API routes receive the user's Supabase session token via the client and can verify it server-side.

### Goal mode theming

`ThemeProvider` (`app/context/theme-context.tsx`) stores the user's active `GoalMode` (`bulk | cut | maintain | ippt`). This value is loaded from the `users` table on login and applied as a CSS class on the root element, driving color-theme shifts across the UI.

### Scoring / points

`lib/scoring.ts` contains pure functions for computing leaderboard points:
- **40 pts** per logged meal, capped at 3 meals/day (120 pts/day max)
- **5 pts** per consecutive day streak bonus
- Instructors are identified by rank string (e.g., `2LT`, `MAJ`, `3SG`) — cadets are only `OCT` or `ME4T`

### TDEE calculation

`lib/tdee.ts` implements the Mifflin-St Jeor equation. Given a user's gender, weight, height, age, activity level, and goal mode it returns daily calorie and protein targets. These targets drive the nutrition dashboard progress bars.

---

## Data model

> The authoritative schema lives in Supabase. The tables below reflect what the app currently uses.

| Table | Key columns | Notes |
|---|---|---|
| `users` | `id`, `full_name`, `rank`, `wing`, `goal_mode`, `height_cm`, `weight_kg`, `date_of_birth`, `activity_level` | 1-to-1 with Supabase Auth user |
| `meal_logs` | `id`, `user_id`, `food_item_id`, `meal_type`, `logged_at`, `calories`, `protein_g` | One row per food item logged |
| `food_items` | `id`, `name`, `calories`, `protein_g`, `carbs_g`, `fat_g` | Shared food database |
| `weight_logs` | `id`, `user_id`, `weight_kg`, `body_fat_pct`, `polar_steps`, `polar_calories_burned`, `logged_at` | Daily check-in |
| `friendships` | `id`, `requester_id`, `addressee_id`, `status` | Follow/friend relationships |
| `notifications` | `id`, `user_id`, `type`, `title`, `body`, `read`, `created_at` | In-app notifications |

---

## Onboarding: getting started locally

### Prerequisites

- Node.js 20+
- A Supabase project (free tier is fine)

### Steps

1. **Clone the repo**

   ```bash
   git clone <repo-url>
   cd inap-coach
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the project root:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```

   Find these values in your Supabase dashboard under **Project Settings → API**.

4. **Set up the database**

   Run the SQL migrations in your Supabase SQL editor to create the tables listed in the [Data model](#data-model) section above. (Migrations file TBD — ask a teammate for the latest schema dump.)

5. **Start the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

6. **Create a test account**

   Go to `/signup` and register. Then update your row in the `users` table in Supabase to set a `rank`, `wing`, and `goal_mode` so all features light up.

---

## Key concepts for new developers

### Next.js App Router

This project uses the **App Router** (the `app/` directory), not the older Pages Router. Key things to know:

- Files named `page.tsx` become routes (e.g. `app/dashboard/nutrition/page.tsx` → `/dashboard/nutrition`)
- Files named `layout.tsx` wrap all child pages at that level
- `'use client'` at the top of a file means it runs in the browser. Without it, the component is a React Server Component (runs on the server, no `useState`/`useEffect`)
- API routes live in `app/api/**/route.ts` and export named functions like `GET`, `POST`, `PATCH`, `DELETE`

### Supabase client

`lib/supabase.ts` exports a single shared `supabase` client. Import it anywhere:

```ts
import { supabase } from '@/lib/supabase'

const { data, error } = await supabase.from('users').select('*').eq('id', userId).single()
```

The `@/` alias maps to the project root (configured in `tsconfig.json`).

### Adding a new page

1. Create `app/dashboard/your-page/page.tsx`
2. Add `'use client'` if you need state or effects
3. Add a nav link in `app/dashboard/layout.tsx` (find the `BASE_NAV` array)

### Adding a new API route

Create `app/api/your-endpoint/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const { data, error } = await supabase.from('your_table').select('*').eq('user_id', userId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

### Role-based access

Use `isInstructor(rank)` from `lib/scoring.ts` to check if a user should see instructor-only features:

```ts
import { isInstructor } from '@/lib/scoring'

if (isInstructor(profile.rank)) {
  // show wing standings link
}
```

---

## Design system

Full token reference: `docs/DESIGN_SYSTEM.md`

Quick summary:
- **Never hardcode hex colours** — use CSS custom property tokens like `--primary`, `--danger`, `--gray-500`
- Use Tailwind utility classes that map to these tokens (e.g. `text-primary`, `bg-destructive`)
- Component primitives (Button, Card, Input, etc.) are in `components/ui/` — extend those rather than writing raw HTML
- Spacing follows an 8-point grid (4px base unit)

---

## API routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/signup` | Register a new user |
| `GET/PATCH` | `/api/cadet` | Get or update cadet profile |
| `GET` | `/api/food-items` | Search food items |
| `GET` | `/api/food-items/off-search` | Search Open Food Facts API |
| `GET/POST/DELETE` | `/api/friendships` | Manage friend/follow relationships |
| `GET` | `/api/leaderboard` | Points leaderboard |
| `GET/PATCH` | `/api/notifications` | List notifications / mark read |
| `GET` | `/api/users/search` | Search users by name |
| `GET` | `/api/users/suggested` | Suggested users to follow |
| `GET/POST` | `/api/weight-logs` | List or create weight check-ins |
| `GET` | `/api/wing-standings` | Unit-level leaderboard (instructors) |

---

## Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (safe to expose to browser) |

> Variables prefixed `NEXT_PUBLIC_` are bundled into the client. Never put secrets (service role key, etc.) in `NEXT_PUBLIC_` variables.
