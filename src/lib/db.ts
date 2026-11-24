import { supabase } from './supabase';
import { notify } from './toast';
import { SIGNED_OUT_TEXT, isAuthError, saveFailedMessage } from './dbErrors';
import type { Task, Status, Project, SessionEntry, ActivitySeries, ActivityOverride, ActivityCompletion, ActivityCategory, ActivityCategoryDef, ActivitySlot, ExerciseDetails, ExerciseActual, ExerciseRoutine } from '../types';

interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status_id: string;
  created_at: number;
  due_date: string | null;
  recurrence: Task['recurrence'] | null;
  assignee: string | null;
  project_id: string | null;
  pomodoro_count: number;
  estimated_focus_mins: number | null;
  completed_at: number | null;
  sort_order: number;
}

interface StatusRow {
  id: string;
  user_id: string;
  label: string;
  color: string;
  sort_order: number;
}

interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
}

interface SessionRow {
  id: string;
  user_id: string;
  task_id: string;
  task_title: string;
  session_secs: number;
  cumulative_secs: number;
  completed_at: number;
  task_completed: boolean;
  manual: boolean;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    statusId: row.status_id,
    createdAt: row.created_at,
    dueDate: row.due_date ?? undefined,
    recurrence: row.recurrence ?? undefined,
    assignee: row.assignee ?? undefined,
    projectId: row.project_id ?? undefined,
    pomodoroCount: row.pomodoro_count,
    estimatedFocusMins: row.estimated_focus_mins ?? undefined,
    completedAt: row.completed_at ?? undefined,
  };
}

function taskToRow(task: Task, userId: string, sortOrder: number): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    description: task.description,
    status_id: task.statusId,
    created_at: task.createdAt,
    due_date: task.dueDate ?? null,
    recurrence: task.recurrence ?? null,
    assignee: task.assignee ?? null,
    project_id: task.projectId ?? null,
    pomodoro_count: task.pomodoroCount ?? 0,
    estimated_focus_mins: task.estimatedFocusMins ?? null,
    completed_at: task.completedAt ?? null,
    sort_order: sortOrder,
  };
}

// Every write here is fire-and-forget after an optimistic local update, so a
// failure would otherwise only reach the console. This tells the user. There
// is deliberately no rollback: the screen keeps showing the unsaved change,
// and the toast says to reload to see what's actually saved.
export function reportDbError(op: string, error: unknown, status?: number) {
  console.error(`${op}:`, error);
  if (isAuthError(error, status)) {
    notify({
      key: 'db-auth',
      kind: 'error',
      message: SIGNED_OUT_TEXT,
      // Stays up: nothing will save until they sign in again.
      durationMs: null,
      actions: [{ label: 'Sign out', onClick: () => { supabase.auth.signOut(); } }],
    });
    return;
  }
  notify({
    key: 'db-save',
    kind: 'error',
    message: saveFailedMessage,
    // A drag can fire two or three requests that all fail at once; count
    // that as one change.
    sameEventMs: 250,
    actions: [{ label: 'Reload', onClick: () => window.location.reload() }],
  });
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as TaskRow[]).map(rowToTask);
}

export async function fetchStatuses(): Promise<Status[]> {
  const { data, error } = await supabase
    .from('statuses')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as StatusRow[]).map(r => ({ id: r.id, label: r.label, color: r.color }));
}

export async function fetchProjects(): Promise<Project[]> {
  const ordered = await supabase.from('projects').select('*').order('sort_order', { ascending: true });
  if (!ordered.error) {
    return (ordered.data as ProjectRow[]).map(r => ({ id: r.id, name: r.name, color: r.color }));
  }
  // Older databases may not have a sort_order column yet (see supabase/schema.sql) —
  // fall back to an unordered fetch so the board still loads; reordering just won't persist.
  const fallback = await supabase.from('projects').select('*');
  if (fallback.error) throw fallback.error;
  return (fallback.data as ProjectRow[]).map(r => ({ id: r.id, name: r.name, color: r.color }));
}

function rowToSessionEntry(row: SessionRow): SessionEntry {
  return {
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    sessionSecs: row.session_secs,
    cumulativeSecs: row.cumulative_secs,
    completedAt: row.completed_at,
    taskCompleted: row.task_completed || undefined,
    manual: row.manual || undefined,
  };
}

