-- ============================================================================
-- Sleep tracking — Supabase migration
-- ============================================================================
-- HOW TO RUN:
--   1. Go to https://supabase.com/dashboard and open the inap-coach project
--   2. Click the SQL Editor icon (</>) in the left sidebar
--   3. Click "+ New query"
--   4. Paste this entire file
--   5. Click "Run" (bottom-right). Should say "Success. No rows returned."
--
-- WHAT IT DOES:
--   - Creates a "sleep_logs" table — one row per night of sleep
--   - Adds Row-Level Security so each user only sees their own sleep
--   - Adds an index for fast queries by user + date
-- ============================================================================

create table if not exists public.sleep_logs (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references public.users(id) on delete cascade,

    -- The calendar date the sleep ENDED (i.e. the morning you woke up).
    -- Used for uniqueness — one sleep record per user per night.
    night_date      date not null,

    -- Where this record came from
    source          text not null check (source in ('manual', 'polar', 'apple_health')),

    -- When you went to bed and when you woke up (timezone-aware)
    sleep_start     timestamptz not null,
    sleep_end       timestamptz not null,
    duration_min    integer not null check (duration_min > 0),

    -- Polar sleep score (0–100) and Polar nightly recharge / ANS status (1–5)
    --   1 = much below usual, 2 = below usual, 3 = usual, 4 = above usual, 5 = much above usual
    sleep_score         integer check (sleep_score between 0 and 100),
    ans_charge_status   integer check (ans_charge_status between 1 and 5),

    -- Sleep stages in minutes
    deep_min        integer check (deep_min >= 0),
    rem_min         integer check (rem_min >= 0),
    light_min       integer check (light_min >= 0),
    awake_min       integer check (awake_min >= 0),

    -- Optional physiological signals
    heart_rate_avg  integer check (heart_rate_avg > 0 and heart_rate_avg < 250),
    hrv_avg         integer check (hrv_avg > 0 and hrv_avg < 250),

    -- Subjective rating 1-5 (manual entries) and free-text notes
    rating          integer check (rating between 1 and 5),
    notes           text,

    -- Polar-specific dedup key (the Polar API returns one record per night)
    polar_date      date,

    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

-- One sleep record per user per night
create unique index if not exists sleep_logs_user_night_idx
    on public.sleep_logs (user_id, night_date);

-- Fast lookups by user, newest first
create index if not exists sleep_logs_user_recent_idx
    on public.sleep_logs (user_id, night_date desc);

-- Auto-update updated_at on row changes
create or replace function public.touch_sleep_logs_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists sleep_logs_touch_updated_at on public.sleep_logs;
create trigger sleep_logs_touch_updated_at
    before update on public.sleep_logs
    for each row execute function public.touch_sleep_logs_updated_at();

-- ── Row-Level Security ─────────────────────────────────────────────────────
-- Users can only see and modify their own sleep records.
alter table public.sleep_logs enable row level security;

drop policy if exists "sleep_logs_select_own" on public.sleep_logs;
create policy "sleep_logs_select_own"
    on public.sleep_logs for select
    using (auth.uid() = user_id);

drop policy if exists "sleep_logs_insert_own" on public.sleep_logs;
create policy "sleep_logs_insert_own"
    on public.sleep_logs for insert
    with check (auth.uid() = user_id);

drop policy if exists "sleep_logs_update_own" on public.sleep_logs;
create policy "sleep_logs_update_own"
    on public.sleep_logs for update
    using (auth.uid() = user_id);

drop policy if exists "sleep_logs_delete_own" on public.sleep_logs;
create policy "sleep_logs_delete_own"
    on public.sleep_logs for delete
    using (auth.uid() = user_id);

-- ── Optional: a user_sleep_settings table for personal targets ─────────────
-- Stores the user's preferred bedtime / wake time / target hours for
-- the recovery-readiness nudges on the Sleep dashboard.
create table if not exists public.user_sleep_settings (
    user_id             uuid primary key references public.users(id) on delete cascade,
    target_hours        numeric(3,1) not null default 7.5 check (target_hours between 4 and 12),
    target_bedtime      time,            -- e.g. '22:30'
    target_wake_time    time,            -- e.g. '06:00'
    created_at          timestamptz not null default now(),
    updated_at          timestamptz not null default now()
);

alter table public.user_sleep_settings enable row level security;

drop policy if exists "sleep_settings_select_own" on public.user_sleep_settings;
create policy "sleep_settings_select_own"
    on public.user_sleep_settings for select
    using (auth.uid() = user_id);

drop policy if exists "sleep_settings_upsert_own" on public.user_sleep_settings;
create policy "sleep_settings_upsert_own"
    on public.user_sleep_settings for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
