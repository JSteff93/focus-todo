import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, Recurrence, Project } from '../types';
import { describeRecurrence } from '../utils/recurrence';
import { RecurrencePicker } from './RecurrencePicker';

interface Props {
  task: Task;
  projects: Project[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  onComplete: (id: string) => void;
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const due = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function TaskCard({ task, projects, onDelete, onUpdate, onComplete }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence | undefined>(task.recurrence);
  const [assignee, setAssignee] = useState(task.assignee ?? '');
  const [projectId, setProjectId] = useState(task.projectId ?? '');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function save() {
    if (title.trim()) {
      onUpdate(task.id, {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || undefined,
        recurrence,
        assignee: task.statusId === 'delegated' ? (assignee.trim() || undefined) : undefined,
        projectId: projectId || undefined,
      });
    }
    setEditing(false);
  }

  function openEdit() {
    setTitle(task.title);
    setDescription(task.description);
    setDueDate(task.dueDate ?? '');
    setRecurrence(task.recurrence);
    setAssignee(task.assignee ?? '');
    setProjectId(task.projectId ?? '');
    setEditing(true);
  }

  if (editing) {
    return (
      <div className="task-card task-card--editing">
        <input
          className="task-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Task title"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
        />
        <textarea
          className="task-textarea"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          rows={2}
        />
        <input
          className="task-date-input"
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
        />
        {task.statusId === 'delegated' && (
          <input
            className="task-input"
            value={assignee}
            onChange={e => setAssignee(e.target.value)}
            placeholder="Assignee"
          />
        )}
        <select
          className="task-project-select"
          value={projectId}
          onChange={e => setProjectId(e.target.value)}
        >
          <option value="">No project</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <RecurrencePicker value={recurrence} onChange={setRecurrence} />
        <div className="task-card-actions">
          <button className="btn btn--primary btn--sm" onClick={save}>Save</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-card${overdue ? ' task-card--overdue' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className="task-card-body" onClick={openEdit}>
        <p className="task-title">{task.title}</p>
        {task.description && <p className="task-desc">{task.description}</p>}
        {task.dueDate && (
          <p className={`task-due-date${overdue ? ' task-due-date--overdue' : ''}`}>
            {overdue ? '⚠ Overdue · ' : '📅 '}{formatDate(task.dueDate)}
          </p>
        )}
        {task.recurrence && (
          <p className="task-recurrence-badge">↻ {describeRecurrence(task.recurrence)}</p>
        )}
        {task.statusId === 'delegated' && task.assignee && (
          <p className="task-assignee">👤 {task.assignee}</p>
        )}
        {task.projectId && (() => {
          const proj = projects.find(p => p.id === task.projectId);
          return proj ? (
            <span className="task-project-badge" style={{ background: proj.color + '22', color: proj.color }}>
              {proj.name}
            </span>
          ) : null;
        })()}
      </div>

      <div className="task-card-btns">
        {task.recurrence && (
          <button
            className="btn btn--ghost btn--icon task-card-btn task-complete-btn"
            onClick={e => { e.stopPropagation(); onComplete(task.id); }}
            title="Mark done & schedule next"
          >
            ✓
          </button>
        )}
        <button
          className="btn btn--ghost btn--icon task-card-btn task-delete"
          onClick={e => { e.stopPropagation(); onDelete(task.id); }}
          title="Delete task"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
