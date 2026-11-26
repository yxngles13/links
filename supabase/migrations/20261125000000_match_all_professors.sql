-- supabase/migrations/20261125000000_match_all_professors.sql
--
-- match_opportunities only returned professors with is_available = true.
-- 20261124000000_professor_browse.sql set every professor to false, so
-- matching found nobody and new students landed on "No matches yet".
-- Availability is never confirmed (the app shows "Ask to confirm"), so
-- matching now ranks every professor.
--
-- The function was first made in the dashboard, not in a migration, so
-- this drops whatever version exists and defines it here. Return columns
-- are what lib/matching.ts reads.
--
-- Safe to re-run.

do $$
declare
  f regprocedure;
begin
  for f in
    select oid::regprocedure from pg_proc
    where proname = 'match_opportunities' and pronamespace = 'public'::regnamespace
  loop
    execute 'drop function ' || f;
  end loop;
end $$;

create function public.match_opportunities(query_embedding vector, match_count int default 5)
returns table (
  opportunity_id public.opportunities.id%type,
  professor_name public.opportunities.professor_name%type,
  department public.opportunities.department%type,
  lab_name public.opportunities.lab_name%type,
  project_description public.opportunities.project_description%type,
  similarity float8
)
language sql stable
set search_path = public, extensions
as $$
  select o.id, o.professor_name, o.department, o.lab_name, o.project_description,
         1 - (o.opportunity_embedding <=> query_embedding) as similarity
  from public.opportunities o
  where o.opportunity_embedding is not null
  order by o.opportunity_embedding <=> query_embedding
  limit match_count;
$$;

grant execute on function public.match_opportunities(vector, int) to authenticated;
