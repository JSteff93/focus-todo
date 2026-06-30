import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, Status, Project } from '../types';
import { describeRecurrence } from '../utils/recurrence';
import { TaskDrawer } from './TaskDrawer';

interface Props {
  task: Task;
  statuses: Status[];
  projects: Project[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  onComplete: (id: string) => void;
  onFocusTask?: (taskId: string) => void;
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

export function TaskCard({ task, statuses, projects, onDelete, onUpdate, onComplete, onFocusTask }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : undefined;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={`task-card${overdue ? ' task-card--overdue' : ''}`}
        {...attributes}
        {...listeners}
      >
        <div className="task-card-body" onClick={() => setDrawerOpen(true)}>
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
          {(task.pomodoroCount ?? 0) > 0 && (
            <span className="task-pomodoro-badge">🍅 {task.pomodoroCount}</span>
          )}
        </div>

        <div className="task-card-btns">
          <button
            className="btn btn--ghost btn--icon task-card-btn task-expand-btn"
            onClick={e => { e.stopPropagation(); setDrawerOpen(true); }}
            title="Open details"
          >
            ↗
          </button>
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

      {drawerOpen && (
        <TaskDrawer
          task={task}
          statuses={statuses}
          projects={projects}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onComplete={onComplete}
          onClose={() => setDrawerOpen(false)}
          onFocus={onFocusTask ? () => onFocusTask(task.id) : undefined}
        />
      )}
    </>
  );
}
