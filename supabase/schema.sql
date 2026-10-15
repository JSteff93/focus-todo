-- Run this in the Supabase SQL editor to set up the schema.

create table public.statuses (
  id          text    primary key,
  user_id     uuid    references auth.users(id) on delete cascade not null,
  label       text    not null,
  color       text    not null,
  sort_order  integer not null default 0
);

create table public.projects (
  id          text    primary key,
  user_id     uuid    references auth.users(id) on delete cascade not null,
  name        text    not null,
  color       text    not null,
  sort_order  integer not null default 0
);

create table public.tasks (
  id                   text    primary key,
  user_id              uuid    references auth.users(id) on delete cascade not null,
  title                text    not null,
  description          text    not null default '',
  status_id            text    not null,
  created_at           bigint  not null,
  due_date             text,
  recurrence           jsonb,
  assignee             text,
  project_id           text,
  pomodoro_count       integer not null default 0,
  estimated_focus_mins integer,
  completed_at         bigint,
  sort_order           integer not null default 0
);

create table public.focus_sessions (
  id               text    primary key,
  user_id          uuid    references auth.users(id) on delete cascade not null,
  task_id          text    not null,
  task_title       text    not null,
  session_secs     integer not null,
  cumulative_secs  integer not null,
  completed_at     bigint  not null,
  task_completed   boolean not null default false,
  manual           boolean not null default false
);

create index focus_sessions_user_completed_idx on public.focus_sessions (user_id, completed_at);

-- Five to Nine: weekly before/work/after-work planner, independent of the
-- Task/board model. A "series" is an activity (one-off or weekly-recurring);
-- an "override" moves/edits exactly one occurrence of a recurring series
-- without touching the pattern itself.
create table public.activity_series (
  id           text    primary key,
  user_id      uuid    references auth.users(id) on delete cascade not null,
  title        text    not null,
  category     text    not null check (category in ('exercise', 'chores', 'fun', 'social')),
  slot         text    not null check (slot in ('before', 'work', 'after')),
  anchor_date  text    not null,
  days_of_week jsonb,
  created_at   bigint  not null
);

create index activity_series_user_idx on public.activity_series (user_id);

create table public.activity_overrides (
  id              text primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  series_id       text not null references public.activity_series(id) on delete cascade,
  occurrence_date text not null,
  moved_date      text,
  moved_slot      text check (moved_slot in ('before', 'work', 'after')),
  unique (series_id, occurrence_date)
);

create index activity_overrides_user_idx on public.activity_overrides (user_id);
create index activity_overrides_series_idx on public.activity_overrides (series_id);

-- One row per occurrence the user has checked off as done.
create table public.activity_completions (
  id              text primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  series_id       text not null references public.activity_series(id) on delete cascade,
  occurrence_date text not null,
  unique (series_id, occurrence_date)
);

create index activity_completions_user_idx on public.activity_completions (user_id);

-- Row-level security: each user can only access their own rows
alter table public.statuses           enable row level security;
alter table public.projects           enable row level security;
alter table public.tasks              enable row level security;
alter table public.focus_sessions     enable row level security;
alter table public.activity_series    enable row level security;
alter table public.activity_overrides enable row level security;
alter table public.activity_completions enable row level security;

create policy "Users own their statuses" on public.statuses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own their projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own their tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own their focus sessions" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own their activity series" on public.activity_series
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own their activity overrides" on public.activity_overrides
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own their activity completions" on public.activity_completions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
