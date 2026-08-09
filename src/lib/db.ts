import { supabase } from './supabase';
import type { Task, Status, Project } from '../types';

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
  const { data, error } = await supabase.from('projects').select('*');
  if (error) throw error;
  return (data as ProjectRow[]).map(r => ({ id: r.id, name: r.name, color: r.color }));
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

export async function insertProject(project: Project, userId: string) {
  const { error } = await supabase.from('projects').insert({
    id: project.id, user_id: userId, name: project.name, color: project.color,
  });
  if (error) console.error('insertProject:', error);
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) console.error('deleteProject:', error);
}

export async function updateProjectName(id: string, name: string) {
  const { error } = await supabase.from('projects').update({ name }).eq('id', id);
  if (error) console.error('updateProjectName:', error);
}

export async function seedDefaults(userId: string, defaultStatuses: Status[], defaultProjects: Project[]) {
  await supabase.from('statuses').insert(
    defaultStatuses.map((s, i) => ({ id: s.id, user_id: userId, label: s.label, color: s.color, sort_order: i }))
  );
  await supabase.from('projects').insert(
    defaultProjects.map(p => ({ id: p.id, user_id: userId, name: p.name, color: p.color }))
  );
}
