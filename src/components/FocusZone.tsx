import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import type { Task, Status, Project } from '../types';

const RADIUS = 130;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Phase = 'work' | 'short-break' | 'long-break';

interface TimerSettings {
  workMins: number;
  shortBreakMins: number;
  longBreakMins: number;
  roundsPerLong: number;
}

interface SessionEntry {
  taskId: string;
  taskTitle: string;
  sessionSecs: number;
  cumulativeSecs: number;
  completedAt: number;
  taskCompleted?: boolean;
}

interface TimerSnapshot {
  phase: Phase;
  timeLeft: number;
  isRunning: boolean;
  isOvertime: boolean;
  overtimeSeconds: number;
  sessionRounds: number;
  startedAt: number | null;
  timeLeftWhenStarted: number;
  overtimeStartedAt: number | null;
  overtimeSecsWhenStarted: number;
}

interface RestoredTimer {
  phase: Phase;
  timeLeft: number;
  isRunning: boolean;
  isOvertime: boolean;
  overtimeSeconds: number;
  sessionRounds: number;
  startAnchor: { at: number; timeLeft: number } | null;
  overtimeAnchor: { at: number; secs: number } | null;
}

const DEFAULT_SETTINGS: TimerSettings = {
  workMins: 25,
  shortBreakMins: 5,
  longBreakMins: 15,
  roundsPerLong: 4,
};

