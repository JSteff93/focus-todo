import { useState } from 'react';
import type { Status } from '../types';
import { findTodoStatus } from '../store';

interface Props {
  status: Status;
  statuses: Status[];
  taskCount: number;
  onConfirm: (moveTasksTo: string | null) => void;
  onClose: () => void;
}

export function DeleteColumnModal({ status, statuses, taskCount, onConfirm, onClose }: Props) {
  const targets = statuses.filter(s => s.id !== status.id);
  const [action, setAction] = useState<'move' | 'delete'>('move');
  const [moveTo, setMoveTo] = useState(() => findTodoStatus(targets)?.id ?? '');
  const noun = taskCount === 1 ? 'task' : 'tasks';

  function submit() {
    onConfirm(action === 'move' ? moveTo : null);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-column-title"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        <h2 className="modal-title" id="delete-column-title">Remove "{status.label}" column?</h2>
        {/* Columns are shared by every project board, so the count spans all of
            them — it can be more than the cards visible on this board. */}
        <p className="delete-column-note">
          It has {taskCount} {noun} across all projects, including any completed earlier and hidden from the board.
        </p>
        <div className="delete-column-options">
          <label className="delete-column-option">
            <input type="radio" name="delete-column-action" checked={action === 'move'} onChange={() => setAction('move')} />
            <span>Move its {taskCount} {noun} to</span>
          </label>
          <select
            className="task-input delete-column-select"
            value={moveTo}
            onChange={e => { setMoveTo(e.target.value); setAction('move'); }}
            aria-label="Column to move tasks to"
          >
            {targets.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <label className="delete-column-option">
            <input type="radio" name="delete-column-action" checked={action === 'delete'} onChange={() => setAction('delete')} />
            <span>Delete the {taskCount} {noun}</span>
          </label>
        </div>
        <div className="modal-actions">
          <button
            className={`btn ${action === 'delete' ? 'btn--danger' : 'btn--primary'}`}
            onClick={submit}
            autoFocus
          >
            {action === 'delete' ? `Delete column and ${noun}` : 'Move and remove column'}
          </button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
