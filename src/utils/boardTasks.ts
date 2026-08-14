import type { Task } from '../types';

export function startOfDay(dateStr?: string) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function visibleBoardTasks(tasks: Task[], simulatedDate?: string) {
  const todayStart = startOfDay(simulatedDate);
  return tasks.filter(t => !t.completedAt || t.completedAt >= todayStart);
}
