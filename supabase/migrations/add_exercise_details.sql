-- One-time migration for existing databases. Run this once in the Supabase
-- SQL editor, after add_activity_categories.sql.
--
-- Five to Nine exercise details: a plan on each activity, an optional log of
-- what was actually done per occurrence, and reusable routines.

-- The plan ({ type, distanceKm?, durationMins?, gymRoutineId?, … }), shown
-- while the activity's category is the exercise one.
alter table public.activity_series add column if not exists details jsonb;

-- What was actually done for one occurrence ({ distanceKm?, durationMins?,
-- notes? }). Unticking now sets done = false instead of deleting the row, so
-- a log survives an untick; existing rows were all ticked, hence the default.
alter table public.activity_completions add column if not exists actual jsonb;
alter table public.activity_completions add column if not exists done boolean not null default true;

-- Reusable routines. 'gym' routines are a label for now; 'stretch' routines
-- carry an ordered list of items.
create table if not exists public.exercise_routines (
  id          text    primary key,
  user_id     uuid    references auth.users(id) on delete cascade not null,
  kind        text    not null check (kind in ('gym', 'stretch')),
  name        text    not null,
  sort_order  integer not null default 0,
  items       jsonb   not null default '[]',
  notes       text    not null default ''
);

create index if not exists exercise_routines_user_idx on public.exercise_routines (user_id);

alter table public.exercise_routines enable row level security;

drop policy if exists "Users own their exercise routines" on public.exercise_routines;
create policy "Users own their exercise routines" on public.exercise_routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Starter gym routines for every existing user who has none yet (the app
-- seeds them for brand-new users).
insert into public.exercise_routines (id, user_id, kind, name, sort_order)
select substr(md5(random()::text || u.id::text || r.name), 1, 8), u.id, 'gym', r.name, r.sort_order
from auth.users u
cross join (values ('Push', 0), ('Pull', 1), ('Legs', 2)) as r(name, sort_order)
where not exists (
  select 1 from public.exercise_routines e where e.user_id = u.id and e.kind = 'gym'
);
