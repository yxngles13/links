-- supabase/migrations/20261022000000_feedback.sql
--
-- Answers from the exit / "Feedback" survey. Read them in the Supabase
-- dashboard (Table Editor > feedback); users can submit but never read.
--
-- Run once in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- Safe to re-run.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  rating int check (rating between 1 and 5),
  features text[] not null default '{}',
  reason text,
  comment text check (char_length(comment) <= 1000),
  page text,
  trigger text check (trigger in ('exit', 'button')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback insert own" on public.feedback;
create policy "feedback insert own"
  on public.feedback for insert to authenticated with check (user_id = auth.uid());
