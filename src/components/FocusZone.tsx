import { useState, useEffect, useRef } from 'react';
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

function phaseLabelStr(phase: Phase, isOvertime: boolean) {
  if (isOvertime) return 'Overtime';
  if (phase === 'work') return 'Focus';
  if (phase === 'short-break') return 'Short Break';
  return 'Long Break';
}

export function FocusZone({ tasks, statuses, projects, selectedTaskId, onSelectTask, onIncrementPomodoro, onUpdateTask }: Props) {
  const [settings, setSettings] = useState<TimerSettings>(loadSettings);

  // Derived durations — update any time settings change
  const workSecs = settings.workMins * 60;
  const shortBreakSecs = settings.shortBreakMins * 60;
  const longBreakSecs = settings.longBreakMins * 60;

  function phaseDuration(p: Phase) {
    if (p === 'work') return workSecs;
    if (p === 'short-break') return shortBreakSecs;
    return longBreakSecs;
  }

  const [phase, setPhase] = useState<Phase>('work');
  const [timeLeft, setTimeLeft] = useState(workSecs);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionRounds, setSessionRounds] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);
  const [overtimeSeconds, setOvertimeSeconds] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [drafts, setDrafts] = useState<Partial<Record<keyof TimerSettings, string>>>({});
  const [history, setHistory] = useState<SessionEntry[]>(loadHistory);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [showCompletePrompt, setShowCompletePrompt] = useState(false);

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

  // Refs so interval callbacks always read current values
  const phaseRef = useRef(phase);
  const isOvertimeRef = useRef(isOvertime);
  const overtimeSecondsRef = useRef(overtimeSeconds);
  const sessionRoundsRef = useRef(sessionRounds);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const onIncrementRef = useRef(onIncrementPomodoro);
  const onUpdateTaskRef = useRef(onUpdateTask);
  const settingsRef = useRef(settings);
  const selectedTaskTitleRef = useRef<string | null>(null);
  phaseRef.current = phase;
  isOvertimeRef.current = isOvertime;
  overtimeSecondsRef.current = overtimeSeconds;
  sessionRoundsRef.current = sessionRounds;
  selectedTaskIdRef.current = selectedTaskId;
  selectedTaskTitleRef.current = selectedTask?.title ?? null;
  onIncrementRef.current = onIncrementPomodoro;
  onUpdateTaskRef.current = onUpdateTask;
  settingsRef.current = settings;

  function addHistoryEntry() {
    const tid = selectedTaskIdRef.current;
    if (!tid) return;
    onIncrementRef.current(tid);
    const title = selectedTaskTitleRef.current ?? 'Unknown task';
    const workSecs = settingsRef.current.workMins * 60;
    const rawSecs = isOvertimeRef.current ? workSecs + overtimeSecondsRef.current : workSecs;
    const sessionSecs = Math.round(rawSecs / 60) * 60;
    setHistory(prev => {
      const prevCumulative = prev
        .filter(e => e.taskId === tid)
        .reduce((acc, e) => acc + e.sessionSecs, 0);
      return [...prev, { taskId: tid, taskTitle: title, sessionSecs, cumulativeSecs: prevCumulative + sessionSecs, completedAt: Date.now() }];
    });
  }

  function onWorkTimerEnd() {
    setSessionRounds(r => r + 1);
    setIsRunning(false);
    setShowAlert(true);
  }

  function completeTask() {
    const tid = selectedTaskIdRef.current;
    if (!tid) return;
    const title = selectedTaskTitleRef.current ?? 'Unknown task';
    const workedSecs = isOvertimeRef.current
      ? settingsRef.current.workMins * 60 + overtimeSecondsRef.current
      : settingsRef.current.workMins * 60 - timeLeft;
    const sessionSecs = Math.max(60, Math.round(workedSecs / 60) * 60);
    setHistory(prev => {
      const prevCumulative = prev
        .filter(e => e.taskId === tid)
        .reduce((acc, e) => acc + e.sessionSecs, 0);
      return [...prev, { taskId: tid, taskTitle: title, sessionSecs, cumulativeSecs: prevCumulative + sessionSecs, completedAt: Date.now() }];
    });
    onUpdateTaskRef.current(tid, { statusId: 'complete' });
    setIsRunning(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
    setShowAlert(false);
    onSelectTask(null);
    setShowCompletePrompt(true);
  }

  function continueWithTask(id: string) {
    onSelectTask(id);
    setShowCompletePrompt(false);
  }

  // Document title live countdown
  useEffect(() => {
    const display = isOvertime ? `+${formatTime(overtimeSeconds)}` : formatTime(timeLeft);
    if (isRunning) {
      document.title = `${display} · ${phaseLabelStr(phase, isOvertime)} — Focus Board`;
    } else {
      document.title = 'Focus Board';
    }
  }, [timeLeft, overtimeSeconds, isRunning, phase, isOvertime]);

  useEffect(() => () => { document.title = 'Focus Board'; }, []);

  // Normal countdown
  useEffect(() => {
    if (!isRunning || isOvertime) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setTimeout(() => {
            const s = settingsRef.current;
            const p = phaseRef.current;
            if (p === 'work') {
              onWorkTimerEnd();
            } else {
              // Break finished — auto-return to work
              setPhase('work');
              setTimeLeft(s.workMins * 60);
              setIsRunning(false);
            }
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning, isOvertime]);

  // Overtime count-up
  useEffect(() => {
    if (!isRunning || !isOvertime) return;
    const id = setInterval(() => setOvertimeSeconds(prev => prev + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning, isOvertime]);

  useEffect(() => {
    localStorage.setItem('focusSessionHistory', JSON.stringify(history));
  }, [history]);

  function updateSettings(updates: Partial<TimerSettings>) {
    const next = { ...settings, ...updates };
    // Clamp to sane ranges
    next.workMins = Math.max(1, Math.min(120, next.workMins));
    next.shortBreakMins = Math.max(1, Math.min(60, next.shortBreakMins));
    next.longBreakMins = Math.max(1, Math.min(60, next.longBreakMins));
    next.roundsPerLong = Math.max(1, Math.min(10, next.roundsPerLong));
    setSettings(next);
    localStorage.setItem('pomodoroSettings', JSON.stringify(next));
    // Update the visible countdown immediately when not running
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
    onSelectTask(id);
    setIsRunning(false);
    setShowAlert(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
    setPhase('work');
    setTimeLeft(workSecs);
  }

  function reset() {
    setIsRunning(false);
    setShowAlert(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
    setPhase('work');
    setTimeLeft(workSecs);
    setSessionRounds(0);
  }

  function skipPhase() {
    setIsRunning(false);
    setIsOvertime(false);
    setOvertimeSeconds(0);
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
    goToBreak(sessionRounds);
  }

  function continueWorking() {
    setShowAlert(false);
    setIsOvertime(true);
    setOvertimeSeconds(0);
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
    ringColor = isBreak ? '#10b981' : '#6366f1';
    progress = timeLeft / phaseDuration(phase);
  }

  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const dotsCompleted = sessionRounds % settings.roundsPerLong;
  const timerDisplay = isOvertime ? `+${formatTime(overtimeSeconds)}` : formatTime(timeLeft);

  return (
    <div className="focus-zone-outer">
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
            🍅 {selectedTask.pomodoroCount ?? 0} pomodoro{(selectedTask.pomodoroCount ?? 0) !== 1 ? 's' : ''} completed
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
          onClick={() => setIsRunning(r => !r)}
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
        {!isBreak && !isOvertime && selectedTask && (
          <button className="focus-ctrl focus-ctrl--test" onClick={onWorkTimerEnd} title="Test: simulate session complete">
            ✓ Done
          </button>
        )}
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
              <div key={entry.completedAt} className="focus-history-card" style={{ minHeight: cardHeight(entry.sessionSecs) }}>
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
