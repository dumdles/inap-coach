-- ============================================================================
-- Performance — Supabase migration
-- ============================================================================
-- HOW TO RUN: Supabase dashboard → SQL Editor → "+ New query" → paste → Run.
-- Run it BEFORE deploying the code that calls leaderboard_inputs() — the
-- leaderboard and wing standings return an error until the function exists.
-- Safe to re-run. Indexes are only added, never dropped.
--
-- WHAT IT DOES:
--   1. Indexes for the columns the API filters on. Before this, meal_logs and
--      weight_logs had no index on user_id, so every "my meals this week"
--      query read the whole table.
--   2. leaderboard_inputs() — aggregates meals, workout calories, sleep and
--      meal streaks inside Postgres and returns one small JSON object. The
--      leaderboard used to download a whole year of raw meal rows for a wing
--      on every page load (and Supabase silently cut that off at 1000 rows,
--      so streaks and scores were computed from incomplete data).
-- ============================================================================


-- ── 1. Indexes ──────────────────────────────────────────────────────────────
-- Per-user time ranges: nutrition page, leaderboard, insights, cadet profile.
create index if not exists meal_logs_user_logged_idx    on public.meal_logs (user_id, logged_at desc);
create index if not exists weight_logs_user_logged_idx  on public.weight_logs (user_id, logged_at desc);

-- Whole-app time windows: challenge scoring + Command console analytics.
create index if not exists meal_logs_logged_idx         on public.meal_logs (logged_at);
create index if not exists workout_logs_logged_idx      on public.workout_logs (logged_at);
create index if not exists daily_summaries_date_idx     on public.daily_summaries (date);
create index if not exists sleep_logs_night_idx         on public.sleep_logs (night_date);

-- Wing / platoon / section lookups (leaderboards, suggestions, challenge participants).
create index if not exists users_wing_platoon_section_idx on public.users (wing, platoon, section);

-- "Bonus points awarded since X" (leaderboard + wing standings).
create index if not exists challenge_awards_awarded_idx on public.challenge_awards (awarded_at);


-- ── 2. leaderboard_inputs() ─────────────────────────────────────────────────
-- Everything app/api/leaderboard and app/api/wing-standings need to score a
-- set of cadets, pre-aggregated per user per day. Scoring itself stays in
-- lib/scoring.ts (computeScore / streak rules) — this only replaces the raw
-- row download. Days are UTC dates, matching how the routes bucketed rows before.
--
-- Returns:
--   { meals:    [[user_id, 'YYYY-MM-DD', meal_count], ...],
--     workouts: [[user_id, 'YYYY-MM-DD', kcal], ...],           -- only if p_include_activity
--     sleep:    [[user_id, night_date, duration_min, sleep_score, ans_charge_status], ...],  -- ditto
--     streaks:  { user_id: consecutive days with ≥1 meal, ending today (max 365) } }
create or replace function public.leaderboard_inputs(
    p_user_ids          uuid[],
    p_since             timestamptz,
    p_since_date        date,
    p_include_activity  boolean default true
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    with today as (
        select (now() at time zone 'UTC')::date as d
    ),
    meals as (
        select user_id, (logged_at at time zone 'UTC')::date as day, count(*)::int as n
        from meal_logs
        where user_id = any(p_user_ids) and logged_at >= p_since
        group by 1, 2
    ),
    workouts as (
        select user_id, (logged_at at time zone 'UTC')::date as day, sum(calories) as kcal
        from workout_logs
        where p_include_activity and user_id = any(p_user_ids) and logged_at >= p_since and calories > 0
        group by 1, 2
    ),
    sleep as (
        select user_id, night_date, duration_min, sleep_score, ans_charge_status
        from sleep_logs
        where p_include_activity and user_id = any(p_user_ids) and night_date >= p_since_date and duration_min > 0
    ),
    -- Streak = run of consecutive meal days ending today. Number the distinct
    -- days newest-first: while the run is unbroken, day n is exactly (n-1)
    -- days before today; after the first gap that never holds again.
    meal_days as (
        select distinct m.user_id, (m.logged_at at time zone 'UTC')::date as day
        from meal_logs m
        where m.user_id = any(p_user_ids)
          and m.logged_at >= now() - interval '366 days'
    ),
    ranked as (
        select md.user_id, md.day, row_number() over (partition by md.user_id order by md.day desc) as rn
        from meal_days md, today t
        where md.day <= t.d and md.day > t.d - 365
    ),
    streaks as (
        select r.user_id, count(*) filter (where t.d - r.day = r.rn - 1)::int as streak
        from ranked r, today t
        group by r.user_id
    )
    select jsonb_build_object(
        'meals',    coalesce((select jsonb_agg(jsonb_build_array(user_id, day, n)) from meals), '[]'::jsonb),
        'workouts', coalesce((select jsonb_agg(jsonb_build_array(user_id, day, kcal)) from workouts), '[]'::jsonb),
        'sleep',    coalesce((select jsonb_agg(jsonb_build_array(user_id, night_date, duration_min, sleep_score, ans_charge_status)) from sleep), '[]'::jsonb),
        'streaks',  coalesce((select jsonb_object_agg(user_id, streak) from streaks), '{}'::jsonb)
    );
$$;

-- security definer runs as the table owner, so lock it down: only the server
-- (service role) may call it — never the browser's anon/authenticated roles,
-- or anyone could read any cadet's activity by passing their id.
revoke all on function public.leaderboard_inputs(uuid[], timestamptz, date, boolean) from public, anon, authenticated;
grant execute on function public.leaderboard_inputs(uuid[], timestamptz, date, boolean) to service_role;
