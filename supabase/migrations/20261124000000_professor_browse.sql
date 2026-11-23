-- supabase/migrations/20261124000000_professor_browse.sql
--
-- Professors tab: students can pick any professor to get a draft, which
-- makes them a match. picked_at marks those rows so re-matching never
-- removes them (see staleMatchIds in lib/profile.ts).
--
-- Also: no professor is marked as taking students any more. The seed set
-- is_available = true only because the faculty page didn't say otherwise
-- (see scripts/seed-opportunities.ts); the app shows "Ask to confirm".
--
-- Safe to re-run.

alter table public.match_recommendations add column if not exists picked_at timestamptz;

update public.opportunities set is_available = false where is_available is distinct from false;
