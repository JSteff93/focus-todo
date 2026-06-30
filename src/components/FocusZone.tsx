import { useState, useEffect, useRef } from 'react';
import type { Task, Status, Project } from '../types';

const WORK_SECS = 25 * 60;
const SHORT_BREAK_SECS = 5 * 60;
const LONG_BREAK_SECS = 15 * 60;
const ROUNDS_PER_LONG = 4;
const RADIUS = 90;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Phase = 'work' | 'short-break' | 'long-break';

interface Props {
  tasks: Task[];
  statuses: Status[];
  projects: Project[];
  selectedTaskId: string | null;
  onSelectTask: (id: string | null) => void;
  onIncrementPomodoro: (taskId: string) => void;
}

function formatTime(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function phaseLabel(phase: Phase) {
  if (phase === 'work') return 'Focus';
  if (phase === 'short-break') return 'Short Break';
  return 'Long Break';
}

function phaseDuration(phase: Phase) {
  if (phase === 'work') return WORK_SECS;
  if (phase === 'short-break') return SHORT_BREAK_SECS;
  return LONG_BREAK_SECS;
}

export function FocusZone({ tasks, statuses, projects, selectedTaskId, onSelectTask, onIncrementPomodoro }: Props) {
  const [phase, setPhase] = useState<Phase>('work');
  const [timeLeft, setTimeLeft] = useState(WORK_SECS);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionRounds, setSessionRounds] = useState(0);

  const selectedTask = selectedTaskId ? (tasks.find(t => t.id === selectedTaskId) ?? null) : null;
  const project = selectedTask?.projectId ? (projects.find(p => p.id === selectedTask.projectId) ?? null) : null;

  // Refs to keep interval callback current without re-registering
  const phaseRef = useRef(phase);
  const sessionRoundsRef = useRef(sessionRounds);
  const selectedTaskIdRef = useRef(selectedTaskId);
  const onIncrementRef = useRef(onIncrementPomodoro);
  phaseRef.current = phase;
  sessionRoundsRef.current = sessionRounds;
  selectedTaskIdRef.current = selectedTaskId;
  onIncrementRef.current = onIncrementPomodoro;

  // Document title shows countdown while running
  useEffect(() => {
    if (isRunning) {
      document.title = `${formatTime(timeLeft)} · ${phaseLabel(phase)} — Focus Board`;
    } else {
      document.title = 'Focus Board';
    }
  }, [timeLeft, isRunning, phase]);

  useEffect(() => () => { document.title = 'Focus Board'; }, []);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Transition outside the setState callback to avoid stale state reads
          setTimeout(() => {
            const p = phaseRef.current;
            if (p === 'work') {
              const tid = selectedTaskIdRef.current;
              if (tid) onIncrementRef.current(tid);
              const next = sessionRoundsRef.current + 1;
              setSessionRounds(next);
              if (next % ROUNDS_PER_LONG === 0) {
                setPhase('long-break');
                setTimeLeft(LONG_BREAK_SECS);
              } else {
                setPhase('short-break');
                setTimeLeft(SHORT_BREAK_SECS);
              }
            } else {
              setPhase('work');
              setTimeLeft(WORK_SECS);
            }
            setIsRunning(false);
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  function selectTask(id: string | null) {
    onSelectTask(id);
    setIsRunning(false);
    setPhase('work');
    setTimeLeft(WORK_SECS);
    setSessionRounds(0);
  }

  function reset() {
    setIsRunning(false);
    setPhase('work');
    setTimeLeft(WORK_SECS);
    setSessionRounds(0);
  }

  function skipPhase() {
    setIsRunning(false);
    if (phase === 'work') {
      const next = sessionRounds + 1;
      setSessionRounds(next);
      if (next % ROUNDS_PER_LONG === 0) {
        setPhase('long-break');
        setTimeLeft(LONG_BREAK_SECS);
      } else {
        setPhase('short-break');
        setTimeLeft(SHORT_BREAK_SECS);
      }
    } else {
      setPhase('work');
      setTimeLeft(WORK_SECS);
    }
  }

  const totalSecs = phaseDuration(phase);
  const progress = timeLeft / totalSecs;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const isBreak = phase !== 'work';
  const ringColor = isBreak ? '#10b981' : '#6366f1';
  const dotsCompleted = sessionRounds % ROUNDS_PER_LONG;

  return (
    <div className="focus-zone">

      {/* Task selector */}
      <div className="focus-selector-wrap">
        <label className="focus-selector-label">Task</label>
        <select
          className="focus-selector"
          value={selectedTaskId ?? ''}
          onChange={e => selectTask(e.target.value || null)}
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
          {selectedTask.description && (
            <p className="focus-task-desc">{selectedTask.description}</p>
          )}
          <span className="focus-pomodoro-total">
            🍅 {selectedTask.pomodoroCount ?? 0} pomodoro{(selectedTask.pomodoroCount ?? 0) !== 1 ? 's' : ''} completed
          </span>
        </div>
      ) : (
        <div className="focus-empty-hint">
          Select a task above to begin your focus session
        </div>
      )}

      {/* Timer ring */}
      <div className={`focus-timer${isBreak ? ' focus-timer--break' : ''}`}>
        <svg className="focus-ring" viewBox="0 0 200 200" aria-hidden="true">
          <circle
            cx="100" cy="100" r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth="6"
          />
          <circle
            cx="100" cy="100" r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            style={{ transition: isRunning ? 'stroke-dashoffset 1s linear' : 'none' }}
          />
        </svg>
        <div className="focus-timer-inner">
          <span className="focus-phase-label">{phaseLabel(phase)}</span>
          <span className="focus-timer-display">{formatTime(timeLeft)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="focus-controls">
        <button
          className="focus-ctrl focus-ctrl--icon"
          onClick={reset}
          title="Reset timer"
        >
          ↺
        </button>
        <button
          className={`focus-ctrl focus-ctrl--primary${isBreak ? ' focus-ctrl--break' : ''}`}
          onClick={() => setIsRunning(r => !r)}
          disabled={!selectedTask}
        >
          {isRunning ? '⏸ Pause' : '▶ Start'}
        </button>
        <button
          className="focus-ctrl focus-ctrl--icon"
          onClick={skipPhase}
          title="Skip phase"
        >
          ⏭
        </button>
      </div>

      {/* Session progress dots */}
      <div className="focus-session">
        <div className="focus-session-dots">
          {Array.from({ length: ROUNDS_PER_LONG }).map((_, i) => (
            <div
              key={i}
              className={`focus-dot${i < dotsCompleted ? ' focus-dot--done' : ''}`}
              style={i < dotsCompleted ? { background: ringColor } : undefined}
            />
          ))}
        </div>
        <span className="focus-session-text">
          {sessionRounds} round{sessionRounds !== 1 ? 's' : ''} this session
          {sessionRounds > 0 && sessionRounds % ROUNDS_PER_LONG === 0 && (
            <span className="focus-long-break-badge"> · long break earned</span>
          )}
        </span>
      </div>

    </div>
  );
}
