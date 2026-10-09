import { supabase } from './supabase';
import type { Task, Status, Project, SessionEntry, ActivitySeries, ActivityOverride, ActivityCategory, ActivitySlot } from '../types';

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
  const { error } = await supabase.from('focus_sessions').insert({
    id: entry.id,
    user_id: userId,
    task_id: entry.taskId,
    task_title: entry.taskTitle,
    session_secs: entry.sessionSecs,
    cumulative_secs: entry.cumulativeSecs,
    completed_at: entry.completedAt,
    task_completed: entry.taskCompleted ?? false,
  });
  if (error) console.error('insertSessionEntry:', error);
}

export async function upsertTask(task: Task, userId: string, sortOrder: number) {
  const { error } = await supabase.from('tasks').upsert(taskToRow(task, userId, sortOrder));
  if (error) console.error('upsertTask:', error);
}

export async function upsertTasksSortOrder(tasks: Task[], userId: string) {
  const rows = tasks.map((t, i) => taskToRow(t, userId, i));
  const { error } = await supabase.from('tasks').upsert(rows);
  if (error) console.error('upsertTasksSortOrder:', error);
}

export async function deleteTask(id: string) {
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) console.error('deleteTask:', error);
}

export async function insertStatus(status: Status, userId: string, sortOrder: number) {
  const { error } = await supabase.from('statuses').insert({
    id: status.id, user_id: userId, label: status.label, color: status.color, sort_order: sortOrder,
  });
  if (error) console.error('insertStatus:', error);
}

export async function deleteStatus(id: string) {
  const { error } = await supabase.from('statuses').delete().eq('id', id);
  if (error) console.error('deleteStatus:', error);
}

export async function updateStatusLabel(id: string, label: string) {
  const { error } = await supabase.from('statuses').update({ label }).eq('id', id);
  if (error) console.error('updateStatusLabel:', error);
}

export async function insertProject(project: Project, userId: string, sortOrder: number) {
  const { error } = await supabase.from('projects').insert({
    id: project.id, user_id: userId, name: project.name, color: project.color, sort_order: sortOrder,
  });
  if (error) console.error('insertProject:', error);
}

export async function upsertProjectsSortOrder(projects: Project[], userId: string) {
  const rows = projects.map((p, i) => ({
    id: p.id, user_id: userId, name: p.name, color: p.color, sort_order: i,
  }));
  const { error } = await supabase.from('projects').upsert(rows);
  if (error) console.error('upsertProjectsSortOrder:', error);
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error('deleteProject:', error);
}

export async function updateProjectName(id: string, name: string) {
  const { error } = await supabase.from('projects').update({ name }).eq('id', id);
  if (error) console.error('updateProjectName:', error);
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
}

interface ActivityOverrideRow {
  id: string;
  user_id: string;
  series_id: string;
  occurrence_date: string;
  moved_date: string | null;
  moved_slot: ActivitySlot | null;
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
  const { error } = await supabase.from('activity_series').upsert(activitySeriesToRow(s, userId));
  if (error) console.error('upsertActivitySeries:', error);
}

export async function deleteActivitySeries(id: string) {
  const { error } = await supabase.from('activity_series').delete().eq('id', id);
  if (error) console.error('deleteActivitySeries:', error);
}

export async function upsertActivityOverride(o: ActivityOverride, userId: string) {
  const { error } = await supabase.from('activity_overrides').upsert(activityOverrideToRow(o, userId));
  if (error) console.error('upsertActivityOverride:', error);
}

export async function deleteActivityOverride(id: string) {
  const { error } = await supabase.from('activity_overrides').delete().eq('id', id);
  if (error) console.error('deleteActivityOverride:', error);
}

export async function seedDefaults(userId: string, defaultStatuses: Status[], defaultProjects: Project[]) {
  await supabase.from('statuses').insert(
    defaultStatuses.map((s, i) => ({ id: s.id, user_id: userId, label: s.label, color: s.color, sort_order: i }))
  );
  await supabase.from('projects').insert(
    defaultProjects.map((p, i) => ({ id: p.id, user_id: userId, name: p.name, color: p.color, sort_order: i }))
  );
}
