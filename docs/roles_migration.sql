-- ============================================================================
-- Roles + instructor verification — Supabase migration
-- ============================================================================
-- HOW TO RUN:
--   1. Open the Supabase dashboard → SQL Editor → "+ New query"
--   2. Paste this entire file and click "Run"
--   3. Run the "BOOTSTRAP" statement at the bottom with your own email to make
--      yourself the first superadmin.
--   Safe to re-run (everything is "if not exists" / "or replace").
--
-- WHAT IT DOES:
--   - Adds users.role ('cadet' | 'instructor' | 'superadmin'), default 'cadet'
--   - Backfills existing instructor-rank users as 'instructor' so nobody loses
--     access on deploy (review them in the Admin console afterwards)
--   - Blocks users from changing their own role from the browser (trigger)
--   - Creates instructor_requests — the verification queue a superadmin
--     approves or rejects
-- ============================================================================

-- ── 1. Role column ──────────────────────────────────────────────────────────
alter table public.users
    add column if not exists role text not null default 'cadet';

-- Some databases already had a users.role column with an older check
-- constraint (which "add column if not exists" silently keeps). Replace it so
-- 'superadmin' is allowed. If this fails, existing rows hold other values —
-- inspect with: select role, count(*) from public.users group by role;
alter table public.users alter column role set default 'cadet';
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
    check (role in ('cadet', 'instructor', 'superadmin'));

-- Backfill: anyone who currently has instructor access (via rank) keeps it.
update public.users
set role = 'instructor'
where role = 'cadet'
  and rank in (
      '2LT','LTA','CPT','MAJ','LTC','SLTC','COL',
      '3SG','SSG','MSG','1WO','2WO','MWO','SWO','CWO',
      'ME4A','ME5','ME6','ME7','ME8','ME9'
  );

-- ── 2. Role can only be changed server-side ─────────────────────────────────
-- The browser client (anon/publishable key) can update a user's own row for
-- settings. Without this trigger a cadet could set role = 'superadmin'.
-- Browser requests run as the 'anon' / 'authenticated' Postgres roles; our API
-- routes (secret key) run as 'service_role' and the SQL editor as 'postgres',
-- so those can still change roles.
create or replace function public.protect_user_role()
returns trigger
language plpgsql
as $$
begin
    if current_user in ('anon', 'authenticated') then
        if tg_op = 'INSERT' and new.role is distinct from 'cadet' then
            raise exception 'role can only be assigned by an administrator';
        end if;
        if tg_op = 'UPDATE' and new.role is distinct from old.role then
            raise exception 'role can only be changed by an administrator';
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists users_protect_role on public.users;
create trigger users_protect_role
    before insert or update on public.users
    for each row execute function public.protect_user_role();

-- ── 3. Instructor verification queue ────────────────────────────────────────
create table if not exists public.instructor_requests (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references public.users(id) on delete cascade,
    -- Snapshot of what the requester claimed at the time of request
    rank         text not null,
    wing         text,
    appointment  text not null,           -- e.g. "PC, 3 Plt Hawk Wing"
    status       text not null default 'pending'
                 check (status in ('pending', 'approved', 'rejected')),
    reviewed_by  uuid references public.users(id),
    reviewed_at  timestamptz,
    review_note  text,
    created_at   timestamptz not null default now()
);

-- At most one open request per user
create unique index if not exists instructor_requests_one_pending_idx
    on public.instructor_requests (user_id) where status = 'pending';

-- All reads/writes go through API routes with the service role key, so RLS
-- simply denies the browser client everything.
alter table public.instructor_requests enable row level security;

-- ============================================================================
-- BOOTSTRAP — make yourself superadmin (edit the email, then run this line)
-- ============================================================================
-- update public.users set role = 'superadmin' where email = 'you@example.com';
