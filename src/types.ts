export interface Recurrence {
  unit: 'day' | 'week' | 'month';
  interval: number;
  daysOfWeek?: number[]; // 0=Sun … 6=Sat, only used when unit='week'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  statusId: string;
  createdAt: number;
  dueDate?: string; // YYYY-MM-DD
  recurrence?: Recurrence;
  assignee?: string;
  projectId?: string;
  pomodoroCount?: number;
  estimatedFocusMins?: number;
  completedAt?: number;
}

export interface Status {
  id: string;
  label: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}

export interface SessionEntry {
  id: string;
  taskId: string;
  taskTitle: string;
  sessionSecs: number;
  cumulativeSecs: number;
  completedAt: number;
  taskCompleted?: boolean;
  // True for entries logged via the Focus Zone timeline's "Add Session"
  // modal rather than a completed/paused timer run — only these are
  // editable after the fact (see SessionTimeline's click-to-edit).
  manual?: boolean;
}

export type ActivityCategory = 'exercise' | 'chores' | 'fun' | 'social';
export type ActivitySlot = 'before' | 'work' | 'after';

export interface WeeklyRecurrence {
  daysOfWeek: number[]; // 0=Sun … 6=Sat, same numbering as Recurrence.daysOfWeek
}

export interface ActivitySeries {
  id: string;
  title: string;
  category: ActivityCategory;
  slot: ActivitySlot;
  anchorDate: string; // YYYY-MM-DD — one-off: its date; recurring: the floor date occurrences start from
  recurrence?: WeeklyRecurrence; // absent = one-off item
  createdAt: number;
}

export interface ActivityOverride {
  id: string;
  seriesId: string;
  occurrenceDate: string; // YYYY-MM-DD — the natural date this override applies to
  movedDate?: string;
  movedSlot?: ActivitySlot;
}

// Marks one occurrence as done. Keyed by the natural occurrence date (like
// overrides), so a moved recurring occurrence keeps its done state.
export interface ActivityCompletion {
  id: string;
  seriesId: string;
  occurrenceDate: string;
}

// Derived at render time by utils/fiveToNine.ts — never persisted.
export interface ActivityOccurrence {
  seriesId: string;
  occurrenceDate: string;
  date: string;
  slot: ActivitySlot;
  title: string;
  category: ActivityCategory;
  isRecurring: boolean;
  isMoved: boolean;
  isDone: boolean;
}