export async function fetchSessionHistory(): Promise<SessionEntry[]> {
  const { data, error } = await supabase
    .from('focus_sessions')
    .select('*')
    .order('completed_at', { ascending: true });
  if (error) throw error;
  return (data as SessionRow[]).map(rowToSessionEntry);
}

export async function insertSessionEntry(entry: SessionEntry, userId: string) {
  const { error, status } = await supabase.from('focus_sessions').insert({
    id: entry.id,
    user_id: userId,
    task_id: entry.taskId,
    task_title: entry.taskTitle,
    session_secs: entry.sessionSecs,
    cumulative_secs: entry.cumulativeSecs,
    completed_at: entry.completedAt,
    task_completed: entry.taskCompleted ?? false,
    manual: entry.manual ?? false,
  });
  if (error) reportDbError('insertSessionEntry', error, status);
}

export async function updateSessionEntry(entry: SessionEntry) {
  const { error, status } = await supabase.from('focus_sessions').update({
    task_id: entry.taskId,
    task_title: entry.taskTitle,
    session_secs: entry.sessionSecs,
    cumulative_secs: entry.cumulativeSecs,
    completed_at: entry.completedAt,
  }).eq('id', entry.id);
  if (error) reportDbError('updateSessionEntry', error, status);
}

export async function deleteSessionEntry(id: string) {
  const { error, status } = await supabase.from('focus_sessions').delete().eq('id', id);
  if (error) reportDbError('deleteSessionEntry', error, status);
}

export async function upsertTask(task: Task, userId: string, sortOrder: number) {
  const { error, status } = await supabase.from('tasks').upsert(taskToRow(task, userId, sortOrder));
  if (error) reportDbError('upsertTask', error, status);
}

export async function upsertTasksSortOrder(tasks: Task[], userId: string) {
  const rows = tasks.map((t, i) => taskToRow(t, userId, i));
  const { error, status } = await supabase.from('tasks').upsert(rows);
  if (error) reportDbError('upsertTasksSortOrder', error, status);
}

export async function deleteTask(id: string) {
  const { error, status } = await supabase.from('tasks').delete().eq('id', id);
  if (error) reportDbError('deleteTask', error, status);
}

// The bulk task helpers below return whether they succeeded, so the store
// only deletes the column/project once its tasks have been dealt with —
// otherwise a failed update would orphan the rows again.
export async function reassignTasksStatus(fromStatusId: string, toStatusId: string): Promise<boolean> {
  const { error, status } = await supabase.from('tasks').update({ status_id: toStatusId }).eq('status_id', fromStatusId);
  if (error) reportDbError('reassignTasksStatus', error, status);
  return !error;
}

export async function deleteTasksByStatus(statusId: string): Promise<boolean> {
  const { error, status } = await supabase.from('tasks').delete().eq('status_id', statusId);
  if (error) reportDbError('deleteTasksByStatus', error, status);
  return !error;
}

export async function clearTasksProject(projectId: string): Promise<boolean> {
  const { error, status } = await supabase.from('tasks').update({ project_id: null }).eq('project_id', projectId);
  if (error) reportDbError('clearTasksProject', error, status);
  return !error;
}

export async function insertStatus(status: Status, userId: string, sortOrder: number) {
  const { error, status: httpStatus } = await supabase.from('statuses').insert({
    id: status.id, user_id: userId, label: status.label, color: status.color, sort_order: sortOrder,
  });
  if (error) reportDbError('insertStatus', error, httpStatus);
}

export async function deleteStatus(id: string) {
  const { error, status } = await supabase.from('statuses').delete().eq('id', id);
  if (error) reportDbError('deleteStatus', error, status);
}

export async function updateStatusLabel(id: string, label: string) {
  const { error, status } = await supabase.from('statuses').update({ label }).eq('id', id);
  if (error) reportDbError('updateStatusLabel', error, status);
}

export async function insertProject(project: Project, userId: string, sortOrder: number) {
  const { error, status } = await supabase.from('projects').insert({
    id: project.id, user_id: userId, name: project.name, color: project.color, sort_order: sortOrder,
  });
  if (error) reportDbError('insertProject', error, status);
}

export async function upsertProjectsSortOrder(projects: Project[], userId: string) {
  const rows = projects.map((p, i) => ({
    id: p.id, user_id: userId, name: p.name, color: p.color, sort_order: i,
  }));
  const { error, status } = await supabase.from('projects').upsert(rows);
  if (error) reportDbError('upsertProjectsSortOrder', error, status);
}

