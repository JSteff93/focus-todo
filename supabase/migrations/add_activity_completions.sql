-- One-time migration for existing databases. Run this once in the Supabase
-- SQL editor.
--
-- Five to Nine activities can be checked off as done. Each row marks one
-- occurrence (series + its natural occurrence date) as done; unchecking
-- deletes the row. Keyed like activity_overrides so a recurring
-- occurrence keeps its done state when moved to another day/slot.

create table if not exists public.activity_completions (
  id              text primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  series_id       text not null references public.activity_series(id) on delete cascade,
  occurrence_date text not null,
  unique (series_id, occurrence_date)
);

create index if not exists activity_completions_user_idx on public.activity_completions (user_id);

alter table public.activity_completions enable row level security;

drop policy if exists "Users own their activity completions" on public.activity_completions;
create policy "Users own their activity completions" on public.activity_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
