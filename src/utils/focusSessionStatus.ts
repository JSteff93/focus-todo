// Sentinel "task" id for focusing on busy work (emails, meetings, etc.) that
// isn't a real todo item and can't be marked complete.
export const BUSY_WORK_ID = '__busy_work__';

export function getFocusTaskDisplayTitle(taskId: string | null, tasks: { id: string; title: string }[]): string {
  if (!taskId) return 'Unknown task';
  if (taskId === BUSY_WORK_ID) return 'Busy Work';
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

// Mirrors the anchor-based restore logic in FocusZone so the header banner can show
// a live countdown/overtime figure without FocusZone being mounted.
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

function readWorkMins(): number {
  try {
    const rawSettings = localStorage.getItem('pomodoroSettings');
    if (rawSettings) {
      const parsed = JSON.parse(rawSettings);
      if (typeof parsed.workMins === 'number') return parsed.workMins;
    }
  } catch {
    // fall back to default
  }
  return 25;
}

export interface SwitchFocusResult {
  taskId: string;
  taskTitle: string;
  sessionSecs: number;
  completedAt: number;
}

// Called when the board's per-card focus button is used to switch tasks while
// a session is already running. Computes the elapsed time on the outgoing task
// (mirroring FocusZone's own completeTask/addHistoryEntry accounting) so the
// caller can log it to session history, then rewinds the shared timer state so
// the incoming task picks up from the exact remaining countdown — or a fresh
// pomodoro if the switch happens mid-overtime, since there's no "remaining
// time" left to carry over.
export function switchActiveFocusTask(oldTaskId: string, oldTaskTitle: string): SwitchFocusResult | null {
  const raw = localStorage.getItem('timerState');
  if (!raw) return null;
  let snap: TimerSnapshot;
  try {
    snap = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!snap.isRunning || snap.phase !== 'work') return null;

  const workMins = readWorkMins();
  const taskStartTimeLeft = typeof snap.taskStartTimeLeft === 'number' ? snap.taskStartTimeLeft : workMins * 60;
  const sessionRounds = snap.sessionRounds ?? 0;

  let workedSecs: number;
  let newTimeLeft: number;
  if (snap.isOvertime && snap.overtimeStartedAt !== null) {
    const elapsed = Math.floor((Date.now() - snap.overtimeStartedAt) / 1000);
    workedSecs = taskStartTimeLeft + (snap.overtimeSecsWhenStarted + elapsed);
    newTimeLeft = workMins * 60;
  } else if (!snap.isOvertime && snap.startedAt !== null) {
    const elapsed = Math.floor((Date.now() - snap.startedAt) / 1000);
    const timeLeft = Math.max(0, snap.timeLeftWhenStarted - elapsed);
    workedSecs = taskStartTimeLeft - timeLeft;
    newTimeLeft = timeLeft;
  } else {
    return null;
  }

  const sessionSecs = Math.max(60, Math.round(workedSecs / 60) * 60);
  const completedAt = Date.now();

  localStorage.setItem('timerState', JSON.stringify({
    phase: 'work',
    timeLeft: newTimeLeft,
    isRunning: true,
    isOvertime: false,
    overtimeSeconds: 0,
    sessionRounds,
    startedAt: Date.now(),
    timeLeftWhenStarted: newTimeLeft,
    overtimeStartedAt: null,
    overtimeSecsWhenStarted: 0,
    taskStartTimeLeft: newTimeLeft,
  }));

  return { taskId: oldTaskId, taskTitle: oldTaskTitle, sessionSecs, completedAt };
}
