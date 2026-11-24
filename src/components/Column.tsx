import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Status, Task, Recurrence, Project } from '../types';
import { TaskCard } from './TaskCard';
import { CreateTaskDrawer } from './CreateTaskDrawer';
import { DeleteColumnModal } from './DeleteColumnModal';

interface Props {
  status: Status;
  statuses: Status[];
  tasks: Task[];
  onAddTask: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string, estimatedFocusMins?: number) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  onCompleteTask: (id: string) => void;
  onRemoveStatus: (id: string, moveTasksTo: string | null) => void;
  // All tasks in this status across every project, not just this board's.
  totalTaskCount: number;
  onUpdateStatus: (id: string, label: string) => void;
  projects: Project[];
  defaultProjectId?: string;
  onFocusTask?: (taskId: string) => void;
  focusSecsByTask: Map<string, number>;
}

export function Column({ status, statuses, tasks, onAddTask, onDeleteTask, onUpdateTask, onCompleteTask, onRemoveStatus, totalTaskCount, onUpdateStatus, projects, defaultProjectId, onFocusTask, focusSecsByTask }: Props) {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
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
        <div className="column-header-right">
          {/* Touch stand-in for double-click rename; only shown without hover. */}
          <button
            className="btn btn--ghost btn--icon column-rename"
            onClick={() => { setLabel(status.label); setEditingLabel(true); }}
            title="Rename column"
            aria-label={`Rename ${status.label}`}
          >
            ✎
          </button>
          <button
            className="btn btn--ghost btn--icon column-add-top"
            onClick={() => setCreateOpen(true)}
            title="Add task"
          >
            +
          </button>
          {/* The Board needs at least one column to drop tasks into. */}
          {statuses.length > 1 && (
            <button
              className="btn btn--ghost btn--icon column-remove"
              onClick={() => {
                if (totalTaskCount > 0) setDeleteOpen(true);
                else if (window.confirm(`Remove "${status.label}" column?`)) onRemoveStatus(status.id, null);
              }}
              title="Remove column"
              aria-label={`Remove ${status.label} column`}
            >
              ✕
            </button>
          )}
        </div>
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
              onFocusTask={onFocusTask}
              spentSecs={focusSecsByTask.get(task.id) ?? 0}
            />
          ))}
        </SortableContext>

        <button className="add-task-btn" onClick={() => setCreateOpen(true)}>
          <span>+</span> Add task
        </button>
      </div>

      {deleteOpen && (
        <DeleteColumnModal
          status={status}
          statuses={statuses}
          taskCount={totalTaskCount}
          onConfirm={moveTasksTo => onRemoveStatus(status.id, moveTasksTo)}
          onClose={() => setDeleteOpen(false)}
        />
      )}

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