function loadSettings(): TimerSettings {
  try {
    const raw = localStorage.getItem('pomodoroSettings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadHistory(): SessionEntry[] {
  try {
    const raw = localStorage.getItem('focusSessionHistory');
    if (raw) return JSON.parse(raw) as SessionEntry[];
    return [];
  } catch {
    return [];
  }
}

function loadTimerState(): RestoredTimer {
  const s = loadSettings();
  const defaults: RestoredTimer = {
    phase: 'work',
    timeLeft: s.workMins * 60,
    isRunning: false,
    isOvertime: false,
    overtimeSeconds: 0,
    sessionRounds: 0,
    startAnchor: null,
    overtimeAnchor: null,
  };
  try {
    const raw = localStorage.getItem('timerState');
    if (!raw) return defaults;
    const snap: TimerSnapshot = JSON.parse(raw);
    const { phase, isOvertime, sessionRounds } = snap;
    let { timeLeft, isRunning, overtimeSeconds } = snap;
    let startAnchor: { at: number; timeLeft: number } | null = null;
    let overtimeAnchor: { at: number; secs: number } | null = null;

    if (isRunning && !isOvertime && snap.startedAt !== null) {
      const elapsed = Math.floor((Date.now() - snap.startedAt) / 1000);
      const restored = Math.max(0, snap.timeLeftWhenStarted - elapsed);
      if (restored > 0) {
        timeLeft = restored;
        startAnchor = { at: snap.startedAt, timeLeft: snap.timeLeftWhenStarted };
      } else {
        // Timer expired while away — stop at zero
        timeLeft = 0;
        isRunning = false;
      }
    } else if (isRunning && isOvertime && snap.overtimeStartedAt !== null) {
      const elapsed = Math.floor((Date.now() - snap.overtimeStartedAt) / 1000);
      overtimeSeconds = snap.overtimeSecsWhenStarted + elapsed;
      overtimeAnchor = { at: snap.overtimeStartedAt, secs: snap.overtimeSecsWhenStarted };
    }

    return { phase, timeLeft, isRunning, isOvertime, overtimeSeconds, sessionRounds, startAnchor, overtimeAnchor };
  } catch {
    return defaults;
  }
}

interface Props {
  tasks: Task[];
  statuses: Status[];
  projects: Project[];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onIncrementPomodoro: (taskId: string) => void;
  onUpdateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function formatMins(secs: number) {
  const m = Math.floor(secs / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function cardHeight(sessionSecs: number): number {
  return Math.min(74 + Math.floor(sessionSecs / 60), 150);
}

function formatDueDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isDueDateOverdue(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function phaseLabelStr(phase: Phase, isOvertime: boolean) {
  if (isOvertime) return 'Overtime';
  if (phase === 'work') return 'Focus';
  if (phase === 'short-break') return 'Short Break';
  return 'Long Break';
}

export function FocusZone({ tasks, statuses, projects, selectedTaskId, onSelectTask, onIncrementPomodoro, onUpdateTask }: Props) {
  const [settings, setSettings] = useState<TimerSettings>(loadSettings);

  const workSecs = settings.workMins * 60;
  const shortBreakSecs = settings.shortBreakMins * 60;
  const longBreakSecs = settings.longBreakMins * 60;

  function phaseDuration(p: Phase) {
    if (p === 'work') return workSecs;
    if (p === 'short-break') return shortBreakSecs;
    return longBreakSecs;
  }

  const [restored] = useState<RestoredTimer>(loadTimerState);

  const [phase, setPhase] = useState<Phase>(restored.phase);
  const [timeLeft, setTimeLeft] = useState(restored.timeLeft);
  const [isRunning, setIsRunning] = useState(restored.isRunning);
  const [sessionRounds, setSessionRounds] = useState(restored.sessionRounds);
  const [showAlert, setShowAlert] = useState(false);
  const [isOvertime, setIsOvertime] = useState(restored.isOvertime);
  const [overtimeSeconds, setOvertimeSeconds] = useState(restored.overtimeSeconds);
  const [showSettings, setShowSettings] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<keyof TimerSettings, string>>>({});
  const [history, setHistory] = useState<SessionEntry[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(true);
  const [queueProjectFilter, setQueueProjectFilter] = useState<Set<string>>(() => new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Wall-clock anchors — make the timer drift-free and survive page refresh
  const startAnchorRef = useRef<{ at: number; timeLeft: number } | null>(null);
  const overtimeAnchorRef = useRef<{ at: number; secs: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Restore anchors synchronously before intervals start
  useLayoutEffect(() => {
    startAnchorRef.current = restored.startAnchor;
    overtimeAnchorRef.current = restored.overtimeAnchor;
  }, []);

  function handleSettingChange(key: keyof TimerSettings, raw: string) {
    setDrafts(d => ({ ...d, [key]: raw }));
    const n = parseInt(raw);
    if (!isNaN(n) && raw !== '') updateSettings({ [key]: n });
  }

  function handleSettingBlur(key: keyof TimerSettings) {
    setDrafts(d => { const next = { ...d }; delete next[key]; return next; });
  }

  const selectedTask = selectedTaskId ? (tasks.find(t => t.id === selectedTaskId) ?? null) : null;
  const project = selectedTask?.projectId ? (projects.find(p => p.id === selectedTask.projectId) ?? null) : null;

  const activeTasks = tasks
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

  const queueProjects = projects.filter(p => activeTasks.some(t => t.projectId === p.id));
  const filteredActiveTasks = queueProjectFilter.size > 0
    ? activeTasks.filter(t => t.projectId != null && queueProjectFilter.has(t.projectId))
    : activeTasks;

  function toggleProjectFilter(id: string) {
    setQueueProjectFilter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleDrawerTaskClick(id: string) {
    if (showCompletePrompt) continueWithTask(id);
    else selectTask(id);
  }

  const phaseRef = useRef(phase);
  const isOvertimeRef = useRef(isOvertime);
  const overtimeSecondsRef = useRef(overtimeSeconds);
  const sessionRoundsRef = useRef(sessionRounds);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const onIncrementRef = useRef(onIncrementPomodoro);
  const onUpdateTaskRef = useRef(onUpdateTask);
  const settingsRef = useRef(settings);
  const selectedTaskTitleRef = useRef<string | null>(null);
  const taskStartTimeLeftRef = useRef(workSecs);
  useEffect(() => {
    phaseRef.current = phase;
    isOvertimeRef.current = isOvertime;
    overtimeSecondsRef.current = overtimeSeconds;
    sessionRoundsRef.current = sessionRounds;
    selectedTaskIdRef.current = selectedTaskId;
    selectedTaskTitleRef.current = selectedTask?.title ?? null;
    onIncrementRef.current = onIncrementPomodoro;
    onUpdateTaskRef.current = onUpdateTask;
    settingsRef.current = settings;
  });

  function addHistoryEntry() {
    const tid = selectedTaskIdRef.current;
    if (!tid) return;
    onIncrementRef.current(tid);
    const title = selectedTaskTitleRef.current ?? 'Unknown task';
    const rawSecs = isOvertimeRef.current
      ? taskStartTimeLeftRef.current + overtimeSecondsRef.current
      : taskStartTimeLeftRef.current;
    const sessionSecs = Math.round(rawSecs / 60) * 60;
    setHistory(prev => {
      const prevCumulative = prev
        .filter(e => e.taskId === tid)
        .reduce((acc, e) => acc + e.sessionSecs, 0);
      return [...prev, { taskId: tid, taskTitle: title, sessionSecs, cumulativeSecs: prevCumulative + sessionSecs, completedAt: Date.now() }];
    });
  }

  function playChime() {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = audioCtxRef.current ?? new Ctx();
      audioCtxRef.current = ctx;
      const now = ctx.currentTime;
      // Two soft sine notes, gentle attack/decay, low volume
      [880, 1108.73].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 1.5);
      });
    } catch {
      // ignore audio errors (e.g. autoplay restrictions)
    }
  }

  function onWorkTimerEnd() {
    startAnchorRef.current = null;
    setSessionRounds(r => r + 1);
    setIsRunning(false);
    setShowAlert(true);
    playChime();
  }

  function completeTask() {
    const tid = selectedTaskIdRef.current;
    if (!tid) return;
    const title = selectedTaskTitleRef.current ?? 'Unknown task';
    const workedSecs = isOvertimeRef.current
      ? taskStartTimeLeftRef.current + overtimeSecondsRef.current
      : taskStartTimeLeftRef.current - timeLeft;
    const sessionSecs = Math.max(60, Math.round(workedSecs / 60) * 60);
    setHistory(prev => {
      const prevCumulative = prev
        .filter(e => e.taskId === tid)
        .reduce((acc, e) => acc + e.sessionSecs, 0);
      return [...prev, { taskId: tid, taskTitle: title, sessionSecs, cumulativeSecs: prevCumulative + sessionSecs, completedAt: Date.now(), taskCompleted: true }];
    });
    onUpdateTaskRef.current(tid, { statusId: 'complete' });
    setIsRunning(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
    setShowAlert(false);
    startAnchorRef.current = null;
    overtimeAnchorRef.current = null;
    onSelectTask(null);
    setShowCompletePrompt(true);
  }

  function continueWithTask(id: string) {
    taskStartTimeLeftRef.current = timeLeft;
    onSelectTask(id);
    setShowCompletePrompt(false);
  }

  // Document title live countdown
  useEffect(() => {
    const display = isOvertime ? `+${formatTime(overtimeSeconds)}` : formatTime(timeLeft);
    if (isRunning) {
      document.title = `${display} · ${phaseLabelStr(phase, isOvertime)} — FocusStacks`;
    } else {
      document.title = 'FocusStacks';
    }
  }, [timeLeft, overtimeSeconds, isRunning, phase, isOvertime]);

  useEffect(() => () => { document.title = 'FocusStacks'; }, []);

  // Auto-dismiss the session-complete alert after 1 minute of no response,
  // assuming the user wants to keep working (starts overtime).
  useEffect(() => {
    if (!showAlert) return;
    const id = setTimeout(() => {
      continueWorking();
    }, 60_000);
    return () => clearTimeout(id);
  }, [showAlert]);

  useEffect(() => {
    if (!filterOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [filterOpen]);

  // Anchor-based countdown — computes remaining time from wall clock each tick
  useEffect(() => {
    if (!isRunning || isOvertime) return;
    const id = setInterval(() => {
      const anchor = startAnchorRef.current;
      if (!anchor) return;
      const elapsed = Math.floor((Date.now() - anchor.at) / 1000);
      const newTimeLeft = Math.max(0, anchor.timeLeft - elapsed);
      setTimeLeft(newTimeLeft);
      if (newTimeLeft <= 0) {
        clearInterval(id);
        setTimeout(() => {
          startAnchorRef.current = null;
          const s = settingsRef.current;
          const p = phaseRef.current;
          if (p === 'work') {
            onWorkTimerEnd();
          } else {
            setPhase('work');
            setTimeLeft(s.workMins * 60);
            setIsRunning(false);
          }
        }, 0);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, isOvertime]);

  // Anchor-based overtime count-up
  useEffect(() => {
    if (!isRunning || !isOvertime) return;
    const id = setInterval(() => {
      const anchor = overtimeAnchorRef.current;
      if (!anchor) return;
      const elapsed = Math.floor((Date.now() - anchor.at) / 1000);
      setOvertimeSeconds(anchor.secs + elapsed);
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, isOvertime]);

  // Persist timer state to localStorage on every relevant change
  useEffect(() => {
    const snapshot: TimerSnapshot = {
      phase,
      timeLeft,
      isRunning,
      isOvertime,
      overtimeSeconds,
      sessionRounds,
      startedAt: startAnchorRef.current?.at ?? null,
      timeLeftWhenStarted: startAnchorRef.current?.timeLeft ?? timeLeft,
      overtimeStartedAt: overtimeAnchorRef.current?.at ?? null,
      overtimeSecsWhenStarted: overtimeAnchorRef.current?.secs ?? overtimeSeconds,
    };
    localStorage.setItem('timerState', JSON.stringify(snapshot));
  }, [phase, timeLeft, isRunning, isOvertime, overtimeSeconds, sessionRounds]);

  useEffect(() => {
    localStorage.setItem('focusSessionHistory', JSON.stringify(history));
  }, [history]);

  function toggleRunning() {
    if (isRunning) {
      // Pausing: snap displayed value to actual elapsed
      if (startAnchorRef.current) {
        const elapsed = Math.floor((Date.now() - startAnchorRef.current.at) / 1000);
        setTimeLeft(Math.max(0, startAnchorRef.current.timeLeft - elapsed));
        startAnchorRef.current = null;
      }
      if (overtimeAnchorRef.current) {
        const elapsed = Math.floor((Date.now() - overtimeAnchorRef.current.at) / 1000);
        setOvertimeSeconds(overtimeAnchorRef.current.secs + elapsed);
        overtimeAnchorRef.current = null;
      }
      setIsRunning(false);
    } else {
      // Starting: pin anchor to current wall clock
      if (isOvertime) {
        overtimeAnchorRef.current = { at: Date.now(), secs: overtimeSeconds };
      } else {
        startAnchorRef.current = { at: Date.now(), timeLeft };
      }
      setIsRunning(true);
    }
  }

  function updateSettings(updates: Partial<TimerSettings>) {
    const next = { ...settings, ...updates };
    next.workMins = Math.max(1, Math.min(120, next.workMins));
    next.shortBreakMins = Math.max(1, Math.min(60, next.shortBreakMins));
    next.longBreakMins = Math.max(1, Math.min(60, next.longBreakMins));
    next.roundsPerLong = Math.max(1, Math.min(10, next.roundsPerLong));
    setSettings(next);
    localStorage.setItem('pomodoroSettings', JSON.stringify(next));
    if (!isRunning && !isOvertime) {
      if (phase === 'work') setTimeLeft(next.workMins * 60);
      else if (phase === 'short-break') setTimeLeft(next.shortBreakMins * 60);
      else setTimeLeft(next.longBreakMins * 60);
    }
  }

  function goToBreak(rounds: number) {
    const s = settingsRef.current;
    if (rounds % s.roundsPerLong === 0) {
      setPhase('long-break');
      setTimeLeft(s.longBreakMins * 60);
    } else {
      setPhase('short-break');
      setTimeLeft(s.shortBreakMins * 60);
    }
  }

  function selectTask(id: string | null) {
    taskStartTimeLeftRef.current = workSecs;
    onSelectTask(id);
    setIsRunning(false);
    setShowAlert(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
    setPhase('work');
    setTimeLeft(workSecs);
    startAnchorRef.current = null;
    overtimeAnchorRef.current = null;
  }

  function reset() {
    setIsRunning(false);
    setShowAlert(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
    setPhase('work');
    setTimeLeft(workSecs);
    setSessionRounds(0);
    startAnchorRef.current = null;
    overtimeAnchorRef.current = null;
  }

  function skipPhase() {
    setIsRunning(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
    startAnchorRef.current = null;
    overtimeAnchorRef.current = null;
    if (isBreak) {
      setPhase('work');
      setTimeLeft(workSecs);
    } else if (isOvertime) {
      addHistoryEntry();
      goToBreak(sessionRounds);
    } else {
      const next = sessionRounds + 1;
      setSessionRounds(next);
      goToBreak(next);
    }
  }

  function takeBreak() {
    addHistoryEntry();
    setShowAlert(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
    setIsRunning(false);
    startAnchorRef.current = null;
    overtimeAnchorRef.current = null;
    goToBreak(sessionRounds);
  }

  function continueWorking() {
    setShowAlert(false);
    setIsOvertime(true);
    setOvertimeSeconds(0);
    overtimeAnchorRef.current = { at: Date.now(), secs: 0 };
    setIsRunning(true);
  }

  // Ring visuals
  const isBreak = phase !== 'work';
  let ringColor: string;
  let progress: number;

  if (isOvertime) {
    ringColor = '#f59e0b';
    progress = Math.min(overtimeSeconds / workSecs, 1);
  } else {
    ringColor = isBreak ? '#10b981' : 'var(--accent)';
    progress = timeLeft / phaseDuration(phase);
  }

  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const dotsCompleted = sessionRounds % settings.roundsPerLong;
  const timerDisplay = isOvertime ? `+${formatTime(overtimeSeconds)}` : formatTime(timeLeft);

  return (
    <div className="focus-zone-outer">

    {/* LEFT: Task queue drawer */}
    <div className={`focus-task-drawer${taskDrawerOpen ? '' : ' focus-task-drawer--collapsed'}`}>
      {taskDrawerOpen && (
        <div className="focus-task-drawer-content">
          <div className="focus-drawer-header-row">
            <p className="focus-drawer-header">Task Queue</p>
            {queueProjects.length > 0 && (
              <div className="focus-drawer-filter-wrap" ref={filterRef}>
                <button
                  className={`focus-drawer-filter-btn${queueProjectFilter.size > 0 ? ' focus-drawer-filter-btn--active' : ''}`}
                  onClick={() => setFilterOpen(o => !o)}
                  title="Filter by project"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M1 2h10L7 6.5V10.5L5 9.5V6.5L1 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                  </svg>
                  {queueProjectFilter.size > 0 && (
                    <span className="focus-drawer-filter-count">{queueProjectFilter.size}</span>
                  )}
                </button>
                {filterOpen && (
                  <div className="focus-drawer-filter-dropdown">
                    {queueProjects.map(p => (
                      <label key={p.id} className="focus-drawer-filter-option">
                        <input
                          type="checkbox"
                          checked={queueProjectFilter.has(p.id)}
                          onChange={() => toggleProjectFilter(p.id)}
                        />
                        <span className="focus-drawer-filter-dot" style={{ background: p.color }} />
                        {p.name}
                      </label>
                    ))}
                    {queueProjectFilter.size > 0 && (
                      <button
                        className="focus-drawer-filter-clear"
                        onClick={() => setQueueProjectFilter(new Set())}
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          {filteredActiveTasks.length === 0 ? (
            <p className="focus-history-empty">{queueProjectFilter.size > 0 ? 'No active tasks match the filter' : 'No active tasks'}</p>
          ) : (
            filteredActiveTasks.map(task => {
              const status = statuses.find(s => s.id === task.statusId);
              const overdue = task.dueDate ? isDueDateOverdue(task.dueDate) : false;
              return (
                <div
                  key={task.id}
                  className={`focus-task-item${task.id === selectedTaskId ? ' focus-task-item--active' : ''}`}
                  onClick={() => handleDrawerTaskClick(task.id)}
                >
                  <div className="focus-task-item-title">{task.title}</div>
                  <div className="focus-task-item-meta">
                    <span className="focus-task-item-status" style={{ color: status?.color }}>● {status?.label}</span>
                    {task.dueDate && (
                      <span className={`focus-task-item-due${overdue ? ' focus-task-item-due--overdue' : ''}`}>
                        {overdue ? 'Overdue · ' : ''}{formatDueDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      <button
        className="focus-task-drawer-toggle"
        onClick={() => setTaskDrawerOpen(o => !o)}
        title={taskDrawerOpen ? 'Collapse task list' : 'Expand task list'}
      >
        {taskDrawerOpen ? '‹' : '›'}
      </button>
    </div>

    <div className="focus-zone">

      {/* Work-done alert modal */}
      {showAlert && (
        <div className="focus-alert-overlay">
          <div className="focus-alert">
            <span className="focus-alert-icon">🍅</span>
            <h3 className="focus-alert-title">Session complete!</h3>
            <p className="focus-alert-desc">
              {settings.workMins} minutes done. Take a well-earned break, or keep the momentum going?
            </p>
            <div className="focus-alert-actions">
              <button className="focus-alert-btn focus-alert-btn--break" onClick={takeBreak}>
                ☕ Take a Break
              </button>
              <button className="focus-alert-btn focus-alert-btn--continue" onClick={continueWorking}>
                ▶ Keep Going
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task selector */}
      <div className="focus-selector-wrap">
        <label className="focus-selector-label">Task</label>
        <select
          className="focus-selector"
          value={selectedTaskId ?? ''}
          onChange={e => {
            const id = e.target.value || null;
            if (showCompletePrompt && id) continueWithTask(id);
            else selectTask(id);
          }}
        >
          <option value="">— choose a task to focus on —</option>
          {statuses.map(status => {
            const statusTasks = tasks.filter(t => t.statusId === status.id);
            if (!statusTasks.length) return null;
            return (
              <optgroup key={status.id} label={status.label}>
                {statusTasks.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {/* Task highlight card */}
      {selectedTask ? (
        <div
          className="focus-task-card"
          style={project ? { borderColor: project.color + '80' } : undefined}
        >
          {project && (
            <span className="focus-task-project" style={{ color: project.color }}>
              ● {project.name}
            </span>
          )}
          <h2 className="focus-task-title">{selectedTask.title}</h2>
          <span className="focus-pomodoro-total">
            {(() => {
              const totalSecs = history
                .filter(e => e.taskId === selectedTask.id)
                .reduce((acc, e) => acc + e.sessionSecs, 0);
              return totalSecs > 0
                ? `⏱ ${formatMins(totalSecs)} total focus time`
                : '⏱ No focus time logged yet';
            })()}
          </span>
          {!isBreak && (
            <button className="focus-task-complete-btn" onClick={completeTask} title="Mark task complete and log time worked">
              ✓ Complete task
            </button>
          )}
        </div>
      ) : (
        <div className="focus-empty-hint">
          {showCompletePrompt
            ? '✓ Task marked complete — pick another task to continue your session'
            : 'Select a task above to begin your focus session'}
        </div>
      )}

      {/* Timer ring */}
      <div className={`focus-timer${isBreak ? ' focus-timer--break' : ''}${isOvertime ? ' focus-timer--overtime' : ''}`}>
        {!showSettings && (
          <svg className="focus-ring" viewBox="0 0 280 280" aria-hidden="true">
            <circle cx="140" cy="140" r={RADIUS} fill="none" stroke="var(--border)" strokeWidth="8" />
            <circle
              cx="140" cy="140" r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 140 140)"
              style={{ transition: isRunning ? 'stroke-dashoffset 1s linear' : 'none' }}
            />
          </svg>
        )}
        <div className="focus-timer-inner">
          <span className="focus-phase-label" style={isOvertime ? { color: '#f59e0b' } : undefined}>
            {phaseLabelStr(phase, isOvertime)}
          </span>
          <span className="focus-timer-display" style={isOvertime ? { color: '#f59e0b' } : undefined}>
            {timerDisplay}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="focus-controls">
        <button className="focus-ctrl focus-ctrl--icon" onClick={reset} title="Reset timer">↺</button>
        <button
          className={`focus-ctrl focus-ctrl--primary${isBreak ? ' focus-ctrl--break' : ''}${isOvertime ? ' focus-ctrl--overtime' : ''}`}
          onClick={toggleRunning}
          disabled={!selectedTask}
        >
          {isRunning ? '⏸ Pause' : '▶ Start'}
        </button>
        {isOvertime && (
          <button className="focus-ctrl focus-ctrl--primary focus-ctrl--break" onClick={takeBreak} title="End overtime and start break">
            ☕ Break
          </button>
        )}
        <button className="focus-ctrl focus-ctrl--icon" onClick={skipPhase} title="Skip phase">⏭</button>
      </div>

      {/* Session progress dots */}
      <div className="focus-session">
        <div className="focus-session-dots">
          {Array.from({ length: settings.roundsPerLong }).map((_, i) => (
            <div
              key={i}
              className={`focus-dot${i < dotsCompleted ? ' focus-dot--done' : ''}`}
              style={i < dotsCompleted ? { background: ringColor } : undefined}
            />
          ))}
        </div>
        <span className="focus-session-text">
          {sessionRounds} round{sessionRounds !== 1 ? 's' : ''} this session
          {sessionRounds > 0 && sessionRounds % settings.roundsPerLong === 0 && (
            <span className="focus-long-break-badge"> · long break earned</span>
          )}
        </span>
      </div>

      {/* Settings panel */}
      <div className="focus-settings">
        <button
          className="focus-settings-toggle"
          onClick={() => setShowSettings(s => !s)}
        >
          <span>⚙ Timer settings</span>
          <span className="focus-settings-chevron">{showSettings ? '▲' : '▼'}</span>
        </button>

        {showSettings && (
          <div className="focus-settings-panel">
            <div className="focus-settings-grid">
              <label className="focus-setting-label">Focus duration</label>
              <div className="focus-setting-control">
                <input
                  className="focus-setting-input"
                  type="number" min="1" max="120"
                  value={drafts.workMins ?? settings.workMins}
                  onChange={e => handleSettingChange('workMins', e.target.value)}
                  onBlur={() => handleSettingBlur('workMins')}
                />
                <span className="focus-setting-unit">min</span>
              </div>

              <label className="focus-setting-label">Short break</label>
              <div className="focus-setting-control">
                <input
                  className="focus-setting-input"
                  type="number" min="1" max="60"
                  value={drafts.shortBreakMins ?? settings.shortBreakMins}
                  onChange={e => handleSettingChange('shortBreakMins', e.target.value)}
                  onBlur={() => handleSettingBlur('shortBreakMins')}
                />
                <span className="focus-setting-unit">min</span>
              </div>

              <label className="focus-setting-label">Long break</label>
              <div className="focus-setting-control">
                <input
                  className="focus-setting-input"
                  type="number" min="1" max="60"
                  value={drafts.longBreakMins ?? settings.longBreakMins}
                  onChange={e => handleSettingChange('longBreakMins', e.target.value)}
                  onBlur={() => handleSettingBlur('longBreakMins')}
                />
                <span className="focus-setting-unit">min</span>
              </div>

              <label className="focus-setting-label">Rounds before long break</label>
              <div className="focus-setting-control">
                <input
                  className="focus-setting-input"
                  type="number" min="1" max="10"
                  value={drafts.roundsPerLong ?? settings.roundsPerLong}
                  onChange={e => handleSettingChange('roundsPerLong', e.target.value)}
                  onBlur={() => handleSettingBlur('roundsPerLong')}
                />
                <span className="focus-setting-unit">rounds</span>
              </div>
            </div>

            <button className="focus-settings-reset" onClick={() => updateSettings(DEFAULT_SETTINGS)}>
              Reset to defaults
            </button>
          </div>
        )}
      </div>

    </div>

    {/* Session history drawer */}
    <div className={`focus-history-drawer${historyOpen ? '' : ' focus-history-drawer--collapsed'}`}>
      <button
        className="focus-history-toggle"
        onClick={() => setHistoryOpen(o => !o)}
        title={historyOpen ? 'Collapse history' : 'Expand history'}
      >
        {historyOpen ? '›' : '‹'}
      </button>
      {historyOpen && (
        <div className="focus-history-content">
          <p className="focus-history-header">Session History</p>
          {history.length === 0 ? (
            <p className="focus-history-empty">Completed sessions will appear here</p>
          ) : (
            [...history].reverse().map((entry) => (
              <div key={entry.completedAt} className={`focus-history-card${entry.taskCompleted ? ' focus-history-card--completed' : ''}`} style={{ minHeight: cardHeight(entry.sessionSecs) }}>
                <div className="focus-history-task">{entry.taskTitle}</div>
                <div className="focus-history-times">
                  <span className="focus-history-session">+{formatMins(entry.sessionSecs)} this session</span>
                  <span className="focus-history-total">{formatMins(entry.cumulativeSecs)} total on task</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
    </div>
  );
}
