# Mobile support plan — FocusStacks

Instructions for Claude Code. Work through the phases **in order**, one phase per
commit (or PR), on the `mobile` branch. After each phase run `npm run build`,
`npm run lint` and `npm test`. Then check the app in a browser at **375×812**
(iPhone), **768×1024** (tablet) and **1440×900** (desktop). Desktop must look and
behave exactly as it does today unless a step says otherwise.

## Ground rules (apply to every phase)

1. **Desktop is the baseline and must not regress.** Put every mobile-only style
   change inside one of these media queries, defined once in `src/index.css`:
   - `@media (max-width: 640px)`: phone layout
   - `@media (hover: none)`: devices that can't hover (show hover-only controls)
   - `@media (pointer: coarse)`: touch input (bigger hit targets, 16px inputs)

   Don't change the existing un-queried desktop rules unless a step says to.
2. **Never unmount `FocusZone`.** `App.tsx` keeps it mounted on purpose (wrapped
   in `display: contents/none`) so the timer and pop-out survive view changes.
   Mobile layout changes to Focus must be CSS, or must happen *inside*
   FocusZone, and must not put FocusZone under a breakpoint-dependent parent.
3. **Prefer CSS over JS branching.** If a component really does need different
   markup on phones, add one shared `useMediaQuery(query)` hook in
   `src/utils/useMediaQuery.ts` and use it everywhere. Don't scatter
   `window.innerWidth` checks. Keep any state that matters (inputs being typed,
   open drawers) *above* the branch, so rotating a tablet doesn't lose it.
4. Match the existing code style: plain CSS in `src/index.css` (BEM-ish
   `block--modifier` classes, CSS variables for colours), function components,
   and no new UI libraries.
5. Every interactive control must be reachable **without hover, double-click,
   right-click or a keyboard shortcut**.

---

## Phase 1: Foundations (low risk, CSS/HTML only)

1. **Viewport height.** `.app { height: 100vh }` (index.css ~L49) cuts off the
   bottom of the app behind the iOS/Android browser toolbars. Change it to
   `height: 100vh; height: 100dvh;` (the second value wins where supported). Do
   the same for the other `100vh` uses (`body`, `.auth-*`, the `max-height:
   calc(100vh - 48px)` on the modals and the PiP container). Desktop: no visible
   change.
2. **Safe areas.** In `index.html`, change the viewport meta to
   `width=device-width, initial-scale=1, viewport-fit=cover`. Add
   `padding-top: env(safe-area-inset-top)` to `.app-header` and bottom/side
   insets wherever content touches the screen edge (and later to the bottom tab
   bar from Phase 2). Desktop: insets resolve to 0.
3. **Stop iOS from zooming in on inputs.** Every input/select is 13–14px, and iOS
   zooms the page when you focus a field smaller than 16px. Under
   `@media (pointer: coarse)` set `font-size: 16px` on `.task-input,
   .task-textarea, .task-date-input, .table-cell-input, .table-status-select,
   .quick-add-input, .drawer-title-input, .drawer-date-input,
   .drawer-number-input, .focus-selector, .focus-setting-input, .auth-input,
   .column-label-input` and any other `input/select/textarea`.
4. **Hover-only controls are invisible on touch.** These use `opacity: 0`
   until `:hover`, so a phone user never sees them:
   - `.task-card-btns` (Focus / Open / Complete / Delete on each task card)
   - `.column-remove` (remove column)
   - `.board-section-delete` and `.board-section-drag-handle` (project header)

   Under `@media (hover: none)` set them to `opacity: 1`. For `.task-card-btns`,
   also leave room so the buttons don't sit on top of the title (e.g.
   `padding-right` on `.task-card-body`).
5. **Touch target size.** Under `@media (pointer: coarse)` give `.btn--icon`,
   `.task-card-btn`, `.focus-timeline-nav-btn`, `.activity-card-check`,
   `.activity-card-log-btn`, `.nav-menu-item`, `.color-swatch` and the view
   toggle buttons a hit area of at least 40×40px. Use padding or `min-width/height`
   so the icons stay the same size.
