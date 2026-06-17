import { useState, useCallback } from 'react';
import type { Task, Status } from './types';

const DEFAULT_STATUSES: Status[] = [
  { id: 'todo', label: 'To-Do', color: '#6366f1' },
  { id: 'doing', label: 'Doing', color: '#f59e0b' },
  { id: 'complete', label: 'Complete', color: '#10b981' },
  { id: 'waiting', label: 'Waiting', color: '#8b5cf6' },
  { id: 'delegated', label: 'Delegated', color: '#ef4444' },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useBoardStore() {
  const [statuses, setStatuses] = useState<Status[]>(DEFAULT_STATUSES);
  const [tasks, setTasks] = useState<Task[]>([]);

  const addTask = useCallback((statusId: string, title: string, description: string) => {
    setTasks(prev => [
      ...prev,
      { id: generateId(), title, description, statusId, createdAt: Date.now() },
    ]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Pick<Task, 'title' | 'description'>>) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const moveTask = useCallback((taskId: string, toStatusId: string, overTaskId?: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const others = prev.filter(t => t.id !== taskId);
      const updated = { ...task, statusId: toStatusId };
      if (overTaskId) {
        const overIdx = others.findIndex(t => t.id === overTaskId);
        if (overIdx !== -1) {
          const result = [...others];
          result.splice(overIdx, 0, updated);
          return result;
        }
      }
      return [...others, updated];
    });
  }, []);

  const addStatus = useCallback((label: string, color: string) => {
    setStatuses(prev => [...prev, { id: generateId(), label, color }]);
  }, []);

  const removeStatus = useCallback((id: string) => {
    setStatuses(prev => prev.filter(s => s.id !== id));
    setTasks(prev => prev.filter(t => t.statusId !== id));
  }, []);

  const updateStatus = useCallback((id: string, label: string) => {
    setStatuses(prev => prev.map(s => (s.id === id ? { ...s, label } : s)));
  }, []);

  return { statuses, tasks, addTask, updateTask, deleteTask, moveTask, addStatus, removeStatus, updateStatus };
}
