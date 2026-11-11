import { useState, useCallback, useRef, useEffect } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Task, Status, Recurrence, Project, SessionEntry, ActivitySeries, ActivityOverride, ActivityCompletion, ActivityCategory, ActivityCategoryDef, ActivitySlot, WeeklyRecurrence, ExerciseDetails, ExerciseActual, ExerciseRoutine } from './types';
import { getNextDueDate } from './utils/recurrence';
import { repairOrphanedTasks } from './utils/orphanRepair';
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

// Same ids, labels and colours the categories had when they were hard-coded,
// so activities created before custom categories look unchanged.
const DEFAULT_ACTIVITY_CATEGORIES: ActivityCategoryDef[] = [
  { id: 'exercise', label: 'Exercise', color: '#f59e0b', sortOrder: 0, isExercise: true },
  { id: 'chores',   label: 'Chores',   color: '#8b5cf6', sortOrder: 1, isExercise: false },
  { id: 'fun',      label: 'Fun',      color: '#ec4899', sortOrder: 2, isExercise: false },
  { id: 'social',   label: 'Social',   color: '#3b82f6', sortOrder: 3, isExercise: false },
];

// Seeded once for brand-new users (existing users get them from the
// add_exercise_details migration) — deliberately not re-seeded when someone
// deletes them all.
const DEFAULT_GYM_ROUTINES = ['Push', 'Pull', 'Legs'];

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

// Writes state and its mirror ref together. Store actions read the ref for
// the latest value, work out the next state, set it, then call db.* once —
// never inside a setState updater, which React may run twice (StrictMode
// does in dev), sending duplicate writes. Updating the ref straight away
// means two actions in the same tick (quick-add twice, drag-over then drop)
// each see the other's result.
function setSynced<T>(ref: { current: T }, set: (value: T) => void, next: T) {
  ref.current = next;
  set(next);
}

