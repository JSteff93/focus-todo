import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Status, Task, Recurrence, Project } from '../types';
import { RecurrencePicker } from './RecurrencePicker';

interface Props {
  statuses: Status[];
  projects: Project[];
  defaultStatusId: string;
  defaultProjectId?: string;
  onAdd: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string) => void;
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

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function submit() {
    if (!title.trim()) return;
    onAdd(
      statusId,
      title.trim(),
      description.trim(),
      dueDate || undefined,
      recurrence,
      statusId === 'delegated' ? (assignee.trim() || undefined) : undefined,
      defaultProjectId ?? (projectId || undefined),
    );
    onClose();
  }

  const status = statuses.find(s => s.id === statusId);

  const drawer = (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>

        <div className="drawer-header">
          <input
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
              <input
                className="table-cell-input drawer-date-input"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
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
