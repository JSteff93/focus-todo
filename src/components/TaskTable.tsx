import { useState } from 'react';
import type { Status, Task } from '../types';

interface Props {
  statuses: Status[];
  tasks: Task[];
  addTask: (statusId: string, title: string, description: string, dueDate?: string) => void;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId'>>) => void;
  deleteTask: (id: string) => void;
}

type SortKey = 'title' | 'status' | 'dueDate' | 'createdAt';
type SortDir = 'asc' | 'desc';

function isOverdue(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface RowProps {
  task: Task;
  statuses: Status[];
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId'>>) => void;
  onDelete: (id: string) => void;
}

function TaskRow({ task, statuses, onUpdate, onDelete }: RowProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;
  const status = statuses.find(s => s.id === task.statusId);

  function commitTitle() {
    const trimmed = title.trim();
    if (!trimmed) { setTitle(task.title); return; }
    if (trimmed !== task.title) onUpdate(task.id, { title: trimmed });
  }

  function commitDesc() {
    if (description.trim() !== task.description) {
      onUpdate(task.id, { description: description.trim() });
    }
  }

  return (
    <tr className={overdue ? 'task-row--overdue' : ''}>
      <td className="col-title">
        <input
          className="table-cell-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        />
      </td>
      <td className="col-status">
        <div className="status-select-wrap">
          <span className="status-dot" style={{ background: status?.color }} />
          <select
            className="table-status-select"
            value={task.statusId}
            onChange={e => onUpdate(task.id, { statusId: e.target.value })}
          >
            {statuses.map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      </td>
      <td className="col-due">
        <span className={`due-display${overdue ? ' due-display--overdue' : ''}`}>
          {task.dueDate ? (
            <>
              {overdue && <span className="overdue-tag">Overdue</span>}
              <input
                className="table-cell-input table-date-input"
                type="date"
                value={task.dueDate}
                onChange={e => onUpdate(task.id, { dueDate: e.target.value || undefined })}
                title={formatDate(task.dueDate)}
              />
            </>
          ) : (
            <input
              className="table-cell-input table-date-input"
              type="date"
              value=""
              onChange={e => onUpdate(task.id, { dueDate: e.target.value || undefined })}
            />
          )}
        </span>
      </td>
      <td className="col-desc">
        <input
          className="table-cell-input"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={commitDesc}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          placeholder="—"
        />
      </td>
      <td className="col-actions">
        <button
          className="btn btn--ghost btn--icon btn--sm"
          onClick={() => onDelete(task.id)}
          title="Delete task"
        >
          ✕
        </button>
      </td>
    </tr>
  );
}

export function TaskTable({ statuses, tasks, addTask, updateTask, deleteTask }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [newTitle, setNewTitle] = useState('');
  const [newStatusId, setNewStatusId] = useState(statuses[0]?.id ?? '');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDesc, setNewDesc] = useState('');

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'title') {
      cmp = a.title.localeCompare(b.title);
    } else if (sortKey === 'status') {
      const aLabel = statuses.find(s => s.id === a.statusId)?.label ?? '';
      const bLabel = statuses.find(s => s.id === b.statusId)?.label ?? '';
      cmp = aLabel.localeCompare(bLabel);
    } else if (sortKey === 'dueDate') {
      if (!a.dueDate && !b.dueDate) cmp = 0;
      else if (!a.dueDate) cmp = 1;
      else if (!b.dueDate) cmp = -1;
      else cmp = a.dueDate.localeCompare(b.dueDate);
    } else {
      cmp = a.createdAt - b.createdAt;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function submitNewTask() {
    if (!newTitle.trim() || !newStatusId) return;
    addTask(newStatusId, newTitle.trim(), newDesc.trim(), newDueDate || undefined);
    setNewTitle('');
    setNewDesc('');
    setNewDueDate('');
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="sort-icon sort-icon--inactive">↕</span>;
    return <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const newStatus = statuses.find(s => s.id === newStatusId);

  return (
    <div className="task-list">
      <div className="task-list-meta">
        <span className="task-list-count">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="task-list-scroll">
        <table className="task-table">
          <thead>
            <tr>
              <th className="col-title" onClick={() => toggleSort('title')}>
                Title <SortIcon col="title" />
              </th>
              <th className="col-status" onClick={() => toggleSort('status')}>
                Status <SortIcon col="status" />
              </th>
              <th className="col-due" onClick={() => toggleSort('dueDate')}>
                Due Date <SortIcon col="dueDate" />
              </th>
              <th className="col-desc">Description</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                statuses={statuses}
                onUpdate={updateTask}
                onDelete={deleteTask}
              />
            ))}
            <tr className="add-task-row">
              <td className="col-title">
                <input
                  className="table-cell-input add-task-title-input"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="+ New task…"
                  onKeyDown={e => { if (e.key === 'Enter') submitNewTask(); }}
                />
              </td>
              <td className="col-status">
                <div className="status-select-wrap">
                  <span className="status-dot" style={{ background: newStatus?.color }} />
                  <select
                    className="table-status-select"
                    value={newStatusId}
                    onChange={e => setNewStatusId(e.target.value)}
                  >
                    {statuses.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </td>
              <td className="col-due">
                <input
                  className="table-cell-input table-date-input"
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                />
              </td>
              <td className="col-desc">
                <input
                  className="table-cell-input"
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Description (optional)"
                  onKeyDown={e => { if (e.key === 'Enter') submitNewTask(); }}
                />
              </td>
              <td className="col-actions">
                <button
                  className="btn btn--primary btn--sm"
                  onClick={submitNewTask}
                  disabled={!newTitle.trim()}
                >
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