export function useBoardStore() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [history, setHistory] = useState<SessionEntry[]>([]);

  // Kept in sync by onAuthStateChange, the only place the user changes.
  const userRef = useRef<User | null>(null);
  // Mirrors of the state above — only ever written via setSynced.
  const statusesRef = useRef<Status[]>([]);
  const projectsRef = useRef<Project[]>([]);
  const tasksRef = useRef<Task[]>([]);
  const historyRef = useRef<SessionEntry[]>([]);
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
        setSynced(statusesRef, setStatuses, DEFAULT_STATUSES);
        setSynced(projectsRef, setProjects, DEFAULT_PROJECTS);
        setSynced(tasksRef, setTasks, []);
      } else {
        setSynced(statusesRef, setStatuses, fetchedStatuses);
        setSynced(projectsRef, setProjects, fetchedProjects);
        const todoId = findTodoStatus(fetchedStatuses)!.id;
        const repair = repairOrphanedTasks(fetchedTasks, fetchedStatuses, fetchedProjects, todoId);
        setSynced(tasksRef, setTasks, repair.tasks);
        if (repair.repairedCount) {
          console.info(`Repaired ${repair.repairedCount} task(s) pointing at a deleted column or project.`);
          // Not awaited — the fixed state is already on screen, and the next
          // load would simply repair again if a write fails.
          repair.missingStatusIds.forEach(sid => db.reassignTasksStatus(sid, todoId));
          repair.missingProjectIds.forEach(pid => db.clearTasksProject(pid));
        }
      }
      setSynced(historyRef, setHistory, fetchedHistory);
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
        setSynced(tasksRef, setTasks, []);
        setSynced(statusesRef, setStatuses, []);
        setSynced(projectsRef, setProjects, []);
        setSynced(historyRef, setHistory, []);
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
    const prev = tasksRef.current;
    setSynced(tasksRef, setTasks, [...prev, task]);
    db.upsertTask(task, uid, prev.length);
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Pick<Task, 'title' | 'description' | 'dueDate' | 'statusId' | 'recurrence' | 'assignee' | 'projectId' | 'estimatedFocusMins'>>) => {
    const uid = userRef.current?.id;
    let spawned: Task | null = null;
    const next = tasksRef.current.map(t => {
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
    setSynced(tasksRef, setTasks, result);
    if (uid) {
      const updated = result.find(t => t.id === id);
      const idx = result.findIndex(t => t.id === id);
      if (updated) db.upsertTask(updated, uid, idx);
      if (spawned) db.upsertTask(spawned, uid, result.length - 1);
    }
  }, []);

  const deleteTask = useCallback((id: string) => {
    setSynced(tasksRef, setTasks, tasksRef.current.filter(t => t.id !== id));
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
    const prev = tasksRef.current;
    const task = prev.find(t => t.id === taskId);
    if (!task) return;
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
    setSynced(tasksRef, setTasks, result);
    if (uid) db.upsertTasksSortOrder(result, uid);
  }, []);

  const completeRecurring = useCallback((taskId: string) => {
    const uid = userRef.current?.id;
    const currentStatuses = statusesRef.current;
    const prev = tasksRef.current;
    const task = prev.find(t => t.id === taskId);
    if (!task?.recurrence) return;

    const completeStatus = currentStatuses.find(s => s.id === 'complete' || s.label.toLowerCase().includes('complet') || s.label.toLowerCase() === 'done') ?? currentStatuses[currentStatuses.length - 1];
    const todoStatus = findTodoStatus(currentStatuses);
    const nextTask = buildNextOccurrence(task, todoStatus?.id ?? task.statusId);

    const result = [
      ...prev.map(t => t.id === taskId ? { ...t, statusId: completeStatus?.id ?? task.statusId, completedAt: task.completedAt ?? Date.now() } : t),
      nextTask,
    ];

    setSynced(tasksRef, setTasks, result);
    if (uid) db.upsertTasksSortOrder(result, uid);
  }, []);

  const addStatus = useCallback((label: string, color: string) => {
    const uid = userRef.current?.id;
    const status: Status = { id: generateId(), label, color };
    const prev = statusesRef.current;
    setSynced(statusesRef, setStatuses, [...prev, status]);
    if (uid) db.insertStatus(status, uid, prev.length);
  }, []);

  // `moveTasksTo` is the column that inherits the deleted column's tasks;
  // null deletes them instead. A bulk move deliberately only changes statusId
  // — no completedAt stamping or recurring spawns, since nobody completed
  // anything. The status row is deleted only after its tasks are dealt with
  // in the DB, so a failure leaves the column to reappear on reload rather
  // than orphaning rows.
  const removeStatus = useCallback(async (id: string, moveTasksTo: string | null) => {
    if (statusesRef.current.length <= 1) return;
    setSynced(statusesRef, setStatuses, statusesRef.current.filter(s => s.id !== id));
    let ok: boolean;
    if (moveTasksTo) {
      setSynced(tasksRef, setTasks, tasksRef.current.map(t => t.statusId === id ? { ...t, statusId: moveTasksTo } : t));
      ok = await db.reassignTasksStatus(id, moveTasksTo);
    } else {
      setSynced(tasksRef, setTasks, tasksRef.current.filter(t => t.statusId !== id));
      ok = await db.deleteTasksByStatus(id);
    }
    if (ok) await db.deleteStatus(id);
  }, []);

  const updateStatus = useCallback((id: string, label: string) => {
    setSynced(statusesRef, setStatuses, statusesRef.current.map(s => (s.id === id ? { ...s, label } : s)));
    db.updateStatusLabel(id, label);
  }, []);

  const incrementPomodoro = useCallback((id: string) => {
    const uid = userRef.current?.id;
    const next = tasksRef.current.map(t => t.id === id ? { ...t, pomodoroCount: (t.pomodoroCount ?? 0) + 1 } : t);
    setSynced(tasksRef, setTasks, next);
    if (uid) {
      const updated = next.find(t => t.id === id);
      const idx = next.findIndex(t => t.id === id);
      if (updated) db.upsertTask(updated, uid, idx);
    }
  }, []);

  const addSessionEntry = useCallback((entry: Omit<SessionEntry, 'id'>) => {
    const uid = userRef.current?.id;
    const full: SessionEntry = { ...entry, id: generateId() };
    setSynced(historyRef, setHistory, [...historyRef.current, full]);
    if (uid) db.insertSessionEntry(full, uid);
  }, []);

  const updateSessionEntry = useCallback((entry: SessionEntry) => {
    setSynced(historyRef, setHistory, historyRef.current.map(e => e.id === entry.id ? entry : e));
    db.updateSessionEntry(entry);
  }, []);

  const deleteSessionEntry = useCallback((id: string) => {
    setSynced(historyRef, setHistory, historyRef.current.filter(e => e.id !== id));
    db.deleteSessionEntry(id);
  }, []);

  const addProject = useCallback((name: string, color: string) => {
    const uid = userRef.current?.id;
    const project: Project = { id: generateId(), name, color };
    const prev = projectsRef.current;
    setSynced(projectsRef, setProjects, [...prev, project]);
    if (uid) db.insertProject(project, uid, prev.length);
  }, []);

  const removeProject = useCallback(async (id: string) => {
    setSynced(projectsRef, setProjects, projectsRef.current.filter(p => p.id !== id));
    setSynced(tasksRef, setTasks, tasksRef.current.map(t => t.projectId === id ? { ...t, projectId: undefined } : t));
    if (await db.clearTasksProject(id)) await db.deleteProject(id);
  }, []);

  const updateProject = useCallback((id: string, name: string) => {
    setSynced(projectsRef, setProjects, projectsRef.current.map(p => (p.id === id ? { ...p, name } : p)));
    db.updateProjectName(id, name);
  }, []);

  const reorderProjects = useCallback((orderedIds: string[]) => {
    const uid = userRef.current?.id;
    const prev = projectsRef.current;
    const byId = new Map(prev.map(p => [p.id, p]));
    const reordered = orderedIds.map(id => byId.get(id)).filter((p): p is Project => p !== undefined);
    const missing = prev.filter(p => !orderedIds.includes(p.id));
    const result = [...reordered, ...missing];
    setSynced(projectsRef, setProjects, result);
    if (uid) db.upsertProjectsSortOrder(result, uid);
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
  const [categories, setCategories] = useState<ActivityCategoryDef[]>([]);
  const [routines, setRoutines] = useState<ExerciseRoutine[]>([]);

  const userRef = useRef<User | null>(null);
  // Mirrors of the state above — only ever written via setSynced.
  const seriesRef = useRef<ActivitySeries[]>([]);
  const overridesRef = useRef<ActivityOverride[]>([]);
  const completionsRef = useRef<ActivityCompletion[]>([]);
  const categoriesRef = useRef<ActivityCategoryDef[]>([]);
  const routinesRef = useRef<ExerciseRoutine[]>([]);
  const loadedUidRef = useRef<string | null>(null);

  useEffect(() => { userRef.current = user; }, [user]);

  useEffect(() => {
    if (!user) {
      loadedUidRef.current = null;
      return;
    }
    if (!enabled || loadedUidRef.current === user.id) return;
    loadedUidRef.current = user.id;
    setLoading(true);
    const uid = user.id;
    // A failed categories fetch (e.g. the migration hasn't been run yet)
    // falls back to the built-ins locally rather than failing the whole view.
    const categoriesPromise = db.fetchActivityCategories()
      .then(fetched => ({ fetched, ok: true }))
      .catch(err => {
        console.error('fetchActivityCategories:', err);
        return { fetched: [] as ActivityCategoryDef[], ok: false };
      });
    const routinesPromise = db.fetchExerciseRoutines()
      .then(fetched => ({ fetched, ok: true }))
      .catch(err => {
        console.error('fetchExerciseRoutines:', err);
        return { fetched: [] as ExerciseRoutine[], ok: false };
      });
    Promise.all([db.fetchActivitySeries(), db.fetchActivityOverrides(), db.fetchActivityCompletions(), categoriesPromise, routinesPromise])
      .then(([fetchedSeries, fetchedOverrides, fetchedCompletions, { fetched: fetchedCategories, ok }, routinesResult]) => {
        if (routinesResult.fetched.length === 0 && routinesResult.ok && fetchedSeries.length === 0) {
          const seeded: ExerciseRoutine[] = DEFAULT_GYM_ROUTINES.map((name, i) => ({ id: generateId(), kind: 'gym', name, sortOrder: i, items: [], notes: '' }));
          setSynced(routinesRef, setRoutines, seeded);
          db.upsertExerciseRoutines(seeded, uid);
        } else {
          setSynced(routinesRef, setRoutines, routinesResult.fetched);
        }
        setSynced(seriesRef, setSeries, fetchedSeries);
        setSynced(overridesRef, setOverrides, fetchedOverrides);
        setSynced(completionsRef, setCompletions, fetchedCompletions);
        if (fetchedCategories.length > 0) {
          setSynced(categoriesRef, setCategories, fetchedCategories);
        } else {
          // First load for this user (like seedDefaults for statuses).
          setSynced(categoriesRef, setCategories, DEFAULT_ACTIVITY_CATEGORIES);
          if (ok) db.upsertActivityCategories(DEFAULT_ACTIVITY_CATEGORIES, uid);
        }
      })
      .finally(() => setLoading(false));
  }, [enabled, user]);

  const addSeries = useCallback((title: string, category: ActivityCategory, slot: ActivitySlot, anchorDate: string, recurrence?: WeeklyRecurrence, details?: ExerciseDetails) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const item: ActivitySeries = { id: generateId(), title, category, slot, anchorDate, recurrence, createdAt: Date.now(), details };
    setSynced(seriesRef, setSeries, [...seriesRef.current, item]);
    db.upsertActivitySeries(item, uid);
  }, []);

  const updateSeries = useCallback((id: string, updates: Partial<Pick<ActivitySeries, 'title' | 'category' | 'slot' | 'anchorDate' | 'recurrence' | 'details'>>) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const turningOffRecurrence = 'recurrence' in updates && !updates.recurrence;
    const next = seriesRef.current.map(s => (s.id === id ? { ...s, ...updates } : s));
    setSynced(seriesRef, setSeries, next);
    const updated = next.find(s => s.id === id);
    if (updated) db.upsertActivitySeries(updated, uid);
    if (turningOffRecurrence) {
      const toRemove = overridesRef.current.filter(o => o.seriesId === id);
      setSynced(overridesRef, setOverrides, overridesRef.current.filter(o => o.seriesId !== id));
      toRemove.forEach(o => db.deleteActivityOverride(o.id));
    }
  }, []);

  const deleteSeries = useCallback((id: string) => {
    setSynced(seriesRef, setSeries, seriesRef.current.filter(s => s.id !== id));
    setSynced(overridesRef, setOverrides, overridesRef.current.filter(o => o.seriesId !== id));
    setSynced(completionsRef, setCompletions, completionsRef.current.filter(c => c.seriesId !== id));
    db.deleteActivitySeries(id); // overrides and completions cascade server-side via FK
  }, []);

  const moveOccurrence = useCallback((seriesId: string, occurrenceDate: string, newDate: string, newSlot: ActivitySlot) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const s = seriesRef.current.find(x => x.id === seriesId);
    if (!s) return;

    if (!s.recurrence) {
      const updated = { ...s, anchorDate: newDate, slot: newSlot };
      setSynced(seriesRef, setSeries, seriesRef.current.map(x => (x.id === seriesId ? updated : x)));
      db.upsertActivitySeries(updated, uid);
      // A one-off's occurrence date is its anchorDate, so its done state has
      // to follow it to the new date.
      if (newDate !== s.anchorDate) {
        const moved: ActivityCompletion[] = [];
        setSynced(completionsRef, setCompletions, completionsRef.current.map(c => {
          if (c.seriesId !== seriesId || c.occurrenceDate !== s.anchorDate) return c;
          const m = { ...c, occurrenceDate: newDate };
          moved.push(m);
          return m;
        }));
        moved.forEach(c => db.upsertActivityCompletion(c, uid));
      }
      return;
    }

    const backToNatural = newDate === occurrenceDate && newSlot === s.slot;
    const prev = overridesRef.current;
    const existing = prev.find(o => o.seriesId === seriesId && o.occurrenceDate === occurrenceDate);
    if (backToNatural) {
      if (!existing) return;
      setSynced(overridesRef, setOverrides, prev.filter(o => o.id !== existing.id));
      db.deleteActivityOverride(existing.id);
      return;
    }
    const ov: ActivityOverride = {
      id: existing?.id ?? generateId(),
      seriesId,
      occurrenceDate,
      movedDate: newDate !== occurrenceDate ? newDate : undefined,
      movedSlot: newSlot !== s.slot ? newSlot : undefined,
    };
    setSynced(overridesRef, setOverrides, existing ? prev.map(o => (o.id === existing.id ? ov : o)) : [...prev, ov]);
    db.upsertActivityOverride(ov, uid);
  }, []);

  const saveCategories = useCallback((next: ActivityCategoryDef[]) => {
    const normalised = next.map((c, i) => ({ ...c, sortOrder: i }));
    setSynced(categoriesRef, setCategories, normalised);
    const uid = userRef.current?.id;
    if (uid) db.upsertActivityCategories(normalised, uid);
  }, []);

  const addCategory = useCallback((label: string, color: string) => {
    saveCategories([...categoriesRef.current, { id: generateId(), label, color, sortOrder: 0, isExercise: false }]);
  }, [saveCategories]);

  const updateCategory = useCallback((id: string, updates: Partial<Pick<ActivityCategoryDef, 'label' | 'color'>>) => {
    saveCategories(categoriesRef.current.map(c => (c.id === id ? { ...c, ...updates } : c)));
  }, [saveCategories]);

  // Only one category can be the exercise one — setting it clears the flag
  // everywhere else; null leaves none.
  const setExerciseCategory = useCallback((id: string | null) => {
    saveCategories(categoriesRef.current.map(c => ({ ...c, isExercise: c.id === id })));
  }, [saveCategories]);

  const reorderCategories = useCallback((orderedIds: string[]) => {
    const byId = new Map(categoriesRef.current.map(c => [c.id, c]));
    saveCategories(orderedIds.map(id => byId.get(id)).filter((c): c is ActivityCategoryDef => !!c));
  }, [saveCategories]);

  // Activities using the category move to moveToId first, so none are left
  // pointing at a missing id. The DB delete waits for that reassignment.
  const deleteCategory = useCallback((id: string, moveToId?: string) => {
    if (moveToId) {
      setSynced(seriesRef, setSeries, seriesRef.current.map(s => (s.category === id ? { ...s, category: moveToId } : s)));
    }
    setSynced(categoriesRef, setCategories, categoriesRef.current.filter(c => c.id !== id));
    (moveToId ? db.reassignActivityCategory(id, moveToId) : Promise.resolve())
      .then(() => db.deleteActivityCategory(id));
  }, []);

  const findCompletion = useCallback((seriesId: string, occurrenceDate: string) =>
    completionsRef.current.find(c => c.seriesId === seriesId && c.occurrenceDate === occurrenceDate), []);

  // Replaces (by id) or appends one completion, then saves it.
  const putCompletion = useCallback((c: ActivityCompletion, uid: string) => {
    const prev = completionsRef.current;
    const exists = prev.some(x => x.id === c.id);
    setSynced(completionsRef, setCompletions, exists ? prev.map(x => (x.id === c.id ? c : x)) : [...prev, c]);
    db.upsertActivityCompletion(c, uid);
  }, []);

  const toggleOccurrenceDone = useCallback((seriesId: string, occurrenceDate: string) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const existing = findCompletion(seriesId, occurrenceDate);
    // Flip rather than delete, so a logged actual survives an untick.
    const c: ActivityCompletion = existing
      ? { ...existing, done: !existing.done }
      : { id: generateId(), seriesId, occurrenceDate, done: true };
    putCompletion(c, uid);
  }, [findCompletion, putCompletion]);

  // Records what was actually done for one occurrence (and marks it done).
  // `actual` undefined clears a previous log. Ticked-off stretches are
  // separate progress, so they're kept either way.
  const logOccurrence = useCallback((seriesId: string, occurrenceDate: string, actual: ExerciseActual | undefined) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const existing = findCompletion(seriesId, occurrenceDate);
    const checkedItemIds = existing?.actual?.checkedItemIds;
    const merged: ExerciseActual | undefined = checkedItemIds?.length ? { ...actual, checkedItemIds } : actual;
    putCompletion({ id: existing?.id ?? generateId(), seriesId, occurrenceDate, done: true, actual: merged }, uid);
  }, [findCompletion, putCompletion]);

  // Merges into one occurrence's actual (stretch ticks, notes) without
  // touching its done state — a new row starts not done.
  const updateOccurrenceActual = useCallback((seriesId: string, occurrenceDate: string, updates: Partial<ExerciseActual>) => {
    const uid = userRef.current?.id;
    if (!uid) return;
    const existing = findCompletion(seriesId, occurrenceDate);
    const actual: ExerciseActual = { ...existing?.actual, ...updates };
    if (!actual.notes) delete actual.notes;
    if (!actual.checkedItemIds?.length) delete actual.checkedItemIds;
    putCompletion({
      id: existing?.id ?? generateId(), seriesId, occurrenceDate,
      done: existing?.done ?? false,
      actual: Object.keys(actual).length > 0 ? actual : undefined,
    }, uid);
  }, [findCompletion, putCompletion]);

  const saveRoutines = useCallback((next: ExerciseRoutine[]) => {
    setSynced(routinesRef, setRoutines, next);
    const uid = userRef.current?.id;
    if (uid) db.upsertExerciseRoutines(next, uid);
  }, []);

  const addRoutine = useCallback((kind: ExerciseRoutine['kind'], name: string): string => {
    const id = generateId();
    const sortOrder = routinesRef.current.filter(r => r.kind === kind).length;
    saveRoutines([...routinesRef.current, { id, kind, name, sortOrder, items: [], notes: '' }]);
    return id;
  }, [saveRoutines]);

  // Creates or replaces a whole routine (the builder edits a draft and saves
  // it in one go). New routines go to the end of their kind's list.
  const saveRoutine = useCallback((routine: Omit<ExerciseRoutine, 'sortOrder'>) => {
    const existing = routinesRef.current.find(r => r.id === routine.id);
    const sortOrder = existing?.sortOrder ?? routinesRef.current.filter(r => r.kind === routine.kind).length;
    const full: ExerciseRoutine = { ...routine, sortOrder };
    saveRoutines(existing
      ? routinesRef.current.map(r => (r.id === routine.id ? full : r))
      : [...routinesRef.current, full]);
  }, [saveRoutines]);

  const updateRoutine = useCallback((id: string, updates: Partial<Pick<ExerciseRoutine, 'name' | 'items' | 'notes'>>) => {
    saveRoutines(routinesRef.current.map(r => (r.id === id ? { ...r, ...updates } : r)));
  }, [saveRoutines]);

  // Activities referencing a deleted routine just lose the link — summaries
  // fall back to the plain type name ("Gym").
  const deleteRoutine = useCallback((id: string) => {
    setSynced(routinesRef, setRoutines, routinesRef.current.filter(r => r.id !== id));
    db.deleteExerciseRoutine(id);
  }, []);

  return {
    loading, series, overrides, completions, categories, routines,
    addSeries, updateSeries, deleteSeries, moveOccurrence, toggleOccurrenceDone, logOccurrence, updateOccurrenceActual,
    addRoutine, saveRoutine, updateRoutine, deleteRoutine,
    addCategory, updateCategory, setExerciseCategory, reorderCategories, deleteCategory,
  };
}