export async function deleteProject(id: string) {
  const { error, status } = await supabase.from('projects').delete().eq('id', id);
  if (error) reportDbError('deleteProject', error, status);
}

export async function updateProjectName(id: string, name: string) {
  const { error, status } = await supabase.from('projects').update({ name }).eq('id', id);
  if (error) reportDbError('updateProjectName', error, status);
}

interface ActivitySeriesRow {
  id: string;
  user_id: string;
  title: string;
  category: ActivityCategory;
  slot: ActivitySlot;
  anchor_date: string;
  days_of_week: number[] | null;
  created_at: number;
  details?: ExerciseDetails | null;
}

interface ActivityOverrideRow {
  id: string;
  user_id: string;
  series_id: string;
  occurrence_date: string;
  moved_date: string | null;
  moved_slot: ActivitySlot | null;
}

interface ActivityCompletionRow {
  id: string;
  user_id: string;
  series_id: string;
  occurrence_date: string;
  // Optional in the row type so rows from before the exercise migration
  // (no such columns) still map: missing done = done, missing actual = none.
  done?: boolean | null;
  actual?: ExerciseActual | null;
}

function rowToActivitySeries(row: ActivitySeriesRow): ActivitySeries {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    slot: row.slot,
    anchorDate: row.anchor_date,
    recurrence: row.days_of_week ? { daysOfWeek: row.days_of_week } : undefined,
    createdAt: row.created_at,
    details: row.details ?? undefined,
  };
}

function activitySeriesToRow(s: ActivitySeries, userId: string): ActivitySeriesRow {
  return {
    id: s.id,
    user_id: userId,
    title: s.title,
    category: s.category,
    slot: s.slot,
    anchor_date: s.anchorDate,
    days_of_week: s.recurrence ? s.recurrence.daysOfWeek : null,
    created_at: s.createdAt,
    details: s.details ?? null,
  };
}

function rowToActivityOverride(row: ActivityOverrideRow): ActivityOverride {
  return {
    id: row.id,
    seriesId: row.series_id,
    occurrenceDate: row.occurrence_date,
    movedDate: row.moved_date ?? undefined,
    movedSlot: row.moved_slot ?? undefined,
  };
}

function activityOverrideToRow(o: ActivityOverride, userId: string): ActivityOverrideRow {
  return {
    id: o.id,
    user_id: userId,
    series_id: o.seriesId,
    occurrence_date: o.occurrenceDate,
    moved_date: o.movedDate ?? null,
    moved_slot: o.movedSlot ?? null,
  };
}

interface ActivityCategoryRow {
  id: string;
  user_id: string;
  label: string;
  color: string;
  sort_order: number;
  is_exercise: boolean;
}

function rowToActivityCategory(row: ActivityCategoryRow): ActivityCategoryDef {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    sortOrder: row.sort_order ?? 0,
    isExercise: !!row.is_exercise,
  };
}

export async function fetchActivityCategories(): Promise<ActivityCategoryDef[]> {
  const { data, error } = await supabase.from('activity_categories').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as ActivityCategoryRow[]).map(rowToActivityCategory);
}

// Always writes the whole (small) list — sort order and the single
// is_exercise flag are spread across rows, so partial writes could leave
// them inconsistent. Keyed on (user_id, id): every user has their own
// 'exercise'/'chores'/… rows.
export async function upsertActivityCategories(categories: ActivityCategoryDef[], userId: string) {
  const rows: ActivityCategoryRow[] = categories.map((c, i) => ({
    id: c.id, user_id: userId, label: c.label, color: c.color, sort_order: i, is_exercise: c.isExercise,
  }));
  const { error, status } = await supabase.from('activity_categories').upsert(rows, { onConflict: 'user_id,id' });
  if (error) reportDbError('upsertActivityCategories', error, status);
}

// RLS scopes both of these to the signed-in user's rows.
export async function deleteActivityCategory(id: string) {
  const { error, status } = await supabase.from('activity_categories').delete().eq('id', id);
  if (error) reportDbError('deleteActivityCategory', error, status);
}

export async function reassignActivityCategory(fromId: string, toId: string) {
  const { error, status } = await supabase.from('activity_series').update({ category: toId }).eq('category', fromId);
  if (error) reportDbError('reassignActivityCategory', error, status);
}

export async function fetchActivitySeries(): Promise<ActivitySeries[]> {
  const { data, error } = await supabase.from('activity_series').select('*');
  if (error) throw error;
  return (data as ActivitySeriesRow[]).map(rowToActivitySeries);
}

