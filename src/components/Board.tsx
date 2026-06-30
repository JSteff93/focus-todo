import { useState } from 'react';
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

interface Props {
  statuses: Status[];
  tasks: Task[];
  projects: Project[];
  defaultProjectId?: string;
  addTask: (statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string) => void;
  updateTask: (id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, toStatusId: string, overTaskId?: string) => void;
  completeRecurring: (taskId: string) => void;
  removeStatus: (id: string) => void;
  updateStatus: (id: string, label: string) => void;
  onFocusTask?: (taskId: string) => void;
}

export function Board({ statuses, tasks, projects, defaultProjectId, addTask, updateTask, deleteTask, moveTask, completeRecurring, removeStatus, updateStatus, onFocusTask }: Props) {
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragStart({ active }: DragStartEvent) {
    const task = tasks.find(t => t.id === active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const taskId = active.id as string;
    const overId = over.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const overIsStatus = statuses.some(s => s.id === overId);
    const overTask = tasks.find(t => t.id === overId);
    if (overIsStatus && task.statusId !== overId) {
      moveTask(taskId, overId);
    } else if (overTask && overTask.statusId !== task.statusId) {
      moveTask(taskId, overTask.statusId, overTask.id);
    }
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTask(null);
    if (!over) return;
    const taskId = active.id as string;
    const overId = over.id as string;
    const overTask = tasks.find(t => t.id === overId);
    if (overTask) {
      moveTask(taskId, overTask.statusId, overTask.id);
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
      <main className="board">
        {statuses.map(status => (
          <Column
            key={status.id}
            status={status}
            statuses={statuses}
            tasks={tasks.filter(t => t.statusId === status.id)}
            onAddTask={addTask}
            onDeleteTask={deleteTask}
            onUpdateTask={updateTask}
            onCompleteTask={completeRecurring}
            onRemoveStatus={removeStatus}
            onUpdateStatus={updateStatus}
            projects={projects}
            defaultProjectId={defaultProjectId}
            onFocusTask={onFocusTask}
          />
        ))}
      </main>

      <DragOverlay>
        {activeTask && (
          <div className="task-card task-card--overlay">
            <p className="task-title">{activeTask.title}</p>
            {activeTask.description && <p className="task-desc">{activeTask.description}</p>}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
