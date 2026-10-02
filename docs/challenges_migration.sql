-- ============================================================================
-- Challenges — Supabase migration
-- ============================================================================
-- HOW TO RUN: Supabase dashboard → SQL Editor → "+ New query" → paste → Run.
-- Requires docs/roles_migration.sql to have been run first (users.role).
-- Safe to re-run.
--
-- WHAT IT DOES:
--   - challenges        — time-boxed competitions created by instructors/superadmins
--   - challenge_awards  — bonus points paid out when a challenge finishes; these
--                         are added to the wing leaderboard (see SCORING_SYSTEM.md)
-- Scores are NOT stored per cadet: they are computed live from existing logs
-- (lib/challenges.ts), so there is nothing for cadets to "submit".
-- ============================================================================

create table if not exists public.challenges (
    id            uuid primary key default gen_random_uuid(),
    title         text not null check (char_length(title) between 3 and 80),
    description   text check (description is null or char_length(description) <= 280),

    -- What is measured — keys of CHALLENGE_METRICS in lib/challenges.ts
    metric        text not null check (metric in (
                      'distance_km', 'workout_minutes', 'workouts',
                      'calorie_days', 'protein_days', 'meals_logged',
                      'active_days', 'best_streak')),

    -- individual = cadet vs cadet; team = units compete on their members' average
    format        text not null check (format in ('individual', 'team')),
    team_level    text check (team_level in ('section', 'platoon', 'wing')),

    -- Who is in it (auto-enrolled): every cadet matching these. NULL wing = all wings.
    scope_wing    text,
    scope_platoon text,

    starts_at     timestamptz not null,
    ends_at       timestamptz not null,
    bonus_points  integer not null default 0 check (bonus_points between 0 and 200),

    created_by    uuid not null references public.users(id) on delete cascade,
    created_at    timestamptz not null default now(),

    -- Set once when the challenge is finished and awards are paid out.
    finalized_at  timestamptz,
    results       jsonb,      -- snapshot of final standings + winners

    check (ends_at > starts_at),
    check ((format = 'team') = (team_level is not null))
);

create index if not exists challenges_window_idx on public.challenges (ends_at, starts_at);

create table if not exists public.challenge_awards (
    id            uuid primary key default gen_random_uuid(),
    challenge_id  uuid not null references public.challenges(id) on delete cascade,
    user_id       uuid not null references public.users(id) on delete cascade,
    points        integer not null check (points > 0),
    place         integer not null,                 -- 1, 2 or 3
    awarded_at    timestamptz not null default now(),
    unique (challenge_id, user_id)                  -- a cadet is paid at most once per challenge
);

create index if not exists challenge_awards_user_idx on public.challenge_awards (user_id, awarded_at);

-- All access goes through API routes using the service role key.
alter table public.challenges enable row level security;
alter table public.challenge_awards enable row level security;
