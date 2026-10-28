import type { Status, Task } from '../types';

// How far back "recently completed" tasks stay pickable when logging a past
// session, in calendar days including today (2 = today and yesterday).
export const RECENT_COMPLETED_DAYS = 2;

// The Focus Zone's Task Queue: To-Do/Doing tasks, earliest due first.
export function getActiveFocusTasks(tasks: Task[], statuses: Status[]): Task[] {
  const sortedActiveTasks = tasks
    .filter(t => {
      const s = statuses.find(st => st.id === t.statusId);
      if (!s) return false;
      const label = s.label.toLowerCase();
      return s.id === 'todo' || s.id === 'doing' || label === 'to-do' || label === 'todo' || label === 'doing' || label === 'in progress';
    })
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });

  // A recurring task should only ever show one active instance at a time —
  // keeps the earliest-due (current) occurrence per series, identified by
  // title since each occurrence is its own row with its own id. This also
  // papers over any already-duplicated rows from before moveTask's commit
  // flag (see store.ts) stopped the Board's drag-over hover handler from
  // spawning a recurring task's next occurrence without a real drop.
  const seenRecurringTitles = new Set<string>();
  return sortedActiveTasks.filter(t => {
    if (!t.recurrence) return true;
    if (seenRecurringTitles.has(t.title)) return false;
    seenRecurringTitles.add(t.title);
    return true;
  });
}

export interface SessionPickableTasks {
  active: Task[];
  // Most recently completed first. Not recurring-deduped: each completed
  // occurrence is its own piece of finished work to log time against.
  recentCompleted: Task[];
}

// What the Add/Edit Session modal can log time against — the Task Queue plus
// anything finished since the start of the recent window (local time), so
// time can still be logged for work completed before remembering to log it.
export function getSessionPickableTasks(tasks: Task[], statuses: Status[], now: number): SessionPickableTasks {
  const active = getActiveFocusTasks(tasks, statuses);
  const activeIds = new Set(active.map(t => t.id));
  const windowStart = new Date(now);
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - (RECENT_COMPLETED_DAYS - 1));
  const recentCompleted = tasks
    .filter(t => t.completedAt != null && t.completedAt >= windowStart.getTime() && !activeIds.has(t.id))
    .sort((a, b) => b.completedAt! - a.completedAt!);
  return { active, recentCompleted };
}