export async function fetchActivityOverrides(): Promise<ActivityOverride[]> {
  const { data, error } = await supabase.from('activity_overrides').select('*');
  if (error) throw error;
  return (data as ActivityOverrideRow[]).map(rowToActivityOverride);
}

export async function upsertActivitySeries(s: ActivitySeries, userId: string) {
  const { error, status } = await supabase.from('activity_series').upsert(activitySeriesToRow(s, userId));
  if (error) reportDbError('upsertActivitySeries', error, status);
}

export async function deleteActivitySeries(id: string) {
  const { error, status } = await supabase.from('activity_series').delete().eq('id', id);
  if (error) reportDbError('deleteActivitySeries', error, status);
}

export async function upsertActivityOverride(o: ActivityOverride, userId: string) {
  const { error, status } = await supabase.from('activity_overrides').upsert(activityOverrideToRow(o, userId));
  if (error) reportDbError('upsertActivityOverride', error, status);
}

export async function deleteActivityOverride(id: string) {
  const { error, status } = await supabase.from('activity_overrides').delete().eq('id', id);
  if (error) reportDbError('deleteActivityOverride', error, status);
}

export async function fetchActivityCompletions(): Promise<ActivityCompletion[]> {
  const { data, error } = await supabase.from('activity_completions').select('*');
  if (error) throw error;
  return (data as ActivityCompletionRow[]).map(row => ({
    id: row.id,
    seriesId: row.series_id,
    occurrenceDate: row.occurrence_date,
    done: row.done ?? true,
    actual: row.actual ?? undefined,
  }));
}

export async function upsertActivityCompletion(c: ActivityCompletion, userId: string) {
  const row: ActivityCompletionRow = {
    id: c.id, user_id: userId, series_id: c.seriesId, occurrence_date: c.occurrenceDate,
    done: c.done, actual: c.actual ?? null,
  };
  const { error, status } = await supabase.from('activity_completions').upsert(row);
  if (error) reportDbError('upsertActivityCompletion', error, status);
}

export async function deleteActivityCompletion(id: string) {
  const { error, status } = await supabase.from('activity_completions').delete().eq('id', id);
  if (error) reportDbError('deleteActivityCompletion', error, status);
}

interface ExerciseRoutineRow {
  id: string;
  user_id: string;
  kind: 'gym' | 'stretch';
  name: string;
  sort_order: number;
  items: ExerciseRoutine['items'] | null;
  notes: string | null;
}

export async function fetchExerciseRoutines(): Promise<ExerciseRoutine[]> {
  const { data, error } = await supabase.from('exercise_routines').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as ExerciseRoutineRow[]).map(row => ({
    id: row.id,
    kind: row.kind,
    name: row.name,
    sortOrder: row.sort_order ?? 0,
    items: Array.isArray(row.items) ? row.items : [],
    notes: row.notes ?? '',
  }));
}

export async function upsertExerciseRoutines(routines: ExerciseRoutine[], userId: string) {
  if (routines.length === 0) return;
  const rows: ExerciseRoutineRow[] = routines.map(r => ({
    id: r.id, user_id: userId, kind: r.kind, name: r.name, sort_order: r.sortOrder, items: r.items, notes: r.notes,
  }));
  const { error, status } = await supabase.from('exercise_routines').upsert(rows);
  if (error) reportDbError('upsertExerciseRoutines', error, status);
}

export async function deleteExerciseRoutine(id: string) {
  const { error, status } = await supabase.from('exercise_routines').delete().eq('id', id);
  if (error) reportDbError('deleteExerciseRoutine', error, status);
}

export async function seedDefaults(userId: string, defaultStatuses: Status[], defaultProjects: Project[]) {
  const statusesResult = await supabase.from('statuses').insert(
    defaultStatuses.map((s, i) => ({ id: s.id, user_id: userId, label: s.label, color: s.color, sort_order: i }))
  );
  if (statusesResult.error) reportDbError('seedDefaults statuses', statusesResult.error, statusesResult.status);
  const projectsResult = await supabase.from('projects').insert(
    defaultProjects.map((p, i) => ({ id: p.id, user_id: userId, name: p.name, color: p.color, sort_order: i }))
  );
  if (projectsResult.error) reportDbError('seedDefaults projects', projectsResult.error, projectsResult.status);
}
