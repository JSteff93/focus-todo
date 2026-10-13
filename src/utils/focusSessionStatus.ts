// Sentinel "task" id for focusing on busy work (emails, meetings, etc.) that
// isn't a real todo item and can't be marked complete.
export const BUSY_WORK_ID = '__busy_work__';

// Sentinel "task" id for the Meeting preset when manually logging a past
// session on the Focus Zone timeline (see AddSessionModal).
export const MEETING_ID = '__meeting__';

// Prefix for the unique per-entry id a manually-logged session gets when the
// user types a free-form description instead of picking a task or preset —
// each one is its own one-off, so unlike BUSY_WORK_ID/MEETING_ID these don't
// share an id to aggregate cumulative time against.
export const MANUAL_ID_PREFIX = '__manual_';

export function getFocusTaskDisplayTitle(taskId: string | null, tasks: { id: string; title: string }[]): string {
  if (!taskId) return 'Unknown task';
  if (taskId === BUSY_WORK_ID) return 'Busy Work';
  if (taskId === MEETING_ID) return 'Meeting';
  return tasks.find(t => t.id === taskId)?.title ?? 'Unknown task';
}

interface TimerSnapshot {
  phase: 'work' | 'short-break' | 'long-break';
  isRunning: boolean;
  isOvertime: boolean;
  sessionRounds: number;
  startedAt: number | null;
  timeLeftWhenStarted: number;
  overtimeStartedAt: number | null;
  overtimeSecsWhenStarted: number;
  taskStartTimeLeft: number;
}

export interface FocusSessionStatus {
  isActive: boolean;
  isOvertime: boolean;
  timeLeft: number;
  overtimeSeconds: number;
}

const INACTIVE: FocusSessionStatus = { isActive: false, isOvertime: false, timeLeft: 0, overtimeSeconds: 0 };

// Mirrors the anchor-based restore logic in FocusZone so the header banner can
// show a live countdown/overtime figure while a different view is active.
export function getFocusSessionStatus(): FocusSessionStatus {
  try {
    const raw = localStorage.getItem('timerState');
    if (!raw) return INACTIVE;
    const snap: TimerSnapshot = JSON.parse(raw);
    if (!snap.isRunning || snap.phase !== 'work') return INACTIVE;

    if (snap.isOvertime && snap.overtimeStartedAt !== null) {
      const elapsed = Math.floor((Date.now() - snap.overtimeStartedAt) / 1000);
      return { isActive: true, isOvertime: true, timeLeft: 0, overtimeSeconds: snap.overtimeSecsWhenStarted + elapsed };
    }

    if (!snap.isOvertime && snap.startedAt !== null) {
      const elapsed = Math.floor((Date.now() - snap.startedAt) / 1000);
      const timeLeft = Math.max(0, snap.timeLeftWhenStarted - elapsed);
      return { isActive: timeLeft > 0, isOvertime: false, timeLeft, overtimeSeconds: 0 };
    }

    return INACTIVE;
  } catch {
    return INACTIVE;
  }
}

export function formatTimerTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

