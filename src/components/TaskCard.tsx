import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';

interface Props {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId'>>) => void;
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

export function TaskCard({ task, onDelete, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [dueDate, setDueDate] = useState(task.dueDate ?? '');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function save() {
    if (title.trim()) {
      onUpdate(task.id, { title: title.trim(), description: description.trim(), dueDate: dueDate || undefined });
    }
    setEditing(false);
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
      <div className="task-card-body" onClick={() => setEditing(true)}>
        <p className="task-title">{task.title}</p>
        {task.description && <p className="task-desc">{task.description}</p>}
        {task.dueDate && (
          <p className={`task-due-date${overdue ? ' task-due-date--overdue' : ''}`}>
            {overdue ? '⚠ Overdue · ' : '📅 '}{formatDate(task.dueDate)}
          </p>
        )}
      </div>
      <button
        className="btn btn--ghost btn--icon task-delete"
        onClick={e => { e.stopPropagation(); onDelete(task.id); }}
        title="Delete task"
      >
        ✕
      </button>
    </div>
  );
}
