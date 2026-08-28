-- One-time migration for existing databases created before focus session
-- history was synced to Supabase. Run this once in the Supabase SQL editor.
--
-- Session history previously lived only in each browser's localStorage, so
-- it didn't persist across devices and was lost if local storage was
-- cleared. This adds a table to store it per-user, in the same style as
-- the existing tasks/statuses/projects tables.

create table if not exists public.focus_sessions (
  id               text    primary key,
  user_id          uuid    references auth.users(id) on delete cascade not null,
  task_id          text    not null,
  task_title       text    not null,
  session_secs     integer not null,
  cumulative_secs  integer not null,
  completed_at     bigint  not null,
  task_completed   boolean not null default false
);

create index if not exists focus_sessions_user_completed_idx on public.focus_sessions (user_id, completed_at);

alter table public.focus_sessions enable row level security;

drop policy if exists "Users own their focus sessions" on public.focus_sessions;
create policy "Users own their focus sessions" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
