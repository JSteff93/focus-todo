# FocusStacks

A personal task board with a built-in focus timer and a weekly after-hours
planner. Data is stored per user in Supabase, so it syncs across devices.
It works on desktop and phones, and can be installed as a home-screen app.

## Views

Switch views with the header toggle (a bottom tab bar on phones), or press
<kbd>G</kbd> then <kbd>B</kbd> / <kbd>L</kbd> / <kbd>F</kbd> / <kbd>N</kbd>.
<kbd>?</kbd> lists all keyboard shortcuts.

- **Board**: a kanban board grouped by project, with drag-and-drop between
  your own columns (statuses). Supports due dates, recurring tasks and focus
  estimates. Tasks completed before today drop off the board.
- **List**: the same tasks as a sortable table.
- **Focus**: a focus timer for one task at a time. It plays a chime when the
  session ends and keeps a timeline of today's sessions, which you can edit or
  add to by hand. On desktop Chrome and Edge the timer can pop out into its
  own small window.
- **Five to Nine**: a weekly planner for time before and after work, with
  one-off and repeating activities, your own categories, and exercise
  routines and logs.

The Quick Add bar at the top takes `/project`, `#date`, `@mins` and `!notes`,
for example `Write report /work #fri @45`.

## Stack

React 19, TypeScript and Vite, with [dnd-kit](https://dndkit.com) for drag and
drop and [Supabase](https://supabase.com) for auth and the Postgres database.
Styles are plain CSS in `src/index.css`. Tests use Vitest.

## Setup

1. **Install** (Node 20.19+ or 22.12+, as Vite requires):
   ```sh
   npm install
   ```
2. **Create a Supabase project.** In its SQL editor, run
   [`supabase/schema.sql`](supabase/schema.sql). That creates every table and
   its row-level security policies, so a new database doesn't need the
   migrations.
3. **Add your keys.** Copy `.env.example` to `.env.local` and fill in the
   project URL and anon key (Project Settings → API):
   ```sh
   cp .env.example .env.local
   ```
   `.env.local` is git-ignored. Don't commit real keys.
4. **Create a user.** The app only signs in, so add users under
   Authentication → Users in the Supabase dashboard. Default columns and
   projects are created on the first sign-in.
5. **Run it:**
   ```sh
   npm run dev
   ```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the dev server with hot reload |
| `npm run build` | Type-checks, then builds to `dist/` |
| `npm run preview` | Serves the built `dist/` locally |
| `npm run lint` | Runs ESLint |
| `npm test` | Runs the Vitest unit tests once |

## Database changes and migrations

Migrations are **run by hand**. Nothing applies them automatically.

- `supabase/schema.sql` always shows the current full schema, for new
  databases.
- `supabase/migrations/*.sql` each upgrade an existing database by one step.
  Run a new one once in the Supabase SQL editor. Its header comment says what
  it does and whether it has to run after another migration.

Any schema change needs both: a new migration file **and** a matching update to
`schema.sql`.

## Mobile

Desktop is the baseline. Phone styles live under `@media (max-width: 640px)`,
`(hover: none)` or `(pointer: coarse)`, so desktop isn't affected. The plan
and the rules behind them are in [docs/mobile-plan.md](docs/mobile-plan.md).

**Known limitation: the timer sound on phones.** Mobile browsers pause web
pages that are in the background or on a locked phone. The timer catches up
when you come back, so the time stays right, but the end-of-session chime
won't play while the phone is locked or another app is in front. iOS also
only allows sound after a tap, so the chime is set up when you press Start.
Push notifications aren't supported.
