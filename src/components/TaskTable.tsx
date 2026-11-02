import { useState } from 'react';
import type { Status, Task, Recurrence, Project } from '../types';
import { describeRecurrence } from '../utils/recurrence';
import { RecurrencePicker } from './RecurrencePicker';
import { TaskDrawer } from './TaskDrawer';
import { PHONE_QUERY, useMediaQuery } from '../utils/useMediaQuery';

interface Props {
  statuses: Status[];
  tasks: Task[];
  projects: Project[];
  addTask: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string, estimatedFocusMins?: number) => void;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  deleteTask: (id: string) => void;
  completeRecurring: (taskId: string) => void;
}

type SortKey = 'title' | 'status' | 'dueDate' | 'createdAt' | 'completedAt';
type SortDir = 'asc' | 'desc';

function compareTasks(a: Task, b: Task, key: SortKey, statuses: Status[]): number {
  if (key === 'title') return a.title.localeCompare(b.title);
  if (key === 'status') {
    const aLabel = statuses.find(s => s.id === a.statusId)?.label ?? '';
    const bLabel = statuses.find(s => s.id === b.statusId)?.label ?? '';
    return aLabel.localeCompare(bLabel);
  }
  if (key === 'dueDate') {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  if (key === 'completedAt') return (a.completedAt ?? 0) - (b.completedAt ?? 0);
  return a.createdAt - b.createdAt;
}

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

function formatCompletedDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SortIcon({ col, activeKey, dir }: { col: SortKey; activeKey: SortKey; dir: SortDir }) {
  if (activeKey !== col) return <span className="sort-icon sort-icon--inactive">↕</span>;
  return <span className="sort-icon">{dir === 'asc' ? '↑' : '↓'}</span>;
}

interface RowProps {
  task: Task;
  statuses: Status[];
  projects: Project[];
  showCompletedDate?: boolean;
  recurrenceOpen: boolean;
  onToggleRecurrence: () => void;
  // Phone card layout: title opens the drawer, due/repeat are read-only.
  compact: boolean;
  onOpen: () => void;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId' | 'estimatedFocusMins'>>) => void;
  onDelete: (id: string) => void;
  onComplete: (id: string) => void;
}

function TaskRow({ task, statuses, projects, showCompletedDate, recurrenceOpen, onToggleRecurrence, compact, onOpen, onUpdate, onDelete, onComplete }: RowProps) {
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
          {compact ? (
            <button className="table-row-open" onClick={onOpen}>{task.title}</button>
          ) : (
            <input
              className="table-cell-input"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            />
          )}
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
          {showCompletedDate ? (
            <span className="table-cell-muted">
              {task.completedAt ? formatCompletedDate(task.completedAt) : '—'}
            </span>
          ) : compact ? (
            task.dueDate && (
              <div className="due-display">
                {overdue && <span className="overdue-tag">Overdue</span>}
                <span className="table-cell-muted">{formatDate(task.dueDate)}</span>
              </div>
            )
          ) : (
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
          )}
        </td>
        <td className="col-repeat">
          {compact ? (
            task.recurrence && <span className="task-recurrence-badge">↻ {describeRecurrence(task.recurrence)}</span>
          ) : (
            <button
              className={`recurrence-cell-btn${task.recurrence ? ' recurrence-cell-btn--active' : ''}`}
              onClick={onToggleRecurrence}
              title={task.recurrence ? describeRecurrence(task.recurrence) : 'Set recurrence'}
            >
              {task.recurrence ? `↻ ${describeRecurrence(task.recurrence)}` : '+ Repeat'}
            </button>
          )}
        </td>
        <td className="col-desc">
          {compact ? (
            task.description && <span className="table-cell-muted">{task.description}</span>
          ) : (
            <input
              className="table-cell-input"
              value={description}
              onChange={e => setDescription(e.target.value)}
              onBlur={commitDesc}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              placeholder="—"
            />
          )}
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
  const [completedSortKey, setCompletedSortKey] = useState<SortKey>('completedAt');
  const [completedSortDir, setCompletedSortDir] = useState<SortDir>('desc');
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
  const compact = useMediaQuery(PHONE_QUERY);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const openTask = openTaskId ? tasks.find(t => t.id === openTaskId) : undefined;

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function toggleCompletedSort(key: SortKey) {
    if (completedSortKey === key) setCompletedSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setCompletedSortKey(key); setCompletedSortDir(key === 'completedAt' ? 'desc' : 'asc'); }
  }

  const sorted = tasks
    .filter(t => !isCompletedTask(t, statuses))
    .sort((a, b) => {
      const cmp = compareTasks(a, b, sortKey, statuses);
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const completedSorted = tasks
    .filter(t => isCompletedTask(t, statuses))
    .sort((a, b) => {
      const cmp = compareTasks(a, b, completedSortKey, statuses);
      return completedSortDir === 'asc' ? cmp : -cmp;
    });

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

  const newStatus = statuses.find(s => s.id === newStatusId);

  return (
    <div className="task-list">
      <div className="task-list-meta">
        <span className="task-list-count">{sorted.length} task{sorted.length !== 1 ? 's' : ''}</span>
        {/* Phones hide the sortable column headers; this stands in for them. */}
        <div className="task-list-sort">
          <select
            className="table-status-select"
            value={sortKey}
            onChange={e => { setSortKey(e.target.value as SortKey); setSortDir('asc'); }}
            aria-label="Sort by"
          >
            <option value="createdAt">Sort: Created</option>
            <option value="title">Sort: Title</option>
            <option value="status">Sort: Status</option>
            <option value="dueDate">Sort: Due date</option>
          </select>
          <button
            className="btn btn--ghost btn--icon"
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            aria-label={sortDir === 'asc' ? 'Sorted ascending' : 'Sorted descending'}
          >
            {sortDir === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>
      <div className="task-list-scroll">
        <table className="task-table">
          <thead>
            <tr>
              <th className="col-title" onClick={() => toggleSort('title')}>Title <SortIcon col="title" activeKey={sortKey} dir={sortDir} /></th>
              <th className="col-status" onClick={() => toggleSort('status')}>Status <SortIcon col="status" activeKey={sortKey} dir={sortDir} /></th>
              <th className="col-project">Project</th>
              <th className="col-assignee">Assignee</th>
              <th className="col-due" onClick={() => toggleSort('dueDate')}>Due Date <SortIcon col="dueDate" activeKey={sortKey} dir={sortDir} /></th>
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
                compact={compact}
                onOpen={() => setOpenTaskId(task.id)}
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
                    <th className="col-title" onClick={() => toggleCompletedSort('title')}>Title <SortIcon col="title" activeKey={completedSortKey} dir={completedSortDir} /></th>
                    <th className="col-status" onClick={() => toggleCompletedSort('status')}>Status <SortIcon col="status" activeKey={completedSortKey} dir={completedSortDir} /></th>
                    <th className="col-project">Project</th>
                    <th className="col-assignee">Assignee</th>
                    <th className="col-due" onClick={() => toggleCompletedSort('completedAt')}>Completed <SortIcon col="completedAt" activeKey={completedSortKey} dir={completedSortDir} /></th>
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
                      showCompletedDate
                      recurrenceOpen={expandedRecId === task.id}
                      onToggleRecurrence={() => setExpandedRecId(prev => prev === task.id ? null : task.id)}
                      compact={compact}
                      onOpen={() => setOpenTaskId(task.id)}
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

      {openTask && (
        <TaskDrawer
          task={openTask}
          statuses={statuses}
          projects={projects}
          onUpdate={updateTask}
          onDelete={deleteTask}
          onComplete={completeRecurring}
          onClose={() => setOpenTaskId(null)}
        />
      )}
    </div>
  );
}
