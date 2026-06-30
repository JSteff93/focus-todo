import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Status, Task, Recurrence, Project } from '../types';
import { TaskCard } from './TaskCard';
import { CreateTaskDrawer } from './CreateTaskDrawer';

interface Props {
  status: Status;
  statuses: Status[];
  tasks: Task[];
  onAddTask: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  onCompleteTask: (id: string) => void;
  onRemoveStatus: (id: string) => void;
  onUpdateStatus: (id: string, label: string) => void;
  projects: Project[];
  defaultProjectId?: string;
}

export function Column({ status, statuses, tasks, onAddTask, onDeleteTask, onUpdateTask, onCompleteTask, onRemoveStatus, onUpdateStatus, projects, defaultProjectId }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(status.label);

  const { setNodeRef, isOver } = useDroppable({ id: status.id });

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
            <TaskCard
              key={task.id}
              task={task}
              statuses={statuses}
              projects={projects}
              onDelete={onDeleteTask}
              onUpdate={onUpdateTask}
              onComplete={onCompleteTask}
            />
          ))}
        </SortableContext>

        <button className="add-task-btn" onClick={() => setCreateOpen(true)}>
          <span>+</span> Add task
        </button>
      </div>

      {createOpen && (
        <CreateTaskDrawer
          statuses={statuses}
          projects={projects}
          defaultStatusId={status.id}
          defaultProjectId={defaultProjectId}
          onAdd={onAddTask}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}
