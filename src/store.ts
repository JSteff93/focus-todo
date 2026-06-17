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
  const [tasks, setTasks] = useState<Task[]>([
    { id: 'seed1',  title: 'Design new landing page',       description: 'Update hero section and CTA buttons',    statusId: 'todo',      createdAt: 1, dueDate: '2026-06-20' },
    { id: 'seed2',  title: 'Fix login timeout bug',         description: 'Sessions expiring too early on mobile',  statusId: 'doing',     createdAt: 2, dueDate: '2026-06-10' },
    { id: 'seed3',  title: 'Write Q2 progress report',      description: '',                                       statusId: 'todo',      createdAt: 3, dueDate: '2026-06-18' },
    { id: 'seed4',  title: 'Deploy staging environment',    description: 'Set up Docker + nginx config',           statusId: 'complete',  createdAt: 4, dueDate: '2026-06-14' },
    { id: 'seed5',  title: 'Review pull requests',          description: 'Three PRs waiting for approval',         statusId: 'doing',     createdAt: 5, dueDate: '2026-06-17' },
    { id: 'seed6',  title: 'Update API documentation',      description: 'Cover new /v2/orders endpoints',         statusId: 'waiting',   createdAt: 6, dueDate: '2026-06-30' },
    { id: 'seed7',  title: 'Onboard new contractor',        description: 'Send welcome kit and repo access',       statusId: 'delegated', createdAt: 7, dueDate: '2026-06-08' },
    { id: 'seed8',  title: 'Migrate database to Postgres',  description: 'Move off legacy MySQL instance',         statusId: 'waiting',   createdAt: 8, dueDate: '2026-07-15' },
    { id: 'seed9',  title: 'Set up error monitoring',       description: 'Integrate Sentry into production build', statusId: 'todo',      createdAt: 9, dueDate: '2026-06-05' },
    { id: 'seed10', title: 'Conduct user interviews',       description: 'Schedule 5 sessions with power users',  statusId: 'delegated', createdAt: 10, dueDate: '2026-06-25' },
  ]);

  const addTask = useCallback((statusId: string, title: string, description: string, dueDate?: string) => {
    setTasks(prev => [
      ...prev,
      { id: generateId(), title, description, statusId, createdAt: Date.now(), dueDate },
    ]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId'>>) => {
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
