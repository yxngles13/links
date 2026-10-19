-- supabase/migrations/20261020000000_student_public_profiles.sql
--
-- Student profiles that other signed-in users can see: photo, name, headline,
-- personality prompts, resume, LinkedIn, GitHub. Plus the storage bucket for
-- the photo and resume.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run.
--
-- Why a separate table: student_profiles holds the matching answers, which
-- onboarding promises nobody else sees. Keeping the public fields here means
-- the "anyone signed in can read" policy below can never expose them.
--
-- For reference, student_profiles was created in the dashboard and has no
-- migration in this repo. Its columns as of 2026-10-19 (read from the REST
-- schema; its RLS policies weren't readable that way and are not touched here):
--   id uuid, user_id uuid, major text, academic_year text, coursework text[],
--   technical_skills text[], research_interests text[], career_goals text,
--   weekly_availability_hours int, resume_summary text,
--   profile_embedding vector(384), created_at timestamptz, updated_at timestamptz

create table if not exists public.student_public_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  full_name text,
  headline text,
  -- [{ "key": "lab_vibe", "answer": "…" }], keys from PROFILE_PROMPTS in lib/profile.ts
  prompts jsonb not null default '[]',
  linkedin_url text,
  github_url text,
  photo_path text,
  resume_path text,
  -- When the "finish your profile" pop-up was dismissed; null = not yet shown.
  reminder_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.student_public_profiles enable row level security;

drop policy if exists "student_public_profiles readable by signed-in users" on public.student_public_profiles;
create policy "student_public_profiles readable by signed-in users"
  on public.student_public_profiles for select to authenticated using (true);

drop policy if exists "student_public_profiles insert own" on public.student_public_profiles;
create policy "student_public_profiles insert own"
  on public.student_public_profiles for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "student_public_profiles update own" on public.student_public_profiles;
create policy "student_public_profiles update own"
  on public.student_public_profiles for update to authenticated using (user_id = auth.uid());

-- ---------- Storage: photo and resume ----------
-- Private bucket; pages hand out short-lived signed URLs to signed-in users.
-- Objects live under <user_id>/, and only the owner can write there.
insert into storage.buckets (id, name, public)
values ('profile-files', 'profile-files', false)
on conflict (id) do nothing;

drop policy if exists "profile-files readable by signed-in users" on storage.objects;
create policy "profile-files readable by signed-in users"
  on storage.objects for select to authenticated
  using (bucket_id = 'profile-files');

drop policy if exists "profile-files insert own folder" on storage.objects;
create policy "profile-files insert own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile-files update own folder" on storage.objects;
create policy "profile-files update own folder"
  on storage.objects for update to authenticated
  using (bucket_id = 'profile-files' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "profile-files delete own folder" on storage.objects;
create policy "profile-files delete own folder"
  on storage.objects for delete to authenticated
  using (bucket_id = 'profile-files' and (storage.foldername(name))[1] = auth.uid()::text);
