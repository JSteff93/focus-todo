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
import { AddStatusModal } from './AddStatusModal';
import type { Task } from '../types';
import { useBoardStore } from '../store';

export function Board() {
  const { statuses, tasks, addTask, updateTask, deleteTask, moveTask, addStatus, removeStatus, updateStatus } =
    useBoardStore();

  const [showAddStatus, setShowAddStatus] = useState(false);
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
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Focus Board</h1>
        <button className="btn btn--primary" onClick={() => setShowAddStatus(true)}>
          + Add Column
        </button>
      </header>

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
              tasks={tasks.filter(t => t.statusId === status.id)}
              onAddTask={addTask}
              onDeleteTask={deleteTask}
              onUpdateTask={updateTask}
              onRemoveStatus={removeStatus}
              onUpdateStatus={updateStatus}
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

      {showAddStatus && (
        <AddStatusModal onAdd={addStatus} onClose={() => setShowAddStatus(false)} />
      )}
    </div>
  );
}
