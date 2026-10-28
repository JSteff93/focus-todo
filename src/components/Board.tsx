import { useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { Column } from './Column';
import type { Status, Task, Recurrence, Project } from '../types';
import { visibleBoardTasks } from '../utils/boardTasks';

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

  const boardTasks = visibleBoardTasks(tasks, simulatedDate);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
      <main className={`board${statuses.length <= 5 ? ' board--fit' : ''}`}>
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
