import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { Column } from './Column';
import type { Status, Task, Recurrence, Project } from '../types';
import { visibleBoardTasks } from '../utils/boardTasks';
import { useDndSensors } from '../utils/dndSensors';

interface Props {
  statuses: Status[];
  tasks: Task[];
  projects: Project[];
  defaultProjectId?: string;
  simulatedDate?: string;
  addTask: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string, estimatedFocusMins?: number) => void;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, toStatusId: string, overTaskId?: string, commit?: boolean, fromStatusId?: string) => void;
  completeRecurring: (taskId: string) => void;
  removeStatus: (id: string) => void;
  updateStatus: (id: string, label: string) => void;
  onFocusTask?: (taskId: string) => void;
  focusSecsByTask: Map<string, number>;
}

export function Board({ statuses, tasks, projects, defaultProjectId, simulatedDate, addTask, updateTask, deleteTask, moveTask, completeRecurring, removeStatus, updateStatus, onFocusTask, focusSecsByTask }: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  // Status the dragged task started in — handleDragOver moves it between
  // columns live, so by drop time its statusId is already the destination.
  const dragOriginStatusId = useRef<string | null>(null);
  const boardRef = useRef<HTMLElement>(null);
  // Column currently snapped into view — phones show one column at a time
  // and highlight its pill (desktop never renders the pills).
  const [visibleIndex, setVisibleIndex] = useState(0);

  const boardTasks = visibleBoardTasks(tasks, simulatedDate);

  const sensors = useDndSensors();

  function scrollToColumn(index: number) {
    const column = boardRef.current?.children[index];
    column?.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
  }

  function handleBoardScroll() {
    const board = boardRef.current;
    if (!board) return;
    const left = board.getBoundingClientRect().left;
    let closest = 0;
    let closestDist = Infinity;
    Array.from(board.children).forEach((child, i) => {
      const dist = Math.abs(child.getBoundingClientRect().left - left);
      if (dist < closestDist) { closest = i; closestDist = dist; }
    });
    setVisibleIndex(closest);
  }

  function handleDragStart({ active }: DragStartEvent) {
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
    dragOriginStatusId.current = task?.statusId ?? null;
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const taskId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const overIsStatus = statuses.some(s => s.id === overId);
    const overTask = tasks.find(t => t.id === overId);
    // commit: false — this is the live "card follows the cursor" reorder
    // fired on every column the pointer crosses during the drag, not the
    // actual drop. Side effects tied to a genuine status change (recurring
    // task spawning its next occurrence) must wait for handleDragEnd.
    if (overIsStatus && task.statusId !== overId) {
      moveTask(taskId, overId, undefined, false);
    } else if (overTask && overTask.statusId !== task.statusId) {
      moveTask(taskId, overTask.statusId, overTask.id, false);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    const fromStatusId = dragOriginStatusId.current ?? undefined;
    dragOriginStatusId.current = null;
    if (!over) return;
    const taskId = active.id as string;
    const overId = over.id as string;
    const overTask = tasks.find(t => t.id === overId);
    if (overTask) {
      moveTask(taskId, overTask.statusId, overTask.id, true, fromStatusId);
    } else if (statuses.some(s => s.id === overId)) {
      // Dropped on a column's empty area rather than onto a card.
      moveTask(taskId, overId, undefined, true, fromStatusId);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <nav className="board-status-pills" aria-label="Jump to column">
        {statuses.map((status, i) => (
          <button
            key={status.id}
            type="button"
            className={`board-status-pill${i === visibleIndex ? ' board-status-pill--active' : ''}`}
            style={{ '--col-color': status.color } as React.CSSProperties}
            onClick={() => scrollToColumn(i)}
          >
            <span className="column-dot" style={{ background: status.color }} />
            {status.label}
            <span className="column-count">{boardTasks.filter(t => t.statusId === status.id).length}</span>
          </button>
        ))}
      </nav>

      <main
        ref={boardRef}
        className={`board${statuses.length <= 5 ? ' board--fit' : ''}${activeTask ? ' board--dragging' : ''}`}
        onScroll={handleBoardScroll}
      >
        {statuses.map(status => (
          <Column
            key={status.id}
            status={status}
            statuses={statuses}
            tasks={boardTasks.filter(t => t.statusId === status.id)}
            onAddTask={addTask}
            onDeleteTask={deleteTask}
            onUpdateTask={updateTask}
            onCompleteTask={completeRecurring}
            onRemoveStatus={removeStatus}
            onUpdateStatus={updateStatus}
            projects={projects}
            defaultProjectId={defaultProjectId}
            onFocusTask={onFocusTask}
            focusSecsByTask={focusSecsByTask}
          />
        ))}
      </main>

      <DragOverlay>
        {activeTask && (
          <div className="task-card task-card--overlay">
            <p className="task-title">{activeTask.title}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
