import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { Status, Recurrence, Project } from '../types';
import { RecurrencePicker } from './RecurrencePicker';

function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getToday() { return toDateInput(new Date()); }

function getTomorrow() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateInput(d);
}

function getEndOfWeek() {
  const d = new Date();
  const diff = (5 - d.getDay() + 7) % 7; // days until Friday (0 if today is Friday)
  d.setDate(d.getDate() + diff);
  return toDateInput(d);
}

interface Props {
  statuses: Status[];
  projects: Project[];
  defaultStatusId: string;
  defaultProjectId?: string;
  onAdd: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string, estimatedFocusMins?: number) => void;
  onClose: () => void;
}

export function CreateTaskDrawer({ statuses, projects, defaultStatusId, defaultProjectId, onAdd, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState(defaultStatusId);
  const [projectId, setProjectId] = useState(defaultProjectId ?? '');
  const [dueDate, setDueDate] = useState('');
  const [assignee, setAssignee] = useState('');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(undefined);
  const [estimatedFocusMins, setEstimatedFocusMins] = useState<string>('');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function buildPayload() {
    return {
      statusId,
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate || undefined,
      recurrence,
      assignee: statusId === 'delegated' ? (assignee.trim() || undefined) : undefined,
      resolvedProjectId: defaultProjectId ?? (projectId || undefined),
      estimatedFocusMins: estimatedFocusMins ? parseInt(estimatedFocusMins, 10) : undefined,
    };
  }

  function submit() {
    if (!title.trim()) return;
    const p = buildPayload();
    onAdd(p.statusId, p.title, p.description, p.dueDate, p.recurrence, p.assignee, p.resolvedProjectId, p.estimatedFocusMins);
    onClose();
  }

  function submitAndAnother() {
    if (!title.trim()) return;
    const p = buildPayload();
    onAdd(p.statusId, p.title, p.description, p.dueDate, p.recurrence, p.assignee, p.resolvedProjectId, p.estimatedFocusMins);
    setTitle('');
    setDescription('');
    setDueDate('');
    setAssignee('');
    setRecurrence(undefined);
    setEstimatedFocusMins('');
    setTimeout(() => titleRef.current?.focus(), 0);
  }

  const status = statuses.find(s => s.id === statusId);

  const drawer = (
    <div className="drawer-overlay">
      <div className="drawer" onClick={e => e.stopPropagation()}>

        <div className="drawer-header">
          <input
            ref={titleRef}
            className="drawer-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Task title…"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') submit();
              if (e.key === 'Escape') onClose();
            }}
          />
          <div className="drawer-header-actions">
            <button
              className="btn btn--ghost btn--sm"
              onClick={submitAndAnother}
              disabled={!title.trim()}
            >
              Create &amp; add another
            </button>
            <button
              className="btn btn--primary btn--sm"
              onClick={submit}
              disabled={!title.trim()}
            >
              Create
            </button>
            <button className="btn btn--ghost btn--icon" onClick={onClose} title="Close (Esc)">✕</button>
          </div>
        </div>

        <div className="drawer-body">
          <div className="drawer-fields">
            <div className="drawer-field">
              <span className="drawer-field-label">Status</span>
              <div className="status-select-wrap">
                <span className="status-dot" style={{ background: status?.color }} />
                <select
                  className="table-status-select drawer-select"
                  value={statusId}
                  onChange={e => setStatusId(e.target.value)}
                >
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            {!defaultProjectId && (
              <div className="drawer-field">
                <span className="drawer-field-label">Project</span>
                <select
                  className="table-status-select drawer-select"
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                >
                  <option value="">—</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            <div className="drawer-field">
              <span className="drawer-field-label">Due Date</span>
              <div className="drawer-date-wrap">
                <input
                  className="table-cell-input drawer-date-input"
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                />
                <div className="drawer-date-quick">
                  {[
                    { label: 'Today', value: getToday() },
                    { label: 'Tomorrow', value: getTomorrow() },
                    { label: 'End of Week', value: getEndOfWeek() },
                  ].map(({ label, value }) => (
                    <button
                      key={label}
                      type="button"
                      className={`drawer-date-quick-btn${dueDate === value ? ' drawer-date-quick-btn--active' : ''}`}
                      onClick={() => setDueDate(d => d === value ? '' : value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="drawer-field">
              <span className="drawer-field-label">Focus time (min)</span>
              <input
                className="table-cell-input drawer-number-input"
                type="number"
                min="1"
                value={estimatedFocusMins}
                onChange={e => setEstimatedFocusMins(e.target.value)}
                placeholder="e.g. 30"
              />
            </div>

            {statusId === 'delegated' && (
              <div className="drawer-field">
                <span className="drawer-field-label">Assignee</span>
                <input
                  className="table-cell-input"
                  value={assignee}
                  onChange={e => setAssignee(e.target.value)}
                  placeholder="Name"
                  onKeyDown={e => { if (e.key === 'Enter') submit(); }}
                />
              </div>
            )}
          </div>

          <div className="drawer-notes-section">
            <span className="drawer-field-label">Notes</span>
            <textarea
              className="drawer-notes-textarea"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add notes, details, or context…"
            />
          </div>

          <div className="drawer-recurrence-section">
            <span className="drawer-field-label">Repeat</span>
            <RecurrencePicker value={recurrence} onChange={setRecurrence} />
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
