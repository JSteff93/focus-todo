import { useEffect, useRef, useState } from 'react';
import type { Project, SessionEntry, Task } from '../types';
import { BUSY_WORK_ID, MEETING_ID, MANUAL_ID_PREFIX } from '../utils/focusSessionStatus';

type Mode = 'task' | 'preset' | 'custom';
type Preset = 'meeting' | 'busy';

export interface AddSessionResult {
  taskId: string;
  taskTitle: string;
  startMs: number;
  endMs: number;
}

interface Props {
  tasks: Task[];
  projects: Project[];
  // All logged sessions — only used to warn (not block) when the entered
  // time range overlaps an existing one.
  history: SessionEntry[];
  defaultDate: string; // YYYY-MM-DD, the day currently in view on the timeline
  // Present when editing an existing entry (timer-logged or manual) instead
  // of creating a new one — pre-fills the form and swaps Add for Save/Delete.
  editing?: SessionEntry | null;
  // Present when creating a new entry from a timeline click/drag — pre-fills
  // the date/start/end instead of the hardcoded defaults. Ignored if editing.
  prefill?: { startMs: number; endMs: number } | null;
  // onAdd is only called when creating, onSave/onDelete only when editing —
  // a host that only ever does one of the two can leave the others out.
  onAdd?: (result: AddSessionResult) => void;
  onSave?: (id: string, result: AddSessionResult) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

function combine(dateStr: string, timeStr: string): number | null {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [h, min] = timeStr.split(':').map(Number);
  if ([y, m, d, h, min].some(n => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d, h, min, 0, 0).getTime();
}

function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toTimeInputValue(d: Date): string {
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function fmtClock(ts: number) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function modeForTaskId(taskId: string): Mode {
  if (taskId === MEETING_ID || taskId === BUSY_WORK_ID) return 'preset';
  if (taskId.startsWith(MANUAL_ID_PREFIX)) return 'custom';
  return 'task';
}

export function AddSessionModal({ tasks, projects, history, defaultDate, editing, prefill, onAdd, onSave, onDelete, onClose }: Props) {
  const editStart = editing
    ? new Date(editing.completedAt - editing.sessionSecs * 1000)
    : (prefill ? new Date(prefill.startMs) : null);
  const editEnd = editing
    ? new Date(editing.completedAt)
    : (prefill ? new Date(prefill.endMs) : null);
  const initialMode = editing ? modeForTaskId(editing.taskId) : 'task';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [taskId, setTaskId] = useState(editing && initialMode === 'task' ? editing.taskId : '');
  const [preset, setPreset] = useState<Preset>(editing?.taskId === BUSY_WORK_ID ? 'busy' : 'meeting');
  const [customText, setCustomText] = useState(editing && initialMode === 'custom' ? editing.taskTitle : '');
  const [date, setDate] = useState(editStart ? toDateInputValue(editStart) : defaultDate);
  const [startTime, setStartTime] = useState(editStart ? toTimeInputValue(editStart) : '09:00');
  const [endTime, setEndTime] = useState(editEnd ? toTimeInputValue(editEnd) : '09:25');
  const [error, setError] = useState('');
  const [projectFilter, setProjectFilter] = useState<Set<string>>(() => new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setFilterOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [filterOpen]);

  // The task this entry currently points to may no longer be in the active
  // (pickable) list — completed, delegated, or deleted since — but editing
  // shouldn't silently blank out what it was. Keep it selectable.
  const taskOptions = editing && initialMode === 'task' && !tasks.some(t => t.id === editing.taskId)
    ? [{ id: editing.taskId, title: `${editing.taskTitle} (no longer active)` } as Task, ...tasks]
    : tasks;

  const filterableProjects = projects.filter(p => tasks.some(t => t.projectId === p.id));
  // Keep whatever's currently selected visible even if it falls outside the
  // filter — narrowing the project filter shouldn't silently blank out a
  // choice already made.
  const visibleTaskOptions = projectFilter.size > 0
    ? taskOptions.filter(t => t.id === taskId || (t.projectId != null && projectFilter.has(t.projectId)))
    : taskOptions;

  function toggleProjectFilter(id: string) {
    setProjectFilter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // The form only has minute precision, but timer-logged entries carry
  // seconds — a field the user didn't touch keeps its original exact value,
  // so opening and saving an entry unchanged doesn't nudge it.
  function resolveTimes(): { startMs: number | null; endMs: number | null } {
    const sameDate = editStart != null && date === toDateInputValue(editStart);
    const startMs = editing && sameDate && startTime === toTimeInputValue(editStart!)
      ? editStart!.getTime()
      : combine(date, startTime);
    const endMs = editing && editEnd && date === toDateInputValue(editEnd) && endTime === toTimeInputValue(editEnd)
      ? editEnd.getTime()
      : combine(date, endTime);
    return { startMs, endMs };
  }

  // Overlapping another session is allowed (e.g. a meeting logged on top of
  // a timer run), just flagged so it isn't done by accident.
  const preview = resolveTimes();
  const overlapping = preview.startMs !== null && preview.endMs !== null && preview.endMs > preview.startMs
    ? history.find(e => e.id !== editing?.id
        && e.completedAt > preview.startMs!
        && e.completedAt - e.sessionSecs * 1000 < preview.endMs!)
    : undefined;

  function submit() {
    const { startMs, endMs } = resolveTimes();
    if (startMs === null || endMs === null) {
      setError('Enter a valid date and time.');
      return;
    }
    if (endMs <= startMs) {
      setError('End time must be after start time.');
      return;
    }

    let resolvedTaskId: string;
    let resolvedTitle: string;
    if (mode === 'task') {
      const task = taskOptions.find(t => t.id === taskId);
      if (!task) {
        setError('Select a task.');
        return;
      }
      resolvedTaskId = task.id;
      resolvedTitle = task.title;
    } else if (mode === 'preset') {
      resolvedTaskId = preset === 'meeting' ? MEETING_ID : BUSY_WORK_ID;
      resolvedTitle = preset === 'meeting' ? 'Meeting' : 'Busy Work';
    } else {
      const trimmed = customText.trim();
      if (!trimmed) {
        setError('Enter a description.');
        return;
      }
      resolvedTaskId = editing && modeForTaskId(editing.taskId) === 'custom'
        ? editing.taskId
        : `${MANUAL_ID_PREFIX}${Math.random().toString(36).slice(2, 10)}`;
      resolvedTitle = trimmed;
    }

    if (editing) {
      onSave?.(editing.id, { taskId: resolvedTaskId, taskTitle: resolvedTitle, startMs, endMs });
    } else {
      onAdd?.({ taskId: resolvedTaskId, taskTitle: resolvedTitle, startMs, endMs });
    }
    onClose();
  }

  function handleDelete() {
    if (!editing) return;
    if (window.confirm('Delete this session?')) {
      onDelete?.(editing.id);
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{editing ? 'Edit Session' : 'Add Session'}</h2>

        <span className="form-label">What were you working on?</span>
        <div className="modal-tab-group">
          <button className={`modal-tab${mode === 'task' ? ' modal-tab--active' : ''}`} onClick={() => setMode('task')}>Task</button>
          <button className={`modal-tab${mode === 'preset' ? ' modal-tab--active' : ''}`} onClick={() => setMode('preset')}>Preset</button>
          <button className={`modal-tab${mode === 'custom' ? ' modal-tab--active' : ''}`} onClick={() => setMode('custom')}>Custom</button>
        </div>

        {mode === 'task' && (
          <div className="add-session-task-row add-session-field">
            <select
              className="task-input"
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              autoFocus
            >
              <option value="">— choose a task —</option>
              {visibleTaskOptions.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {filterableProjects.length > 0 && (
              <div className="focus-drawer-filter-wrap" ref={filterRef}>
                <button
                  className={`focus-drawer-filter-btn${projectFilter.size > 0 ? ' focus-drawer-filter-btn--active' : ''}`}
                  onClick={() => setFilterOpen(o => !o)}
                  title="Filter by project"
                  type="button"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M1 2h10L7 6.5V10.5L5 9.5V6.5L1 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none"/>
                  </svg>
                  {projectFilter.size > 0 && (
                    <span className="focus-drawer-filter-count">{projectFilter.size}</span>
                  )}
                </button>
                {filterOpen && (
                  <div className="focus-drawer-filter-dropdown">
                    {filterableProjects.map(p => (
                      <label key={p.id} className="focus-drawer-filter-option">
                        <input
                          type="checkbox"
                          checked={projectFilter.has(p.id)}
                          onChange={() => toggleProjectFilter(p.id)}
                        />
                        <span className="focus-drawer-filter-dot" style={{ background: p.color }} />
                        {p.name}
                      </label>
                    ))}
                    {projectFilter.size > 0 && (
                      <button
                        className="focus-drawer-filter-clear"
                        onClick={() => setProjectFilter(new Set())}
                      >
                        Clear filter
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {mode === 'preset' && (
          <div className="modal-tab-group add-session-field">
            <button className={`modal-tab${preset === 'meeting' ? ' modal-tab--active' : ''}`} onClick={() => setPreset('meeting')}>📅 Meeting</button>
            <button className={`modal-tab${preset === 'busy' ? ' modal-tab--active' : ''}`} onClick={() => setPreset('busy')}>📥 Busy Work</button>
          </div>
        )}

        {mode === 'custom' && (
          <input
            className="task-input add-session-field"
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="e.g. Doctor appointment"
            autoFocus
          />
        )}

        <label className="form-label add-session-field">Date</label>
        <input
          className="task-input task-date-input"
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
        />

        <div className="add-session-time-row">
          <div>
            <label className="form-label">Start</label>
            <input
              className="task-input task-date-input"
              type="time"
              value={startTime}
              onChange={e => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">End</label>
            <input
              className="task-input task-date-input"
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
            />
          </div>
        </div>

        {overlapping && (
          <p className="add-session-warning">
            ⚠ Overlaps “{overlapping.taskTitle}” ({fmtClock(overlapping.completedAt - overlapping.sessionSecs * 1000)}–{fmtClock(overlapping.completedAt)}). You can still save.
          </p>
        )}
        {error && <p className="auth-error">{error}</p>}

        <div className="modal-actions">
          <button className="btn btn--primary" onClick={submit}>{editing ? 'Save Changes' : 'Add Session'}</button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          {editing && (
            <button className="btn btn--ghost drawer-delete-btn" onClick={handleDelete}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
