-- One-time migration for existing databases. Run this once in the Supabase
-- SQL editor.
--
-- The Focus Zone timeline gained an "Add Session" modal for manually
-- backfilling past sessions (a real task, a Meeting/Busy Work preset, or a
-- free-form description) and the ability to click one of those entries on
-- the timeline to edit or delete it. This flag distinguishes manually
-- logged entries (editable) from ones a live timer run produced (not
-- editable, since they're tied to pomodoro-count accounting) — it can't be
-- inferred from task_id alone because a manual entry can reference a real
-- task or the Busy Work preset, both of which a live session can also use.

alter table public.focus_sessions add column if not exists manual boolean not null default false;
