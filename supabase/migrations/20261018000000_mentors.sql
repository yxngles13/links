-- supabase/migrations/20261018000000_mentors.sql
--
-- Mentor matching (alumni / seniors <-> students), the mentee goal
-- checklist, and "save for later" on research matches.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run: every statement is IF NOT EXISTS / OR REPLACE / DROP IF EXISTS.

-- ---------- Mentor profiles ----------
-- One row per mentor account. A user "is a mentor" exactly when they have a
-- row here; there is no separate role column to keep in sync.
create table if not exists public.mentor_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  full_name text not null,
  grad_year int,
  job_title text,
  company text,
  mentor_topics text[] not null default '{}',
  bio text,
  availability text,
  preferred_format text,
  is_accepting boolean not null default true,
  profile_embedding extensions.vector(384),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mentor_profiles enable row level security;

-- Any signed-in user can browse mentors; only the owner can write their row.
drop policy if exists "mentor_profiles readable by signed-in users" on public.mentor_profiles;
create policy "mentor_profiles readable by signed-in users"
  on public.mentor_profiles for select to authenticated using (true);

drop policy if exists "mentor_profiles insert own" on public.mentor_profiles;
create policy "mentor_profiles insert own"
  on public.mentor_profiles for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "mentor_profiles update own" on public.mentor_profiles;
create policy "mentor_profiles update own"
  on public.mentor_profiles for update to authenticated using (user_id = auth.uid());

-- ---------- Mentorship requests ----------
-- student_name / student_summary are copied in at request time so the mentor
-- can see who is asking without being granted read access to student_profiles.
create table if not exists public.mentorship_requests (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid not null references public.profiles (id) on delete cascade,
  mentor_profile_id uuid not null references public.mentor_profiles (id) on delete cascade,
  student_name text,
  student_summary text,
  topic text,
  message text,
  fit_label text,
  status text not null default 'requested'
    check (status in ('requested', 'accepted', 'scheduled', 'completed', 'declined')),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mentorship_requests_student_idx on public.mentorship_requests (student_user_id);
create index if not exists mentorship_requests_mentor_idx on public.mentorship_requests (mentor_profile_id);

alter table public.mentorship_requests enable row level security;

create or replace function public.is_mentor_owner(mentor_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.mentor_profiles where id = mentor_id and user_id = auth.uid())
$$;

drop policy if exists "requests visible to student and mentor" on public.mentorship_requests;
create policy "requests visible to student and mentor"
  on public.mentorship_requests for select to authenticated
  using (student_user_id = auth.uid() or public.is_mentor_owner(mentor_profile_id));

drop policy if exists "students create own requests" on public.mentorship_requests;
create policy "students create own requests"
  on public.mentorship_requests for insert to authenticated
  with check (student_user_id = auth.uid());

drop policy if exists "student or mentor updates request" on public.mentorship_requests;
create policy "student or mentor updates request"
  on public.mentorship_requests for update to authenticated
  using (student_user_id = auth.uid() or public.is_mentor_owner(mentor_profile_id));

-- ---------- Student goals (mentee dashboard checklist) ----------
create table if not exists public.student_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.student_goals enable row level security;

drop policy if exists "student_goals own rows" on public.student_goals;
create policy "student_goals own rows"
  on public.student_goals for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- Save for later on research matches ----------
alter table public.match_recommendations add column if not exists saved_at timestamptz;
