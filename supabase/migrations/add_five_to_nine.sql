-- Five to Nine: weekly before/work/after-work planner. Activities are
-- independent of the Task/board model and live in their own tables.
-- A recurring item is a "series" (title/category/slot + weekly-by-weekday
-- pattern); an "override" row lets exactly one occurrence of a series be
-- moved to a different day/slot without touching the recurring pattern
-- itself (the "this occurrence only" edit — like iCal's EXDATE+override).
-- One-off (non-recurring) items never get an override row — moving one
-- just updates its series row directly, since there's only one occurrence.
-- Run this once in the Supabase SQL editor.

create table if not exists public.activity_series (
  id           text    primary key,
  user_id      uuid    references auth.users(id) on delete cascade not null,
  title        text    not null,
  category     text    not null check (category in ('exercise', 'chores', 'fun', 'social')),
  slot         text    not null check (slot in ('before', 'work', 'after')),
  anchor_date  text    not null,
  days_of_week jsonb,
  created_at   bigint  not null
);

create index if not exists activity_series_user_idx on public.activity_series (user_id);

create table if not exists public.activity_overrides (
  id              text primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  series_id       text not null references public.activity_series(id) on delete cascade,
  occurrence_date text not null,
  moved_date      text,
  moved_slot      text check (moved_slot in ('before', 'work', 'after')),
  unique (series_id, occurrence_date)
);

create index if not exists activity_overrides_user_idx on public.activity_overrides (user_id);
create index if not exists activity_overrides_series_idx on public.activity_overrides (series_id);

alter table public.activity_series    enable row level security;
alter table public.activity_overrides enable row level security;

drop policy if exists "Users own their activity series" on public.activity_series;
create policy "Users own their activity series" on public.activity_series
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users own their activity overrides" on public.activity_overrides;
create policy "Users own their activity overrides" on public.activity_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
