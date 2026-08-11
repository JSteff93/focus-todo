import { useState, useCallback, useRef, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Task, Status, Recurrence, Project } from './types';
import { getNextDueDate } from './utils/recurrence';
import { supabase } from './lib/supabase';
import * as db from './lib/db';

const DEFAULT_STATUSES: Status[] = [
  { id: 'todo',      label: 'To-Do',      color: '#587f65' },
  { id: 'doing',     label: 'Doing',      color: '#f59e0b' },
  { id: 'complete',  label: 'Complete',   color: '#10b981' },
  { id: 'waiting',   label: 'Waiting',    color: '#8b5cf6' },
  { id: 'delegated', label: 'Delegated',  color: '#ef4444' },
];

const DEFAULT_PROJECTS: Project[] = [
  { id: 'work',     name: 'Work',     color: '#587f65' },
  { id: 'personal', name: 'Personal', color: '#10b981' },
];

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function useBoardStore() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const userRef = useRef<User | null>(null);
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
  userRef.current = user;

  async function loadData(uid: string) {
    setLoading(true);
    try {
      const [fetchedStatuses, fetchedProjects, fetchedTasks] = await Promise.all([
        db.fetchStatuses(),
        db.fetchProjects(),
        db.fetchTasks(),
      ]);
      if (fetchedStatuses.length === 0) {
        await db.seedDefaults(uid, DEFAULT_STATUSES, DEFAULT_PROJECTS);
        setStatuses(DEFAULT_STATUSES);
        setProjects(DEFAULT_PROJECTS);
        setTasks([]);
      } else {
        setStatuses(fetchedStatuses);
        setProjects(fetchedProjects);
        setTasks(fetchedTasks);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      userRef.current = u;
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        if (u) loadData(u.id);
        else setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setTasks([]);
        setStatuses([]);
        setProjects([]);
        setLoading(false);
      }
      // TOKEN_REFRESHED, USER_UPDATED, etc: just update user ref, no data reload
    });
    return () => subscription.unsubscribe();
  }, []);

  function isCompleteStatus(statusId: string) {
    return statusesRef.current.some(
      s => s.id === statusId && (s.id === 'complete' || s.label.toLowerCase().includes('complet') || s.label.toLowerCase() === 'done')
    );
  }

  const addTask = useCallback((statusId: string, title: string, description: string, dueDate?: string, recurrence?: Recurrence, assignee?: string, projectId?: string, estimatedFocusMins?: number) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const task: Task = { id: generateId(), title, description, statusId, createdAt: Date.now(), dueDate, recurrence, assignee, projectId, estimatedFocusMins };
    setTasks(prev => {
      db.upsertTask(task, uid, prev.length);
      return [...prev, task];
    });
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId' | 'estimatedFocusMins'>>) => {
    const uid = userRef.current?.id;
    setTasks(prev => {
      const next = prev.map(t => {
        if (t.id !== id) return t;
        const merged = { ...t, ...updates };
        if (updates.statusId !== undefined) {
          merged.completedAt = isCompleteStatus(updates.statusId) ? (t.completedAt ?? Date.now()) : undefined;
        }
        return merged;
      });
      if (uid) {
        const updated = next.find(t => t.id === id);
        const idx = next.findIndex(t => t.id === id);
        if (updated) db.upsertTask(updated, uid, idx);
      }
      return next;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    db.deleteTask(id);
  }, []);

  const moveTask = useCallback((taskId: string, toStatusId: string, overTaskId?: string) => {
    const uid = userRef.current?.id;
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const others = prev.filter(t => t.id !== taskId);
      const completedAt = isCompleteStatus(toStatusId) ? (task.completedAt ?? Date.now()) : undefined;
      const updated = { ...task, statusId: toStatusId, completedAt };
      let result: Task[];
      if (overTaskId) {
        const overIdx = others.findIndex(t => t.id === overTaskId);
        result = overIdx !== -1
          ? [...others.slice(0, overIdx), updated, ...others.slice(overIdx)]
          : [...others, updated];
      } else {
        result = [...others, updated];
      }
      if (uid) db.upsertTasksSortOrder(result, uid);
      return result;
    });
  }, []);

  const completeRecurring = useCallback((taskId: string) => {
    const uid = userRef.current?.id;
    const currentStatuses = statusesRef.current;
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task?.recurrence) return prev;

      const completeStatus = currentStatuses.find(s => s.id === 'complete' || s.label.toLowerCase().includes('complet') || s.label.toLowerCase() === 'done') ?? currentStatuses[currentStatuses.length - 1];
      const todoStatus = currentStatuses.find(s => s.id === 'todo' || s.label.toLowerCase() === 'to-do' || s.label.toLowerCase() === 'todo') ?? currentStatuses[0];
      const nextDueDate = task.dueDate ? getNextDueDate(task.dueDate, task.recurrence) : undefined;

      const nextTask: Task = {
        id: generateId(), title: task.title, description: task.description,
        statusId: todoStatus?.id ?? task.statusId, createdAt: Date.now(),
        dueDate: nextDueDate, recurrence: task.recurrence,
        assignee: task.assignee, projectId: task.projectId,
      };

      const result = [
        ...prev.map(t => t.id === taskId ? { ...t, statusId: completeStatus?.id ?? task.statusId, completedAt: task.completedAt ?? Date.now() } : t),
        nextTask,
      ];

      if (uid) db.upsertTasksSortOrder(result, uid);
      return result;
    });
  }, []);

  const addStatus = useCallback((label: string, color: string) => {
    const uid = userRef.current?.id;
    const status: Status = { id: generateId(), label, color };
    setStatuses(prev => {
      if (uid) db.insertStatus(status, uid, prev.length);
      return [...prev, status];
    });
  }, []);

  const removeStatus = useCallback((id: string) => {
    setStatuses(prev => prev.filter(s => s.id !== id));
    setTasks(prev => prev.filter(t => t.statusId !== id));
    db.deleteStatus(id);
  }, []);

  const updateStatus = useCallback((id: string, label: string) => {
    setStatuses(prev => prev.map(s => (s.id === id ? { ...s, label } : s)));
    db.updateStatusLabel(id, label);
  }, []);

  const incrementPomodoro = useCallback((id: string) => {
    const uid = userRef.current?.id;
    setTasks(prev => {
      const next = prev.map(t => t.id === id ? { ...t, pomodoroCount: (t.pomodoroCount ?? 0) + 1 } : t);
      if (uid) {
        const updated = next.find(t => t.id === id);
        const idx = next.findIndex(t => t.id === id);
        if (updated) db.upsertTask(updated, uid, idx);
      }
      return next;
    });
  }, []);

  const addProject = useCallback((name: string, color: string) => {
    const uid = userRef.current?.id;
    const project: Project = { id: generateId(), name, color };
    if (uid) db.insertProject(project, uid);
    setProjects(prev => [...prev, project]);
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    setTasks(prev => prev.map(t => t.projectId === id ? { ...t, projectId: undefined } : t));
    db.deleteProject(id);
  }, []);

  const updateProject = useCallback((id: string, name: string) => {
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, name } : p)));
    db.updateProjectName(id, name);
  }, []);

  return {
    user, loading,
    statuses, tasks, projects,
    addTask, updateTask, deleteTask, moveTask, completeRecurring,
    addStatus, removeStatus, updateStatus,
    addProject, removeProject, updateProject,
    incrementPomodoro,
  };
}
