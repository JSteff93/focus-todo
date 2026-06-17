import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Status, Task } from '../types';
import { TaskCard } from './TaskCard';

interface Props {
  status: Status;
  tasks: Task[];
  onAddTask: (statusId: string, title: string, description: string, dueDate?: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId'>>) => void;
  onRemoveStatus: (id: string) => void;
  onUpdateStatus: (id: string, label: string) => void;
}

export function Column({ status, tasks, onAddTask, onDeleteTask, onUpdateTask, onRemoveStatus, onUpdateStatus }: Props) {
  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(status.label);

  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  function submitTask() {
    if (newTitle.trim()) {
      onAddTask(status.id, newTitle.trim(), newDesc.trim(), newDueDate || undefined);
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setAddingTask(false);
    }
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  function saveLabel() {
    if (label.trim()) onUpdateStatus(status.id, label.trim());
    setEditingLabel(false);
  }

  return (
    <div className={`column ${isOver ? 'column--over' : ''}`} style={{ '--col-color': status.color } as React.CSSProperties}>
      <div className="column-header">
        <div className="column-header-left">
          <span className="column-dot" style={{ background: status.color }} />
          {editingLabel ? (
            <input
              className="column-label-input"
              value={label}
              autoFocus
              onChange={e => setLabel(e.target.value)}
              onBlur={saveLabel}
              onKeyDown={e => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(false); }}
            />
          ) : (
            <span className="column-label" onDoubleClick={() => setEditingLabel(true)} title="Double-click to rename">
              {status.label}
            </span>
          )}
          <span className="column-count">{tasks.length}</span>
        </div>
        <button
          className="btn btn--ghost btn--icon column-remove"
          onClick={() => {
            if (window.confirm(`Remove "${status.label}" column and all its tasks?`)) {
              onRemoveStatus(status.id);
            }
          }}
          title="Remove column"
        >
          ✕
        </button>
      </div>

      <div ref={setNodeRef} className="column-body">
        <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {sortedTasks.map(task => (
            <TaskCard key={task.id} task={task} onDelete={onDeleteTask} onUpdate={onUpdateTask} />
          ))}
        </SortableContext>

        {addingTask ? (
          <div className="add-task-form">
            <input
              className="task-input"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Task title"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') submitTask(); if (e.key === 'Escape') setAddingTask(false); }}
            />
            <textarea
              className="task-textarea"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              rows={2}
            />
            <input
              className="task-date-input"
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
            />
            <div className="task-card-actions">
              <button className="btn btn--primary btn--sm" onClick={submitTask}>Add Task</button>
              <button className="btn btn--ghost btn--sm" onClick={() => { setAddingTask(false); setNewTitle(''); setNewDesc(''); setNewDueDate(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="add-task-btn" onClick={() => setAddingTask(true)}>
            <span>+</span> Add task
          </button>
        )}
      </div>
    </div>
  );
}
