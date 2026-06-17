import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';

interface Props {
  task: Task;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description'>>) => void;
}

export function TaskCard({ task, onDelete, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function save() {
    if (title.trim()) {
      onUpdate(task.id, { title: title.trim(), description: description.trim() });
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
        <div className="task-card-actions">
          <button className="btn btn--primary btn--sm" onClick={save}>Save</button>
          <button className="btn btn--ghost btn--sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={style} className="task-card" {...attributes}>
      <div className="task-card-drag" {...listeners} title="Drag to move">
        <span className="drag-handle">⠿</span>
      </div>
      <div className="task-card-body" onClick={() => setEditing(true)}>
        <p className="task-title">{task.title}</p>
        {task.description && <p className="task-desc">{task.description}</p>}
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
