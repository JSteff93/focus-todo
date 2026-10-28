-- One-time migration for existing databases. Run this once in the Supabase
-- SQL editor.
--
-- Five to Nine categories become user-managed rows instead of a hard-coded
-- list. activity_series.category keeps holding a category id; the four
-- built-ins keep the ids they always had ('exercise', 'chores', 'fun',
-- 'social'), so existing activities resolve without being rewritten.

create table if not exists public.activity_categories (
  id          text    not null,
  user_id     uuid    references auth.users(id) on delete cascade not null,
  label       text    not null,
  color       text    not null,
  sort_order  integer not null default 0,
  -- Exercise-specific features attach to this flag, not the label. The app
  -- keeps it to at most one row per user.
  is_exercise boolean not null default false,
  -- Composite key: every user has their own 'exercise'/'chores'/… rows.
  primary key (user_id, id)
);

alter table public.activity_categories enable row level security;

drop policy if exists "Users own their activity categories" on public.activity_categories;
create policy "Users own their activity categories" on public.activity_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- category is now any category id, not one of four fixed values.
alter table public.activity_series drop constraint if exists activity_series_category_check;

-- Seed the four built-ins for every user who already has activities (the app
-- also seeds them on first load for anyone who has none yet).
insert into public.activity_categories (id, user_id, label, color, sort_order, is_exercise)
select c.id, u.user_id, c.label, c.color, c.sort_order, c.is_exercise
from (select distinct user_id from public.activity_series) u
cross join (values
  ('exercise', 'Exercise', '#f59e0b', 0, true),
  ('chores',   'Chores',   '#8b5cf6', 1, false),
  ('fun',      'Fun',      '#ec4899', 2, false),
  ('social',   'Social',   '#3b82f6', 3, false)
) as c(id, label, color, sort_order, is_exercise)
on conflict (user_id, id) do nothing;
