-- supabase/migrations/20261019000000_mentor_linkedin.sql
--
-- LinkedIn link on mentor profiles, shown to students next to each mentor.
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run.
alter table public.mentor_profiles add column if not exists linkedin_url text;