6. **Modals and drawers must fit a 320–375px screen.**
   - `.modal` is a fixed `width: 340px` with no max. Add
     `max-width: calc(100vw - 32px); max-height: calc(100dvh - 32px);
     overflow-y: auto;`. This is harmless on desktop.
   - `.drawer` (TaskDrawer / CreateTaskDrawer) is `width: 440px`. At
     `max-width: 640px` make it `width: 100vw`, and make `.drawer-fields`
     (2-column grid) a single column.
   - Check that `AddSessionModal`, `ExerciseLogModal`, `StretchDetailModal`,
     `RoutineManager`, `CategoryManager` and `ActivityDrawer` all scroll inside
     themselves when the on-screen keyboard is open.
7. **Header menu outside-click.** `App.tsx` closes the ⋮ menu on `mousedown`.
   Switch the listener to `pointerdown` so it behaves the same with touch and
   pen. On desktop it behaves identically.
8. **Keyboard hints.** Hide `.quick-add-kbd` (⌘K) under `@media (hover: none)`.
   At ≤640px, shorten the Quick Add placeholder to `"Add a task…"`. Keep the
   syntax help (`/project #date @mins !notes`) reachable some other way, e.g.
   show it in the popover when the field is focused and empty.

## Phase 2: App shell and navigation (moderate)

The header currently holds brand, quick-add, focus-session pill, a four-button
view toggle with text labels, and the ⋮ menu. On a phone this wraps into 3+
rows and pushes the content down.

At `max-width: 640px`:
1. **Bottom tab bar.** Restyle `.view-toggle` as a fixed bottom bar
   (`position: fixed; bottom: 0; left: 0; right: 0`, with safe-area padding at
   the bottom). Each tab shows its icon (⊞ ≡ ◎ ▦) above a short label (Board, List,
   Focus, 5–9). Give the main content area matching `padding-bottom` so nothing
   hides behind the bar. Try to do this in CSS alone, without moving the JSX. If
   the labels need different markup, wrap the long label in a span that you can
   hide (for example `Five to Nine` → `5–9`).
2. **Compact header.** Row 1: brand mark (icon only, or a smaller wordmark) +
   focus-session pill + ⋮ menu. Row 2: full-width quick-add (this already
   happens below 960px). Hide `.focus-zone-badge`, because the active tab already
   shows which view you're on.
3. The ⋮ menu panel should be no wider than the viewport
   (`max-width: calc(100vw - 24px)`).

Desktop impact: none if it's done inside the media query. The tab bar markup is
the same element, just restyled.

## Phase 3: Touch drag-and-drop (moderate; touches shared code)

Every DnD context uses `PointerSensor` with `distance: 5`. On touch, that means
**any swipe that starts on a card begins a drag instead of scrolling**. This
breaks scrolling on the Board, the Five to Nine grid and the project list.

1. Create one shared helper, for example `useDndSensors()` in
   `src/utils/dndSensors.ts`, that returns:
   - `MouseSensor` with `activationConstraint: { distance: 5 }` (same as
     desktop today)
   - `TouchSensor` with `activationConstraint: { delay: 250, tolerance: 8 }`
     (press and hold to drag; a quick swipe scrolls)
   - `KeyboardSensor` wherever it's already used (CategoryManager,
     RoutineManager)
2. Use it in `Board.tsx`, `App.tsx` (project reorder), `FiveToNine.tsx`,
   `CategoryManager.tsx` and `RoutineManager.tsx`.
3. Add `-webkit-touch-callout: none; user-select: none;` to draggable cards
   (`.task-card`, `.activity-card`) under `(pointer: coarse)` so a long-press
   doesn't open the iOS text/callout menu.
4. Give a small visual cue when a long-press arms a drag (e.g. a scale or shadow
   on the overlay). `DragOverlay` already exists, so reuse it.
5. **Don't rely on dragging to change data on phones.** Make sure there's a tap
   path for each action:
   - Change a task's status: TaskDrawer already has a status `<select>`. That
     works, just check it's easy to find on mobile.
   - Reorder projects: there's no alternative. Add "Move up / Move down" to the
     project header on touch, or accept long-press drag only.
   - Move a single Five to Nine occurrence to another day/slot: today this can
     **only** be done by dragging (`moveOccurrence`). ActivityDrawer edits the
     *series* (anchorDate/slot), which isn't the same thing. Add a "Move this
     occurrence…" control (date + slot) that calls `moveOccurrence`.

Desktop impact: **this changes shared code.** `MouseSensor` + `TouchSensor`
should behave the same as `PointerSensor` for a mouse, but re-test every
drag interaction on desktop: card between columns, card reorder within a
column, recurring task dropped on Complete (it must still spawn the next
occurrence only on drop), project reorder, Five to Nine moves, category and
routine reorder. Pen/stylus input will now go through the touch path on some
browsers.

