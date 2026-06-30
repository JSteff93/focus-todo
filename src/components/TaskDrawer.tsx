import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Status, Recurrence, Project } from '../types';
import { RecurrencePicker } from './RecurrencePicker';

interface Props {
  task: Task;
  statuses: Status[];
  projects: Project[];
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
  onClose: () => void;
}

export function TaskDrawer({ task, statuses, projects, onUpdate, onDelete, onComplete, onClose }: Props) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [assignee, setAssignee] = useState(task.assignee ?? '');

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function commitTitle() {
    const t = title.trim();
    if (!t) { setTitle(task.title); return; }
    if (t !== task.title) onUpdate(task.id, { title: t });
  }

  function commitDesc() {
    const d = description.trim();
    if (d !== task.description) onUpdate(task.id, { description: d });
  }

  function commitDue() {
    if ((dueDate || undefined) !== task.dueDate) {
      onUpdate(task.id, { dueDate: dueDate || undefined });
    }
  }

  function commitAssignee() {
    const a = assignee.trim() || undefined;
    if (a !== task.assignee) onUpdate(task.id, { assignee: a });
  }

  const status = statuses.find(s => s.id === task.statusId);

  const drawer = (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()}>

        <div className="drawer-header">
          <input
            className="drawer-title-input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur();
              if (e.key === 'Escape') onClose();
            }}
          />
          <div className="drawer-header-actions">
            {task.recurrence && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => { onComplete(task.id); onClose(); }}
                title="Mark done & schedule next"
              >
                ✓↻ Complete
              </button>
            )}
            <button
              className="btn btn--ghost btn--sm drawer-delete-btn"
              onClick={() => {
                if (window.confirm('Delete this task?')) { onDelete(task.id); onClose(); }
              }}
            >
              Delete
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
                  value={task.statusId}
                  onChange={e => onUpdate(task.id, { statusId: e.target.value })}
                >
                  {statuses.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            </div>

            <div className="drawer-field">
              <span className="drawer-field-label">Project</span>
              <select
                className="table-status-select drawer-select"
                value={task.projectId ?? ''}
                onChange={e => onUpdate(task.id, { projectId: e.target.value || undefined })}
              >
                <option value="">—</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            <div className="drawer-field">
              <span className="drawer-field-label">Due Date</span>
              <input
                className="table-cell-input drawer-date-input"
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                onBlur={commitDue}
              />
            </div>

            {task.statusId === 'delegated' && (
              <div className="drawer-field">
                <span className="drawer-field-label">Assignee</span>
                <input
                  className="table-cell-input"
                  value={assignee}
                  onChange={e => setAssignee(e.target.value)}
                  onBlur={commitAssignee}
                  onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  placeholder="Name"
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
              onBlur={commitDesc}
              placeholder="Add notes, details, or context…"
            />
          </div>

          <div className="drawer-recurrence-section">
            <span className="drawer-field-label">Repeat</span>
            <RecurrencePicker
              value={task.recurrence}
              onChange={rec => onUpdate(task.id, { recurrence: rec })}
            />
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
