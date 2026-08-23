-- One-time migration for existing databases created before project drag-reordering
-- was added. Run this once in the Supabase SQL editor.
--
-- The app already works without it (fetchProjects falls back to an unordered
-- query), but reordering projects on the board won't persist across reloads
-- or devices until this column exists.

alter table public.projects
  add column if not exists sort_order integer not null default 0;

-- Give existing rows a stable initial order (by current insertion order).
with ordered as (
  select id, row_number() over (partition by user_id order by id) - 1 as rn
  from public.projects
)
update public.projects p
set sort_order = ordered.rn
from ordered
where p.id = ordered.id;