## Phase 4: Board view (significant)

Problems on a phone: columns are fixed at 300px with horizontal scroll. Each
column has `max-height: 520px` with its own inner scroll, so there's a scroll
area inside a scroll area inside a scroll area. Renaming a column needs a
double-click (`Column.tsx` `onDoubleClick`), which touch devices don't
reliably support.

At `max-width: 640px`:
1. Make `.board` a horizontal **scroll-snap** carousel: columns at
   `width: calc(100vw - 48px)`, `scroll-snap-type: x mandatory`,
   `scroll-snap-align: start`. Also override `.board--fit`, which forces
   `flex: 1` columns.
2. Remove `max-height: 520px` from `.column` so the page scrolls vertically
   instead of the column.
3. Optional (recommended): add a small row of status "pills" above the board
   that scrolls the carousel to each column and shows its count, so users know
   other columns exist.
4. Make column rename reachable without double-click. Add a "Rename" button next
   to the remove ✕, shown under `(hover: none)`, or make a single tap on the
   label start editing on touch devices.
5. Collapsible project sections already work with tap. Make sure the sticky
   `.board-section-header` padding drops from 24px to 16px.

## Phase 5: List view (significant)

`TaskTable` is an 8-column `<table>` (Title, Status, Project, Assignee, Due,
Repeat, Description, Actions) with inline-editable inputs in every cell. It
can't be used at 375px. `.task-list-scroll` also caps the height at `48vh`, which
creates another nested scroller.

Recommended approach: **turn each row into a card on phones with CSS, and open
the existing TaskDrawer on tap for full editing.**

1. At `max-width: 640px`: `display: block` on `table, thead, tbody, tr, td`.
   Hide `thead`. Each `tr` becomes a card showing Title (full width), then a
   meta line with Status dot+select, Due date, and a recurrence badge. Hide
   Assignee/Repeat/Description cells, or show Description as a muted single
   line.
2. Replace header click-to-sort with a compact "Sort by" `<select>` above the
   list (rendered by TaskTable, shown only on phones via CSS).
3. Tapping the card body opens `TaskDrawer` for that task (desktop keeps inline
   editing). Use a `useMediaQuery('(max-width: 640px)')` check in the row's
   click handler, or a dedicated "open" button that only shows on mobile.
4. The "add task" row becomes a simple title input + Add button; or hide it on
   mobile, since Quick Add in the header already covers this.
5. Remove the `max-height: 48vh` on `.task-list-scroll` so the page scrolls
   normally.
6. The expanding recurrence row (`colSpan={8}`) has to render correctly in
   block layout.

Desktop impact: none if it's done with CSS and a click handler that only fires on
mobile. Watch out: `TaskRow` keeps local `title`/`description` state. Don't
render a second copy of the row for mobile, or those edits will get out of sync.

## Phase 6: Focus Zone (significant)

Layout today: a left Task Queue drawer (260px, collapses to 36px), the timer in
the middle, and a right Session History drawer (260px, collapses to 36px, **open
by default**). On a 375px screen the two drawers leave about 0px for the timer.

At `max-width: 640px`:
1. Hide both side rails. Show the queue and history as **bottom sheets** (or
   full-screen overlays) opened from two buttons under the timer: "Task queue"
   and "History". Reuse the existing drawer content. Only the container
   styling changes. History should start **closed** on phones
   (`historyOpen` currently defaults to `true`).
2. Scale the timer: `.focus-timer` is 243×320 and `.focus-ring` is fixed. Use
   `width: min(243px, 70vw)` and keep the aspect ratio.
3. `.focus-settings-grid` (label + control) should stack when needed. Settings
   inputs get the 16px rule from Phase 1.
4. **SessionTimeline drag-to-create blocks scrolling.** `.focus-timeline-track`
   has `touch-action: none` and starts a drag selection on `pointerdown`. On a
   phone that means you can't scroll the timeline at all. Under
   `(pointer: coarse)`, use `touch-action: pan-y` and either (a) only start a
   drag selection on `pointerType === 'mouse' || 'pen'`, with touch users
   using the existing "+ Add session" button, or (b) require a 300ms long-press
   before a touch starts a selection. Option (a) is simpler and safer.
