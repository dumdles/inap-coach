-- ============================================================================
-- Challenges: reps (Meal Time Regime) — Supabase migration
-- ============================================================================
-- HOW TO RUN: Supabase dashboard → SQL Editor → "+ New query" → paste → Run.
-- Requires docs/challenges_migration.sql to have been run first. Safe to re-run.
--
-- WHAT IT DOES:
--   1. Adds the 'reps' metric: a challenge counts sets × reps of chosen
--      exercises from workout_logs (e.g. MTR — push-ups, sit-ups, pull-ups
--      before each meal). challenges.exercise_ids lists the exercise_templates.
--   2. An index so scoring a reps challenge only reads those exercises' logs.
--   3. Adds Push-ups / Sit-ups / Pull-ups exercise templates if you don't
--      already have them (matched ignoring case, spaces and hyphens).
-- ============================================================================

-- ── 1. Reps metric ──────────────────────────────────────────────────────────
alter table public.challenges add column if not exists exercise_ids uuid[];

-- Re-create the metric check with 'reps' added (keys of CHALLENGE_METRICS in lib/challenges.ts).
alter table public.challenges drop constraint if exists challenges_metric_check;
alter table public.challenges add constraint challenges_metric_check check (metric in (
    'distance_km', 'workout_minutes', 'workouts',
    'calorie_days', 'protein_days', 'meals_logged',
    'active_days', 'best_streak', 'reps'));

-- A reps challenge must name 1–6 exercises; other metrics must not.
alter table public.challenges drop constraint if exists challenges_reps_exercises_check;
alter table public.challenges add constraint challenges_reps_exercises_check check (
    (metric = 'reps') = (exercise_ids is not null and cardinality(exercise_ids) between 1 and 6));


-- ── 2. Index ────────────────────────────────────────────────────────────────
create index if not exists workout_logs_template_logged_idx on public.workout_logs (template_id, logged_at);


-- ── 3. MTR exercise templates ───────────────────────────────────────────────
-- Logged with sets × reps (fields.sets_reps) from the Workouts page or the
-- challenge page's quick log. Skipped if an exercise with that name exists.
insert into public.exercise_templates (name, category, icon, fields, polar_sport_keys, sort_order)
select v.name, 'strength', 'dumbbell', '{"sets_reps": true}'::jsonb, '{}'::text[], v.sort_order
from (values ('Push-ups', 900), ('Sit-ups', 901), ('Pull-ups', 902)) as v(name, sort_order)
where not exists (
    select 1 from public.exercise_templates t
    where regexp_replace(lower(t.name), '[^a-z]', '', 'g') = regexp_replace(lower(v.name), '[^a-z]', '', 'g')
);
