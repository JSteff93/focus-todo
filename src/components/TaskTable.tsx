import { useState } from 'react';
import type { Status, Task, Recurrence, Project } from '../types';
import { describeRecurrence } from '../utils/recurrence';
import { RecurrencePicker } from './RecurrencePicker';

interface Props {
  statuses: Status[];
  tasks: Task[];
  projects: Project[];
  addTask: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string, estimatedFocusMins?: number) => void;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  deleteTask: (id: string) => void;
  completeRecurring: (taskId: string) => void;
}

type SortKey = 'title' | 'status' | 'dueDate' | 'createdAt';
type SortDir = 'asc' | 'desc';

function isCompletedTask(task: Task, statuses: Status[]) {
  const s = statuses.find(st => st.id === task.statusId);
  if (!s) return false;
  return s.id === 'complete' || s.label.toLowerCase().includes('complet') || s.label.toLowerCase() === 'done';
}

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
  projects: Project[];
  recurrenceOpen: boolean;
  onToggleRecurrence: () => void;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId' | 'estimatedFocusMins'>>) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}

function TaskRow({ task, statuses, projects, recurrenceOpen, onToggleRecurrence, onUpdate, onDelete, onComplete }: RowProps) {
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
    <>
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
        <td className="col-project">
          <select
            className="table-status-select"
            value={task.projectId ?? ''}
            onChange={e => onUpdate(task.id, { projectId: e.target.value || undefined })}
          >
            <option value="">—</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </td>
        <td className="col-assignee">
          {task.statusId === 'delegated' ? (
            <input
              className="table-cell-input"
              value={task.assignee ?? ''}
              onChange={e => onUpdate(task.id, { assignee: e.target.value || undefined })}
              placeholder="Assignee"
            />
          ) : (
            <span className="table-cell-muted">—</span>
          )}
        </td>
        <td className="col-due">
          <div className="due-display">
            {overdue && <span className="overdue-tag">Overdue</span>}
            <input
              className="table-cell-input table-date-input"
              type="date"
              value={task.dueDate ?? ''}
              onChange={e => onUpdate(task.id, { dueDate: e.target.value || undefined })}
              title={task.dueDate ? formatDate(task.dueDate) : undefined}
            />
          </div>
        </td>
        <td className="col-repeat">
          <button
            className={`recurrence-cell-btn${task.recurrence ? ' recurrence-cell-btn--active' : ''}`}
            onClick={onToggleRecurrence}
            title={task.recurrence ? describeRecurrence(task.recurrence) : 'Set recurrence'}
          >
            {task.recurrence ? `↻ ${describeRecurrence(task.recurrence)}` : '+ Repeat'}
          </button>
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
          <div className="table-row-actions">
            {task.recurrence && (
              <button
                className="btn btn--ghost btn--icon btn--sm table-complete-btn"
                onClick={() => onComplete(task.id)}
                title="Mark done & schedule next"
              >
                ✓↻
              </button>
            )}
            <button
              className="btn btn--ghost btn--icon btn--sm"
              onClick={() => onDelete(task.id)}
              title="Delete task"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M10 3.5l-.6 7a.5.5 0 0 1-.5.5H4.1a.5.5 0 0 1-.5-.5L3 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M5.5 6v3M7.5 6v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>

      {recurrenceOpen && (
        <tr className="recurrence-expand-row">
          <td colSpan={8}>
            <div className="recurrence-expand-body">
              <RecurrencePicker
                value={task.recurrence}
                onChange={rec => onUpdate(task.id, { recurrence: rec })}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function TaskTable({ statuses, tasks, projects, addTask, updateTask, deleteTask, completeRecurring }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [expandedRecId, setExpandedRecId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newStatusId, setNewStatusId] = useState(statuses[0]?.id ?? '');
  const [newDueDate, setNewDueDate] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newRecurrence, setNewRecurrence] = useState<Recurrence | undefined>(undefined);
  const [newAssignee, setNewAssignee] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [showNewRecurrence, setShowNewRecurrence] = useState(false);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  const allSorted = [...tasks].sort((a, b) => {
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

  const sorted = allSorted.filter(t => !isCompletedTask(t, statuses));
  const completedSorted = allSorted.filter(t => isCompletedTask(t, statuses));

  function submitNewTask() {
    if (!newTitle.trim() || !newStatusId) return;
    addTask(newStatusId, newTitle.trim(), newDesc.trim(), newDueDate || undefined, newRecurrence, newAssignee.trim() || undefined, newProjectId || undefined);
    setNewTitle('');
    setNewDesc('');
    setNewDueDate('');
    setNewRecurrence(undefined);
    setNewAssignee('');
    setNewProjectId('');
    setShowNewRecurrence(false);
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="sort-icon sort-icon--inactive">↕</span>;
    return <span className="sort-icon">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  const newStatus = statuses.find(s => s.id === newStatusId);

  return (
    <div className="task-list">
      <div className="task-list-meta">
        <span className="task-list-count">{sorted.length} task{sorted.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="task-list-scroll">
        <table className="task-table">
          <thead>
            <tr>
              <th className="col-title" onClick={() => toggleSort('title')}>Title <SortIcon col="title" /></th>
              <th className="col-status" onClick={() => toggleSort('status')}>Status <SortIcon col="status" /></th>
              <th className="col-project">Project</th>
              <th className="col-assignee">Assignee</th>
              <th className="col-due" onClick={() => toggleSort('dueDate')}>Due Date <SortIcon col="dueDate" /></th>
              <th className="col-repeat">Repeat</th>
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
                projects={projects}
                recurrenceOpen={expandedRecId === task.id}
                onToggleRecurrence={() => setExpandedRecId(prev => prev === task.id ? null : task.id)}
                onUpdate={updateTask}
                onDelete={deleteTask}
                onComplete={completeRecurring}
              />
            ))}

            {/* New task row */}
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
              <td className="col-project">
                <select
                  className="table-status-select"
                  value={newProjectId}
                  onChange={e => setNewProjectId(e.target.value)}
                >
                  <option value="">—</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </td>
              <td className="col-assignee">
                {newStatusId === 'delegated' ? (
                  <input
                    className="table-cell-input"
                    value={newAssignee}
                    onChange={e => setNewAssignee(e.target.value)}
                    placeholder="Assignee"
                  />
                ) : (
                  <span className="table-cell-muted">—</span>
                )}
              </td>
              <td className="col-due">
                <input
                  className="table-cell-input table-date-input"
                  type="date"
                  value={newDueDate}
                  onChange={e => setNewDueDate(e.target.value)}
                />
              </td>
              <td className="col-repeat">
                <button
                  className={`recurrence-cell-btn${newRecurrence ? ' recurrence-cell-btn--active' : ''}`}
                  onClick={() => setShowNewRecurrence(v => !v)}
                >
                  {newRecurrence ? `↻ ${describeRecurrence(newRecurrence)}` : '+ Repeat'}
                </button>
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
                <button className="btn btn--primary btn--sm" onClick={submitNewTask} disabled={!newTitle.trim()}>
                  Add
                </button>
              </td>
            </tr>

            {showNewRecurrence && (
              <tr className="recurrence-expand-row">
                <td colSpan={8}>
                  <div className="recurrence-expand-body">
                    <RecurrencePicker value={newRecurrence} onChange={setNewRecurrence} />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {completedSorted.length > 0 && (
        <div className="completed-section">
          <button
            className="completed-section-header"
            onClick={() => setShowCompleted(v => !v)}
          >
            <span className="completed-section-toggle">{showCompleted ? '▼' : '▶'}</span>
            <span className="completed-section-title">Completed</span>
            <span className="completed-section-count">{completedSorted.length}</span>
          </button>

          {showCompleted && (
            <div className="task-list-scroll">
              <table className="task-table task-table--completed">
                <thead>
                  <tr>
                    <th className="col-title" onClick={() => toggleSort('title')}>Title <SortIcon col="title" /></th>
                    <th className="col-status" onClick={() => toggleSort('status')}>Status <SortIcon col="status" /></th>
                    <th className="col-project">Project</th>
                    <th className="col-assignee">Assignee</th>
                    <th className="col-due" onClick={() => toggleSort('dueDate')}>Due Date <SortIcon col="dueDate" /></th>
                    <th className="col-repeat">Repeat</th>
                    <th className="col-desc">Description</th>
                    <th className="col-actions" />
                  </tr>
                </thead>
                <tbody>
                  {completedSorted.map(task => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      statuses={statuses}
                      projects={projects}
                      recurrenceOpen={expandedRecId === task.id}
                      onToggleRecurrence={() => setExpandedRecId(prev => prev === task.id ? null : task.id)}
                      onUpdate={updateTask}
                      onDelete={deleteTask}
                      onComplete={completeRecurring}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
