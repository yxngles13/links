-- supabase/migrations/20261021000000_ai_credits.sql
--
-- Daily AI credits, so one busy user can't use up the shared Groq quota.
-- Each AI action (refresh matches, refresh a contact's summary/draft, …)
-- costs 1 credit; the allowance resets at midnight Pacific.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run.
--
-- Users can read their own usage but never write it: the only way to spend
-- is spend_ai_credit() below, which runs as the table owner. The daily
-- limit (5) lives here, not in the request, so nobody can raise their own.
-- Keep it in sync with DAILY_CREDITS in lib/credits.ts.

create table if not exists public.ai_credit_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  used int not null default 0,
  primary key (user_id, day)
);

alter table public.ai_credit_usage enable row level security;

drop policy if exists "ai_credit_usage readable by owner" on public.ai_credit_usage;
create policy "ai_credit_usage readable by owner"
  on public.ai_credit_usage for select to authenticated using (user_id = auth.uid());

-- Spends one credit for the signed-in user. Returns false when today's
-- credits are used up (or nobody is signed in). Atomic, so two requests at
-- once can't both take the last credit.
create or replace function public.spend_ai_credit()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'America/Los_Angeles')::date;
  spent int;
begin
  if uid is null then
    return false;
  end if;
  insert into public.ai_credit_usage (user_id, day, used)
  values (uid, today, 1)
  on conflict (user_id, day) do update
    set used = ai_credit_usage.used + 1
    where ai_credit_usage.used < 5
  returning used into spent;
  return spent is not null;
end;
$$;

create or replace function public.ai_credits_left()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select greatest(0, 5 - coalesce((
    select used from public.ai_credit_usage
    where user_id = auth.uid() and day = (now() at time zone 'America/Los_Angeles')::date
  ), 0))
$$;

revoke all on function public.spend_ai_credit() from public, anon;
revoke all on function public.ai_credits_left() from public, anon;
grant execute on function public.spend_ai_credit() to authenticated;
grant execute on function public.ai_credits_left() to authenticated;
