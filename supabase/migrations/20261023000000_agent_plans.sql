-- supabase/migrations/20261023000000_agent_plans.sql
--
-- Tables for the Links agent: brain-dump captures, plans, steps, trade-off
-- suggestions, an activity log (for Undo), settings, and the Google Calendar
-- connection. Students own their rows via RLS.
--
-- agent_calendar_connections deliberately has NO policies: it holds Google
-- tokens, so it is read and written only server-side with the service role
-- (utils/supabase/admin.ts), always filtered by the signed-in user's id.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run.

create table if not exists public.agent_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  daily_minutes int check (daily_minutes between 0 and 720),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_calendar_connections (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  access_token text,
  expires_at timestamptz,
  needs_reconnect boolean not null default false,
  connected_at timestamptz not null default now()
);

create table if not exists public.agent_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  text text not null check (char_length(text) <= 5000),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text check (kind in ('career', 'idea')),
  title text not null,
  done_looks_like text,
  deadline date,
  deadline_suggested boolean not null default false,
  paused boolean not null default false,
  paused_until date,
  position int not null default 0,
  created_by text not null check (created_by in ('links', 'student')),
  student_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- contact_id has no foreign key: network_contacts isn't defined in this repo.
-- Reads join it manually; a missing contact shows as no contact.
create table if not exists public.agent_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.agent_plans (id) on delete cascade,
  title text not null,
  minutes int not null check (minutes between 10 and 240),
  day date,
  pinned boolean not null default false,
  done_at timestamptz,
  contact_id uuid,
  needs_person text,
  position int not null default 0,
  created_by text check (created_by in ('links', 'student')),
  student_edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tradeoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid references public.agent_plans (id) on delete cascade,
  suggestion text not null,
  pause_until date,
  status text not null default 'open' check (status in ('open', 'paused', 'kept')),
  created_at timestamptz not null default now()
);

-- plan_id and step_id have no foreign keys so log rows outlive deletes.
create table if not exists public.agent_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  capture_id uuid references public.agent_captures (id) on delete set null,
  action text not null check (action in (
    'created_plan', 'added_step', 'updated_plan', 'updated_step', 'marked_done', 'suggested_pause'
  )),
  plan_id uuid,
  step_id uuid,
  summary text not null,
  before jsonb,
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

-- Every page reads by user_id; steps are also read per plan. Safe to re-run.
create index if not exists agent_plans_user_id_idx on public.agent_plans (user_id);
create index if not exists agent_steps_user_id_idx on public.agent_steps (user_id);
create index if not exists agent_steps_plan_id_idx on public.agent_steps (plan_id);
create index if not exists agent_activity_user_created_idx on public.agent_activity (user_id, created_at desc);
create index if not exists agent_captures_user_created_idx on public.agent_captures (user_id, created_at desc);
create index if not exists agent_tradeoffs_user_id_idx on public.agent_tradeoffs (user_id);

alter table public.agent_calendar_connections enable row level security;

alter table public.agent_settings enable row level security;

drop policy if exists "agent_settings select own" on public.agent_settings;
create policy "agent_settings select own"
  on public.agent_settings for select to authenticated using (user_id = auth.uid());

drop policy if exists "agent_settings insert own" on public.agent_settings;
create policy "agent_settings insert own"
  on public.agent_settings for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "agent_settings update own" on public.agent_settings;
create policy "agent_settings update own"
  on public.agent_settings for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agent_settings delete own" on public.agent_settings;
create policy "agent_settings delete own"
  on public.agent_settings for delete to authenticated using (user_id = auth.uid());

alter table public.agent_captures enable row level security;

drop policy if exists "agent_captures select own" on public.agent_captures;
create policy "agent_captures select own"
  on public.agent_captures for select to authenticated using (user_id = auth.uid());

drop policy if exists "agent_captures insert own" on public.agent_captures;
create policy "agent_captures insert own"
  on public.agent_captures for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "agent_captures update own" on public.agent_captures;
create policy "agent_captures update own"
  on public.agent_captures for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agent_captures delete own" on public.agent_captures;
create policy "agent_captures delete own"
  on public.agent_captures for delete to authenticated using (user_id = auth.uid());

alter table public.agent_plans enable row level security;

drop policy if exists "agent_plans select own" on public.agent_plans;
create policy "agent_plans select own"
  on public.agent_plans for select to authenticated using (user_id = auth.uid());

drop policy if exists "agent_plans insert own" on public.agent_plans;
create policy "agent_plans insert own"
  on public.agent_plans for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "agent_plans update own" on public.agent_plans;
create policy "agent_plans update own"
  on public.agent_plans for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agent_plans delete own" on public.agent_plans;
create policy "agent_plans delete own"
  on public.agent_plans for delete to authenticated using (user_id = auth.uid());

alter table public.agent_steps enable row level security;

drop policy if exists "agent_steps select own" on public.agent_steps;
create policy "agent_steps select own"
  on public.agent_steps for select to authenticated using (user_id = auth.uid());

drop policy if exists "agent_steps insert own" on public.agent_steps;
create policy "agent_steps insert own"
  on public.agent_steps for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "agent_steps update own" on public.agent_steps;
create policy "agent_steps update own"
  on public.agent_steps for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agent_steps delete own" on public.agent_steps;
create policy "agent_steps delete own"
  on public.agent_steps for delete to authenticated using (user_id = auth.uid());

alter table public.agent_tradeoffs enable row level security;

drop policy if exists "agent_tradeoffs select own" on public.agent_tradeoffs;
create policy "agent_tradeoffs select own"
  on public.agent_tradeoffs for select to authenticated using (user_id = auth.uid());

drop policy if exists "agent_tradeoffs insert own" on public.agent_tradeoffs;
create policy "agent_tradeoffs insert own"
  on public.agent_tradeoffs for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "agent_tradeoffs update own" on public.agent_tradeoffs;
create policy "agent_tradeoffs update own"
  on public.agent_tradeoffs for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agent_tradeoffs delete own" on public.agent_tradeoffs;
create policy "agent_tradeoffs delete own"
  on public.agent_tradeoffs for delete to authenticated using (user_id = auth.uid());

alter table public.agent_activity enable row level security;

drop policy if exists "agent_activity select own" on public.agent_activity;
create policy "agent_activity select own"
  on public.agent_activity for select to authenticated using (user_id = auth.uid());

drop policy if exists "agent_activity insert own" on public.agent_activity;
create policy "agent_activity insert own"
  on public.agent_activity for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "agent_activity update own" on public.agent_activity;
create policy "agent_activity update own"
  on public.agent_activity for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "agent_activity delete own" on public.agent_activity;
create policy "agent_activity delete own"
  on public.agent_activity for delete to authenticated using (user_id = auth.uid());
