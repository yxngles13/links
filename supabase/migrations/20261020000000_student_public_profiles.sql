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
  -- auth.users, not public.profiles: not every account has a profiles row.
  user_id uuid primary key references auth.users (id) on delete cascade,
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

-- The app validates all of this too, but rows can also be written straight
-- through the API with a user's own session, so the database enforces it.
alter table public.student_public_profiles drop constraint if exists student_public_profiles_shape;
alter table public.student_public_profiles add constraint student_public_profiles_shape check (
  jsonb_typeof(prompts) = 'array'
  and jsonb_array_length(prompts) <= 3
  and char_length(coalesce(headline, '')) <= 120
  and char_length(coalesce(full_name, '')) <= 200
  and (photo_path is null or photo_path like user_id::text || '/%')
  and (resume_path is null or resume_path like user_id::text || '/%')
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
-- 2.5 MB cap and allowed types match lib/profile.ts (photo 1.5 MB, resume 2.5 MB).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-files', 'profile-files', false, 2621440, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

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
