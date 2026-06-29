import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Status, Task, Recurrence, Project } from '../types';
import { TaskCard } from './TaskCard';
import { RecurrencePicker } from './RecurrencePicker';

interface Props {
  status: Status;
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

export function Column({ status, tasks, onAddTask, onDeleteTask, onUpdateTask, onCompleteTask, onRemoveStatus, onUpdateStatus, projects, defaultProjectId }: Props) {
  const [addingTask, setAddingTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newRecurrence, setNewRecurrence] = useState<Recurrence | undefined>(undefined);
  const [newAssignee, setNewAssignee] = useState('');
  const [newProjectId, setNewProjectId] = useState(defaultProjectId ?? '');
  const [editingLabel, setEditingLabel] = useState(false);
  const [label, setLabel] = useState(status.label);

  const { setNodeRef, isOver } = useDroppable({ id: status.id });

  function submitTask() {
    if (newTitle.trim()) {
      onAddTask(status.id, newTitle.trim(), newDesc.trim(), newDueDate || undefined, newRecurrence, newAssignee.trim() || undefined, newProjectId || undefined);
      setNewTitle('');
      setNewDesc('');
      setNewDueDate('');
      setNewRecurrence(undefined);
      setNewAssignee('');
      setNewProjectId(defaultProjectId ?? '');
      setAddingTask(false);
    }
  }

  function cancelAdd() {
    setAddingTask(false);
    setNewTitle('');
    setNewDesc('');
    setNewDueDate('');
    setNewRecurrence(undefined);
    setNewAssignee('');
    setNewProjectId(defaultProjectId ?? '');
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
            <TaskCard
              key={task.id}
              task={task}
              projects={projects}
              onDelete={onDeleteTask}
              onUpdate={onUpdateTask}
              onComplete={onCompleteTask}
            />
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
              onKeyDown={e => { if (e.key === 'Enter') submitTask(); if (e.key === 'Escape') cancelAdd(); }}
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
            {status.id === 'delegated' && (
              <input
                className="task-input"
                value={newAssignee}
                onChange={e => setNewAssignee(e.target.value)}
                placeholder="Assignee"
              />
            )}
            {!defaultProjectId && projects.length > 0 && (
              <select
                className="task-project-select"
                value={newProjectId}
                onChange={e => setNewProjectId(e.target.value)}
              >
                <option value="">No project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <RecurrencePicker value={newRecurrence} onChange={setNewRecurrence} />
            <div className="task-card-actions">
              <button className="btn btn--primary btn--sm" onClick={submitTask}>Add Task</button>
              <button className="btn btn--ghost btn--sm" onClick={cancelAdd}>Cancel</button>
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
