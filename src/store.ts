import { useState, useCallback, useRef, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Task, Status, Recurrence, Project, SessionEntry, ActivitySeries, ActivityOverride, ActivityCompletion, ActivityCategory, ActivitySlot, WeeklyRecurrence } from './types';
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

export function findTodoStatus(statuses: Status[]): Status | undefined {
  return statuses.find(s => s.id === 'todo' || s.label.toLowerCase() === 'to-do' || s.label.toLowerCase() === 'todo') ?? statuses[0];
}

function buildNextOccurrence(task: Task, todoStatusId: string): Task {
  const nextDueDate = task.dueDate ? getNextDueDate(task.dueDate, task.recurrence!) : undefined;
  return {
    id: generateId(), title: task.title, description: task.description,
    statusId: todoStatusId, createdAt: Date.now(),
    dueDate: nextDueDate, recurrence: task.recurrence,
    assignee: task.assignee, projectId: task.projectId,
  };
}

export function useBoardStore() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<SessionEntry[]>([]);

  const userRef = useRef<User | null>(null);
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;
  userRef.current = user;
  const loadedUidRef = useRef<string | null>(null);

  async function loadData(uid: string) {
    setLoading(true);
    try {
      const [fetchedStatuses, fetchedProjects, fetchedTasks, fetchedHistory] = await Promise.all([
        db.fetchStatuses(),
        db.fetchProjects(),
        db.fetchTasks(),
        db.fetchSessionHistory(),
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
      setHistory(fetchedHistory);
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
        // Supabase re-fires SIGNED_IN for the same session whenever the tab
        // regains focus/visibility (it revalidates the token on wake). Only
        // reload data on an actual new sign-in, otherwise this reloads and
        // remounts the whole app (killing any running focus timer) every
        // time the user tabs back in.
        if (u) {
          if (loadedUidRef.current !== u.id) {
            loadedUidRef.current = u.id;
            loadData(u.id);
          }
        } else {
          setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        loadedUidRef.current = null;
        setTasks([]);
        setStatuses([]);
        setProjects([]);
        setHistory([]);
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
      let spawned: Task | null = null;
      const next = prev.map(t => {
        if (t.id !== id) return t;
        const merged = { ...t, ...updates };
        if (updates.statusId !== undefined) {
          const wasComplete = isCompleteStatus(t.statusId);
          const nowComplete = isCompleteStatus(updates.statusId);
          merged.completedAt = nowComplete ? (t.completedAt ?? Date.now()) : undefined;
          if (nowComplete && !wasComplete && t.recurrence) {
            const todoStatus = findTodoStatus(statusesRef.current);
            spawned = buildNextOccurrence(t, todoStatus?.id ?? t.statusId);
          }
        }
        return merged;
      });
      const result = spawned ? [...next, spawned] : next;
      if (uid) {
        const updated = result.find(t => t.id === id);
        const idx = result.findIndex(t => t.id === id);
        if (updated) db.upsertTask(updated, uid, idx);
        if (spawned) db.upsertTask(spawned, uid, result.length - 1);
      }
      return result;
    });
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    db.deleteTask(id);
  }, []);

  // `commit` distinguishes a real drop from the Board's live drag-over
  // reorder (which calls this on every column the pointer crosses, purely
  // for the "card follows the cursor" visual). Spawning a recurring task's
  // next occurrence must only happen on `commit: true` — otherwise briefly
  // hovering a recurring task over "Complete" mid-drag spawns the next
  // occurrence immediately, and if the drag ends somewhere else instead,
  // that spawn is never un-done, leaving two active rows for the same task.
  // `fromStatusId` is the task's status when the drag began: by drop time the
  // drag-over reorder has already moved the task into its final column, so
  // its current statusId can't tell us whether this drop completed it.
  const moveTask = useCallback((taskId: string, toStatusId: string, overTaskId?: string, commit: boolean = true, fromStatusId?: string) => {
    const uid = userRef.current?.id;
    setTasks(prev => {
      const task = prev.find(t => t.id === taskId);
      if (!task) return prev;
      const others = prev.filter(t => t.id !== taskId);
      const wasComplete = isCompleteStatus(fromStatusId ?? task.statusId);
      const nowComplete = isCompleteStatus(toStatusId);
      const completedAt = nowComplete ? (task.completedAt ?? Date.now()) : undefined;
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
      if (commit && nowComplete && !wasComplete && task.recurrence) {
        const todoStatus = findTodoStatus(statusesRef.current);
        result = [...result, buildNextOccurrence(task, todoStatus?.id ?? task.statusId)];
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
      const todoStatus = findTodoStatus(currentStatuses);
      const nextTask = buildNextOccurrence(task, todoStatus?.id ?? task.statusId);

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

  const addSessionEntry = useCallback((entry: Omit<SessionEntry, 'id'>) => {
    const uid = userRef.current?.id;
    const full: SessionEntry = { ...entry, id: generateId() };
    setHistory(prev => [...prev, full]);
    if (uid) db.insertSessionEntry(full, uid);
  }, []);

  const updateSessionEntry = useCallback((entry: SessionEntry) => {
    setHistory(prev => prev.map(e => e.id === entry.id ? entry : e));
    db.updateSessionEntry(entry);
  }, []);

  const deleteSessionEntry = useCallback((id: string) => {
    setHistory(prev => prev.filter(e => e.id !== id));
    db.deleteSessionEntry(id);
  }, []);

  const addProject = useCallback((name: string, color: string) => {
    const uid = userRef.current?.id;
    const project: Project = { id: generateId(), name, color };
    setProjects(prev => {
      if (uid) db.insertProject(project, uid, prev.length);
      return [...prev, project];
    });
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

  const reorderProjects = useCallback((orderedIds: string[]) => {
    const uid = userRef.current?.id;
    setProjects(prev => {
      const byId = new Map(prev.map(p => [p.id, p]));
      const reordered = orderedIds.map(id => byId.get(id)).filter((p): p is Project => p !== undefined);
      const missing = prev.filter(p => !orderedIds.includes(p.id));
      const result = [...reordered, ...missing];
      if (uid) db.upsertProjectsSortOrder(result, uid);
      return result;
    });
  }, []);

  return {
    user, loading,
    statuses, tasks, projects, history,
    addTask, updateTask, deleteTask, moveTask, completeRecurring,
    addStatus, removeStatus, updateStatus,
    addProject, removeProject, updateProject, reorderProjects,
    incrementPomodoro, addSessionEntry, updateSessionEntry, deleteSessionEntry,
  };
}

export function useFiveToNineStore(user: User | null, enabled: boolean) {
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState<ActivitySeries[]>([]);
  const [overrides, setOverrides] = useState<ActivityOverride[]>([]);
  const [completions, setCompletions] = useState<ActivityCompletion[]>([]);

  const userRef = useRef<User | null>(null);
  const seriesRef = useRef<ActivitySeries[]>([]);
  const loadedUidRef = useRef<string | null>(null);

  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { seriesRef.current = series; }, [series]);

  useEffect(() => {
    if (!user) {
      loadedUidRef.current = null;
      return;
    }
    if (!enabled || loadedUidRef.current === user.id) return;
    loadedUidRef.current = user.id;
    setLoading(true);
    Promise.all([db.fetchActivitySeries(), db.fetchActivityOverrides(), db.fetchActivityCompletions()])
      .then(([fetchedSeries, fetchedOverrides, fetchedCompletions]) => {
        setSeries(fetchedSeries);
        setOverrides(fetchedOverrides);
        setCompletions(fetchedCompletions);
      })
      .finally(() => setLoading(false));
  }, [enabled, user]);

  const addSeries = useCallback((title: string, category: ActivityCategory, slot: ActivitySlot, anchorDate: string, recurrence?: WeeklyRecurrence) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const item: ActivitySeries = { id: generateId(), title, category, slot, anchorDate, recurrence, createdAt: Date.now() };
    setSeries(prev => {
      db.upsertActivitySeries(item, uid);
      return [...prev, item];
    });
  }, []);

  const updateSeries = useCallback((id: string, updates: Partial<Pick<ActivitySeries, 'title' | 'category' | 'slot' | 'anchorDate' | 'recurrence'>>) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const turningOffRecurrence = 'recurrence' in updates && !updates.recurrence;
    setSeries(prev => {
      const next = prev.map(s => (s.id === id ? { ...s, ...updates } : s));
      const updated = next.find(s => s.id === id);
      if (updated) db.upsertActivitySeries(updated, uid);
      return next;
    });
    if (turningOffRecurrence) {
      setOverrides(prev => {
        const toRemove = prev.filter(o => o.seriesId === id);
        toRemove.forEach(o => db.deleteActivityOverride(o.id));
        return prev.filter(o => o.seriesId !== id);
      });
    }
  }, []);

  const deleteSeries = useCallback((id: string) => {
    setSeries(prev => prev.filter(s => s.id !== id));
    setOverrides(prev => prev.filter(o => o.seriesId !== id));
    setCompletions(prev => prev.filter(c => c.seriesId !== id));
    db.deleteActivitySeries(id); // overrides and completions cascade server-side via FK
  }, []);

  const moveOccurrence = useCallback((seriesId: string, occurrenceDate: string, newDate: string, newSlot: ActivitySlot) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const s = seriesRef.current.find(x => x.id === seriesId);
    if (!s) return;

    if (!s.recurrence) {
      const updated = { ...s, anchorDate: newDate, slot: newSlot };
      setSeries(prev => prev.map(x => (x.id === seriesId ? updated : x)));
      db.upsertActivitySeries(updated, uid);
      // A one-off's occurrence date is its anchorDate, so its done state has
      // to follow it to the new date.
      if (newDate !== s.anchorDate) {
        setCompletions(prev => prev.map(c => {
          if (c.seriesId !== seriesId || c.occurrenceDate !== s.anchorDate) return c;
          const moved = { ...c, occurrenceDate: newDate };
          db.upsertActivityCompletion(moved, uid);
          return moved;
        }));
      }
      return;
    }

    const backToNatural = newDate === occurrenceDate && newSlot === s.slot;
    setOverrides(prev => {
      const existing = prev.find(o => o.seriesId === seriesId && o.occurrenceDate === occurrenceDate);
      if (backToNatural) {
        if (!existing) return prev;
        db.deleteActivityOverride(existing.id);
        return prev.filter(o => o.id !== existing.id);
      }
      const ov: ActivityOverride = {
        id: existing?.id ?? generateId(),
        seriesId,
        occurrenceDate,
        movedDate: newDate !== occurrenceDate ? newDate : undefined,
        movedSlot: newSlot !== s.slot ? newSlot : undefined,
      };
      db.upsertActivityOverride(ov, uid);
      return existing ? prev.map(o => (o.id === existing.id ? ov : o)) : [...prev, ov];
    });
  }, []);

  const toggleOccurrenceDone = useCallback((seriesId: string, occurrenceDate: string) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    setCompletions(prev => {
      const existing = prev.find(c => c.seriesId === seriesId && c.occurrenceDate === occurrenceDate);
      if (existing) {
        db.deleteActivityCompletion(existing.id);
        return prev.filter(c => c.id !== existing.id);
      }
      const c: ActivityCompletion = { id: generateId(), seriesId, occurrenceDate };
      db.upsertActivityCompletion(c, uid);
      return [...prev, c];
    });
  }, []);

  return { loading, series, overrides, completions, addSeries, updateSeries, deleteSeries, moveOccurrence, toggleOccurrenceDone };
}
