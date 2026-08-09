-- Run this in the Supabase SQL editor to set up the schema.

create table public.statuses (
  id          text    primary key,
  user_id     uuid    references auth.users(id) on delete cascade not null,
  label       text    not null,
  color       text    not null,
  sort_order  integer not null default 0
);

create table public.projects (
  id      text primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name    text not null,
  color   text not null
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

-- Row-level security: each user can only access their own rows
alter table public.statuses enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;

create policy "Users own their statuses" on public.statuses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own their projects" on public.projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users own their tasks" on public.tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
