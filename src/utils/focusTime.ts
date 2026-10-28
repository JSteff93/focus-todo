import type { SessionEntry } from '../types';

// Real time spent on a task is the sum of its logged sessions — timer,
// partial (task switch), overtime and manually added alike. pomodoroCount
// can't stand in for this: it goes up by 1 per entry regardless of length.
export function getTaskFocusSecs(history: SessionEntry[], taskId: string): number {
  return history.reduce((acc, e) => (e.taskId === taskId ? acc + e.sessionSecs : acc), 0);
}

// Same totals for every task at once, so the Board can be handed one lookup
// built in a single pass instead of the whole history array.
export function buildTaskFocusSecsMap(history: SessionEntry[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of history) map.set(e.taskId, (map.get(e.taskId) ?? 0) + e.sessionSecs);
  return map;
}
