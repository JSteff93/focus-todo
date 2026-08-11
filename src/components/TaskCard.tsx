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
  onUpdate: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId' | 'estimatedFocusMins'>>) => void;
  onComplete: (id: string) => void;
  onFocusTask?: (taskId: string) => void;
}

function formatMins(mins: number) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
  const [notesOpen, setNotesOpen] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });

  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;
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
        className={`task-card${overdue ? ' task-card--overdue' : ''}${notesOpen ? ' task-card--notes-open' : ''}`}
        {...attributes}
        {...listeners}
      >
        <div className="task-card-body" onClick={() => setDrawerOpen(true)}>
          <p className="task-title">{task.title}</p>
          {notesOpen && task.description && <p className="task-desc">{task.description}</p>}
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
          {(() => {
            const spentMins = (task.pomodoroCount ?? 0) * 25;
            const est = task.estimatedFocusMins;
            if (!spentMins && !est) return null;
            const label = spentMins && est
              ? `${formatMins(spentMins)} / ${formatMins(est)}`
              : spentMins
              ? `${formatMins(spentMins)} spent`
              : `est. ${formatMins(est!)}`;
            const overBudget = !!spentMins && !!est && spentMins > est;
            return (
              <span className={`task-focus-time${overBudget ? ' task-focus-time--over' : ''}`}>
                ⏱ {label}
              </span>
            );
          })()}
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
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M2 3.5h9M5 3.5V2.5a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1M10 3.5l-.6 7a.5.5 0 0 1-.5.5H4.1a.5.5 0 0 1-.5-.5L3 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.5 6v3M7.5 6v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {task.description && (
          <button
            className={`btn btn--ghost btn--icon task-notes-btn${notesOpen ? ' task-notes-btn--active' : ''}`}
            onClick={e => { e.stopPropagation(); setNotesOpen(o => !o); }}
            title={notesOpen ? 'Hide notes' : 'Show notes'}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="2" y="1.5" width="8" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M4 4.5h4M4 6.5h4M4 8.5h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
            </svg>
          </button>
        )}
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
