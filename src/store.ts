import { useState, useCallback, useRef } from 'react';
import type { Task, Status, Recurrence, Project } from './types';
import { getNextDueDate } from './utils/recurrence';

const DEFAULT_STATUSES: Status[] = [
  { id: 'todo',      label: 'To-Do',      color: '#6366f1' },
  { id: 'doing',     label: 'Doing',      color: '#f59e0b' },
  { id: 'complete',  label: 'Complete',   color: '#10b981' },
  { id: 'waiting',   label: 'Waiting',    color: '#8b5cf6' },
  { id: 'delegated', label: 'Delegated',  color: '#ef4444' },
];

const DEFAULT_PROJECTS: Project[] = [
  { id: 'work',     name: 'Work',     color: '#6366f1' },
  { id: 'personal', name: 'Personal', color: '#10b981' },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useBoardStore() {
  const [statuses, setStatuses] = useState<Status[]>(DEFAULT_STATUSES);
  const [projects, setProjects] = useState<Project[]>(DEFAULT_PROJECTS);
  const [tasks, setTasks] = useState<Task[]>([
    { id: 'seed1',  title: 'Design new landing page',       description: 'Update hero section and CTA buttons',    statusId: 'todo',      createdAt: 1,  dueDate: '2026-07-04', projectId: 'personal' },
    { id: 'seed2',  title: 'Fix login timeout bug',         description: 'Sessions expiring too early on mobile',  statusId: 'doing',     createdAt: 2,  dueDate: '2026-06-27', projectId: 'work' },
    { id: 'seed3',  title: 'Write Q2 progress report',      description: '',                                       statusId: 'todo',      createdAt: 3,  dueDate: '2026-06-30', projectId: 'personal' },
    { id: 'seed4',  title: 'Deploy staging environment',    description: 'Set up Docker + nginx config',           statusId: 'complete',  createdAt: 4,  dueDate: '2026-06-28', projectId: 'work' },
    { id: 'seed5',  title: 'Review pull requests',          description: 'Three PRs waiting for approval',         statusId: 'doing',     createdAt: 5,  dueDate: '2026-06-29', projectId: 'work' },
    { id: 'seed6',  title: 'Update API documentation',      description: 'Cover new /v2/orders endpoints',         statusId: 'waiting',   createdAt: 6,  dueDate: '2026-07-11', projectId: 'work' },
    { id: 'seed7',  title: 'Onboard new contractor',        description: 'Send welcome kit and repo access',       statusId: 'delegated', createdAt: 7,  dueDate: '2026-07-01', assignee: 'Sarah K.', projectId: 'work' },
    { id: 'seed8',  title: 'Migrate database to Postgres',  description: 'Move off legacy MySQL instance',         statusId: 'waiting',   createdAt: 8,  dueDate: '2026-07-31', projectId: 'work' },
    { id: 'seed9',  title: 'Set up error monitoring',       description: 'Integrate Sentry into production build', statusId: 'todo',      createdAt: 9,  dueDate: '2026-06-26', projectId: 'work' },
    { id: 'seed10', title: 'Conduct user interviews',       description: 'Schedule 5 sessions with power users',  statusId: 'delegated', createdAt: 10, dueDate: '2026-07-07', assignee: 'Marcus T.', projectId: 'personal' },
  ]);

  // Ref so completeRecurring always reads the latest statuses without stale closure
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  const addTask = useCallback((statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string) => {
    setTasks(prev => [
      ...prev,
      { id: generateId(), title, description, statusId, createdAt: Date.now(), dueDate, recurrence, assignee, projectId },
    ]);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId'>>) => {
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

  const completeRecurring = useCallback((taskId: string) => {
    const currentStatuses = statusesRef.current;
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task?.recurrence) return prev;

      const completeStatus =
        currentStatuses.find(s => s.id === 'complete' || s.label.toLowerCase().includes('complet') || s.label.toLowerCase() === 'done') ??
        currentStatuses[currentStatuses.length - 1];

      const todoStatus =
        currentStatuses.find(s => s.id === 'todo' || s.label.toLowerCase() === 'to-do' || s.label.toLowerCase() === 'todo') ??
        currentStatuses[0];

      const nextDueDate = task.dueDate ? getNextDueDate(task.dueDate, task.recurrence) : undefined;

      const nextTask: Task = {
        id: generateId(),
        title: task.title,
        description: task.description,
        statusId: todoStatus?.id ?? task.statusId,
        createdAt: Date.now(),
        dueDate: nextDueDate,
        recurrence: task.recurrence,
        assignee: task.assignee,
        projectId: task.projectId,
      };

      return [
        ...prev.map(t => t.id === taskId ? { ...t, statusId: completeStatus?.id ?? task.statusId } : t),
        nextTask,
      ];
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

  const incrementPomodoro = useCallback((id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, pomodoroCount: (t.pomodoroCount ?? 0) + 1 } : t));
  }, []);

  const addProject = useCallback((name: string, color: string) => {
    setProjects(prev => [...prev, { id: generateId(), name, color }]);
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.map(t => t.projectId === id ? { ...t, projectId: undefined } : t));
  }, []);

  const updateProject = useCallback((id: string, name: string) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
  }, []);

  return {
    statuses, tasks, projects,
    addTask, updateTask, deleteTask, moveTask, completeRecurring,
    addStatus, removeStatus, updateStatus,
    addProject, removeProject, updateProject,
    incrementPomodoro,
  };
}
