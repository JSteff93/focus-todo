import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Board } from './Board';
import type { Status, Task, Recurrence, Project } from '../types';

interface Props {
  project: Project;
  tasks: Task[];
  taskCount: number;
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  statuses: Status[];
  projects: Project[];
  addTask: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string, estimatedFocusMins?: number) => void;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, toStatusId: string, overTaskId?: string) => void;
  completeRecurring: (taskId: string) => void;
  removeStatus: (id: string) => void;
  updateStatus: (id: string, label: string) => void;
  onFocusTask?: (taskId: string) => void;
}

export function ProjectBoardSection({ project, tasks, taskCount, isOpen, onToggle, onDelete, ...boardProps }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: project.color + '12',
  };

  return (
    <div ref={setNodeRef} style={style} className="board-section">
      <div className="board-section-header" onClick={onToggle}>
        <span className="board-section-toggle">{isOpen ? '▼' : '▶'}</span>
        <span className="board-section-dot" style={{ background: project.color }} />
        <span className="board-section-title">{project.name}</span>
        <span className="board-section-count">{taskCount}</span>
        <button
          className="btn btn--ghost btn--icon board-section-delete"
          title={`Delete ${project.name}`}
          onClick={e => { e.stopPropagation(); onDelete(); }}
        >
          ✕
        </button>
        <button
          className="board-section-drag-handle"
          onClick={e => e.stopPropagation()}
          title="Drag to reorder project"
          {...attributes}
          {...listeners}
        >
          <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
            <circle cx="2.5" cy="2.5" r="1.5" />
            <circle cx="7.5" cy="2.5" r="1.5" />
            <circle cx="2.5" cy="8" r="1.5" />
            <circle cx="7.5" cy="8" r="1.5" />
            <circle cx="2.5" cy="13.5" r="1.5" />
            <circle cx="7.5" cy="13.5" r="1.5" />
          </svg>
        </button>
      </div>
      {isOpen && <Board {...boardProps} tasks={tasks} defaultProjectId={project.id} />}
    </div>
  );
}
