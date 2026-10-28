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
  // modal rather than a completed/paused timer run. Every entry is editable
  // either way; editing preserves this flag so a timer entry stays one.
  manual?: boolean;
}

// The id of a user-managed ActivityCategoryDef. The four built-ins keep the
// ids they had when categories were hard-coded ('exercise', 'chores', 'fun',
// 'social') so existing activities still resolve after the migration.
export type ActivityCategory = string;

export interface ActivityCategoryDef {
  id: string;
  label: string;
  color: string;
  sortOrder: number;
  // Exercise-specific features attach to whichever category has this set
  // (at most one per user), never to its label — renaming keeps them.
  isExercise: boolean;
}
export type ActivitySlot = 'before' | 'work' | 'after';

export interface WeeklyRecurrence {
  daysOfWeek: number[]; // 0=Sun … 6=Sat, same numbering as Recurrence.daysOfWeek
}

export type ExerciseType = 'run' | 'ride' | 'hike' | 'gym' | 'stretch' | 'other';

// The plan for an exercise activity — on the series, so it applies to every
// repeat. Only shown while the activity's category is the exercise one.
export interface ExerciseDetails {
  type: ExerciseType;
  customName?: string; // 'other' only
  distanceKm?: number;
  durationMins?: number;
  elevationM?: number; // 'hike' only
  location?: string; // 'hike' only
  gymRoutineId?: string;
  stretchRoutineId?: string;
  notes?: string;
}

// What was actually done on one occurrence, logged when ticking it done.
export interface ExerciseActual {
  distanceKm?: number;
  durationMins?: number;
  notes?: string;
  // Stretch routine items (RoutineItem ids) ticked off for this occurrence.
  checkedItemIds?: string[];
}

// One entry in a routine. Fields are generic enough (sets/reps/notes) that
// gym routines could gain exercise lists later; holdSecs/side are for
// static stretches.
export interface RoutineItem {
  id: string;
  name: string;
  sets?: number;
  reps?: number;
  holdSecs?: number;
  side?: 'both' | 'each';
  notes?: string;
}

// Reusable named routine — a shared template, so editing it changes every
// activity (past and future occurrences) that uses it. 'gym' routines are
// just a label for now; 'stretch' routines carry items.
export interface ExerciseRoutine {
  id: string;
  kind: 'gym' | 'stretch';
  name: string;
  sortOrder: number;
  items: RoutineItem[];
  notes: string;
}

export interface ActivitySeries {
  id: string;
  title: string;
  category: ActivityCategory;
  slot: ActivitySlot;
  anchorDate: string; // YYYY-MM-DD — one-off: its date; recurring: the floor date occurrences start from
  recurrence?: WeeklyRecurrence; // absent = one-off item
  createdAt: number;
  details?: ExerciseDetails;
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
  // Unticking flips this off instead of deleting the row, so a logged
  // `actual` survives being unticked and comes back on re-tick.
  done: boolean;
  actual?: ExerciseActual;
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
  details?: ExerciseDetails;
  // Present whenever something was logged, even if since unticked — the
  // card only shows it while isDone.
  actual?: ExerciseActual;
}