5. Pop-out timer: `documentPictureInPicture` is Chromium-desktop only, and the
   button already hides when it isn't supported. No change needed, but make
   sure nothing assumes it's there.
6. **Platform limitation to document (not fix in CSS):** mobile browsers suspend
   JS when the tab is in the background or the phone is locked. The timer
   already re-syncs on `visibilitychange` (good), but the end-of-session sound
   won't play while the phone is locked, and iOS needs a user tap before
   `AudioContext` can make sound. Make sure the AudioContext is
   created/resumed inside the Start button's click handler. Add a short note in
   the UI or README. Web Push / notifications are out of scope.

Desktop impact: none if it's done under the media query. Don't change the
`historyOpen` default for desktop. Make it depend on the breakpoint at first
mount.

## Phase 7: Five to Nine (significant)

The week is a 7-column grid. Below 1100px it becomes a horizontal strip of
220px day columns. On a phone you see about 1.5 days, and moving activities
only works by dragging.

At `max-width: 640px`:
1. Show the week as a **vertical agenda**: one day per block, stacked
   (`grid-template-columns: 1fr; grid-auto-flow: row`). Each day block shows
   its slot cards. Scroll today into view on mount (the existing
   `day-column-header--today` class marks it).
   - Alternative: one-day view with ‹ › day paging. The agenda is simpler and
     keeps the week overview, so start with that.
2. `.five-to-nine-header`: wrap the week nav and actions so they fit. Drop
   `min-width: 170px` on the range label.
3. Each `ActivityCard` has its drag listeners on the whole card plus
   `onClick={onEdit}`. With the Phase 3 TouchSensor delay, a tap edits and a
   long-press drags. Check the checkbox and ✎ log button still work, because
   they stop `pointerdown` propagation.
4. Add the "Move this occurrence…" control from Phase 3.5.
5. CategoryManager, RoutineManager, StretchDetailModal, ExerciseLogModal and
   ActivityDrawer already have `max-width: calc(100vw - 32px)`. Check their
   inner rows (`.exercise-routine-row`, `.category-row`, etc.) wrap rather than
   overflow at 375px.

## Phase 8: Polish (optional)

- Information that's only in `title=` tooltips can't be seen on touch:
  "Double-click to rename", stretch progress, "Moved from its usual day/slot",
  focus-session pill. Show it in the UI or use `aria-label`.
- Add a web app manifest (`public/manifest.webmanifest`), `apple-touch-icon`,
  and `<meta name="theme-color">` (light/dark) so the app can be installed to the
  home screen and run full-screen.
- Remove leftover Vite template CSS in `src/App.css` if it isn't imported
  (it isn't: `App.tsx` imports only `index.css`).
- `window.confirm` works on mobile but looks jarring. Leave it for now.

---

## Desktop impact summary

| Change | Desktop impact | Risk |
|---|---|---|
| `100dvh`, safe-area insets, viewport-fit | None | Low |
| 16px inputs, bigger hit targets, visible hover controls (inside `pointer: coarse` / `hover: none`) | None on mouse desktops. **Touchscreen laptops and iPads count as coarse/no-hover**, so they'll get the always-visible buttons. That's intended. | Low |
| Modal `max-width` / drawer full width ≤640px | None at desktop widths | Low |
| Menu `mousedown` → `pointerdown` | Same behaviour | Low |
| Bottom tab bar, compact header, Board carousel, List cards, Focus sheets, 5–9 agenda (all ≤640px) | None on a normal desktop window. A desktop browser resized below 640px **will** get the phone layout. | Low–Medium |
| Shared DnD sensor change (Mouse + Touch instead of Pointer) | **Changes shared code paths.** It should behave the same, but every desktop drag interaction needs re-testing. | **Medium** |
| SessionTimeline: touch no longer drag-creates | Mouse unchanged if gated on `pointerType` | Low |
| New controls: column "Rename", "Move this occurrence", project move up/down | If they're visible on desktop too, the UI changes slightly (an improvement). Gate them with `(hover: none)` if you want desktop untouched. | Low |
| Anything that conditionally renders via `useMediaQuery` | Crossing the breakpoint (rotating a tablet, resizing a window) remounts that subtree and **loses local state**. Never apply this to `FocusZone`. | Medium |

## Suggested prompt to start each phase

> Read `docs/mobile-plan.md` and implement **Phase N** only. Follow the ground
> rules. When done, list what changed, run build/lint/test, and confirm which
> desktop behaviours you re-checked.
