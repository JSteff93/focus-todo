import { useState, useLayoutEffect, useRef, useEffect, useMemo } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Board } from './components/Board';
import { ProjectBoardSection } from './components/ProjectBoardSection';
import { TaskTable } from './components/TaskTable';
import { FocusZone } from './components/FocusZone';
import type { FocusZoneHandle } from './components/FocusZone';
import { FiveToNine } from './components/FiveToNine';
import { AddStatusModal } from './components/AddStatusModal';
import { AddProjectModal } from './components/AddProjectModal';
import { Auth } from './components/Auth';
import { BrandMark } from './components/BrandMark';
import { useBoardStore, useFiveToNineStore } from './store';
import { supabase } from './lib/supabase';
import { visibleBoardTasks } from './utils/boardTasks';
import { getFocusSessionStatus, formatTimerTime, getFocusTaskDisplayTitle } from './utils/focusSessionStatus';
import { SwitchFocusModal } from './components/SwitchFocusModal';
import { buildTaskFocusSecsMap } from './utils/focusTime';
import './index.css';

type View = 'board' | 'list' | 'focus' | 'five-to-nine';
type Theme = 'dark' | 'light';

function App() {
  const store = useBoardStore();
  const [view, setView] = useState<View>(() => {
    const saved = localStorage.getItem('view');
    if (saved === 'board' || saved === 'list' || saved === 'focus' || saved === 'five-to-nine') return saved;
    return 'board';
  });
  const f29 = useFiveToNineStore(store.user, view === 'five-to-nine');
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  // openBoards: undefined/missing = open (default). false = collapsed.
  const [openBoards, setOpenBoards] = useState<Record<string, boolean>>({});

  const [focusTaskId, setFocusTaskId] = useState<string | null>(() => localStorage.getItem('focusTaskId'));

  useEffect(() => {
    if (focusTaskId) localStorage.setItem('focusTaskId', focusTaskId);
    else localStorage.removeItem('focusTaskId');
  }, [focusTaskId]);

  useEffect(() => {
    localStorage.setItem('view', view);
  }, [view]);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const focusZoneRef = useRef<FocusZoneHandle>(null);

  // Routes through FocusZone's own selectTask so the outgoing task's worked
  // time is always logged the same way, whether the switch was triggered
  // from FocusZone's own selector or a Board card's Focus button.
  function goToFocus(taskId: string) {
    focusZoneRef.current?.selectTask(taskId);
    setView('focus');
  }

  const [focusStatus, setFocusStatus] = useState(getFocusSessionStatus);

  useEffect(() => {
    const tick = () => setFocusStatus(getFocusSessionStatus());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const [pendingFocusTaskId, setPendingFocusTaskId] = useState<string | null>(null);

  function handleFocusTaskClick(taskId: string) {
    // Confirm before switching whenever a different task is already loaded
    // into the Focus Zone — not just while the timer happens to be running,
    // since a paused session can still hold unlogged progress.
    if (focusTaskId && focusTaskId !== taskId) {
      setPendingFocusTaskId(taskId);
    } else {
      goToFocus(taskId);
    }
  }

  function continueCurrentSession() {
    setPendingFocusTaskId(null);
    setView('focus');
  }

  function switchFocusToPending() {
    if (!pendingFocusTaskId) return;
    goToFocus(pendingFocusTaskId);
    setPendingFocusTaskId(null);
  }

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function isBoardOpen(id: string, defaultOpen = true) {
    const stored = openBoards[id];
    return stored !== undefined ? stored : defaultOpen;
  }

  function toggleBoard(id: string, defaultOpen = true) {
    const opening = !isBoardOpen(id, defaultOpen);
    setOpenBoards(prev => {
      const next = { ...prev, [id]: opening };
      if (opening) {
        if (id === 'all') {
          // Opening "All Projects" collapses every specific project board.
          store.projects.forEach(p => { next[p.id] = false; });
        } else {
          // Opening a specific project only collapses "All Projects" —
          // other open project boards are left alone.
          next.all = false;
        }
      }
      return next;
    });
  }

  const projectSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleProjectDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = store.projects.map(p => p.id);
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;
    store.reorderProjects(arrayMove(ids, oldIndex, newIndex));
  }

  const focusSecsByTask = useMemo(() => buildTaskFocusSecsMap(store.history), [store.history]);

  const commonBoardProps = {
    statuses: store.statuses,
    addTask: store.addTask,
    updateTask: store.updateTask,
    deleteTask: store.deleteTask,
    moveTask: store.moveTask,
    completeRecurring: store.completeRecurring,
    removeStatus: store.removeStatus,
    updateStatus: store.updateStatus,
    projects: store.projects,
    focusSecsByTask,
  };

  if (store.loading) {
    return <div className="app-loading"><span className="app-loading-spinner" /></div>;
  }

  if (!store.user) {
    return <Auth />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <BrandMark />
        <div className="header-right">
          {view === 'focus' && (
            <span className="focus-zone-badge">Focus Zone</span>
          )}
          {focusStatus.isActive && view !== 'focus' && (
            <button
              className={`focus-session-btn${focusStatus.isOvertime ? ' focus-session-btn--overtime' : ''}`}
              onClick={() => setView('focus')}
              title="Focus session in progress — click to return"
            >
              <span className="focus-session-btn-dot" />
              {focusStatus.isOvertime
                ? `+${formatTimerTime(focusStatus.overtimeSeconds)} overtime`
                : formatTimerTime(focusStatus.timeLeft)}
            </button>
          )}
          <div className="view-toggle">
            <button
              className={`btn btn--sm ${view === 'board' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setView('board')}
            >
              ⊞ Board
            </button>
            <button
              className={`btn btn--sm ${view === 'list' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setView('list')}
            >
              ≡ List
            </button>
            <button
              className={`btn btn--sm ${view === 'focus' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setView('focus')}
            >
              ◎ Focus
            </button>
            <button
              className={`btn btn--sm ${view === 'five-to-nine' ? 'btn--primary' : 'btn--ghost'}`}
              onClick={() => setView('five-to-nine')}
            >
              ▦ Five to Nine
            </button>
          </div>
          <div className="nav-menu" ref={menuRef}>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => setMenuOpen(o => !o)}
              title="Menu"
              aria-haspopup="true"
              aria-expanded={menuOpen}
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="nav-menu-panel">
                <button
                  className="nav-menu-item"
                  onClick={() => { setTheme(t => t === 'dark' ? 'light' : 'dark'); setMenuOpen(false); }}
                >
                  <span className="nav-menu-item-icon">{theme === 'dark' ? '☀' : '☾'}</span>
                  Switch to {theme === 'dark' ? 'light' : 'dark'} mode
                </button>
                {view === 'board' && (
                  <>
                    <div className="nav-menu-divider" />
                    <button
                      className="nav-menu-item"
                      onClick={() => { setShowAddProject(true); setMenuOpen(false); }}
                    >
                      + New Project
                    </button>
                    <button
                      className="nav-menu-item"
                      onClick={() => { setShowAddStatus(true); setMenuOpen(false); }}
                    >
                      + Add Column
                    </button>
                  </>
                )}
                <div className="nav-menu-divider" />
                <button
                  className="nav-menu-item nav-menu-item--danger"
                  onClick={() => { setMenuOpen(false); supabase.auth.signOut(); }}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Kept mounted (just hidden) rather than unmounted when leaving this tab,
          so a popped-out timer keeps ticking and doesn't get force-closed. */}
      <div style={{ display: view === 'focus' ? 'contents' : 'none' }}>
        <FocusZone
          ref={focusZoneRef}
          tasks={store.tasks}
          statuses={store.statuses}
          projects={store.projects}
          selectedTaskId={focusTaskId}
          onSelectTask={setFocusTaskId}
          onIncrementPomodoro={store.incrementPomodoro}
          onUpdateTask={store.updateTask}
          history={store.history}
          onAddSessionEntry={store.addSessionEntry}
          onUpdateSessionEntry={store.updateSessionEntry}
          onDeleteSessionEntry={store.deleteSessionEntry}
        />
      </div>

      {view === 'board' && (
        <div className="boards-container">

          {/* ── All Projects (overview) ── */}
          <div className="board-section">
            <div className="board-section-header" onClick={() => toggleBoard('all', true)}>
              <span className="board-section-toggle">{isBoardOpen('all', true) ? '▼' : '▶'}</span>
              <span className="board-section-title">All Projects</span>
              <span className="board-section-count">{visibleBoardTasks(store.tasks).length}</span>
            </div>
            {isBoardOpen('all', true) && (
              <Board
                {...commonBoardProps}
                tasks={store.tasks}
                defaultProjectId={undefined}
                onFocusTask={handleFocusTaskClick}
              />
            )}
          </div>

          {/* ── Per-project boards ── */}
          <DndContext
            sensors={projectSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleProjectDragEnd}
          >
            <SortableContext items={store.projects.map(p => p.id)} strategy={verticalListSortingStrategy}>
              {store.projects.map(project => {
                const projectTasks = store.tasks.filter(t => t.projectId === project.id);
                return (
                  <ProjectBoardSection
                    key={project.id}
                    project={project}
                    tasks={projectTasks}
                    taskCount={visibleBoardTasks(projectTasks).length}
                    isOpen={isBoardOpen(project.id, false)}
                    onToggle={() => toggleBoard(project.id, false)}
                    onDelete={() => {
                      if (window.confirm(`Delete project "${project.name}"? Tasks will become unassigned.`)) {
                        store.removeProject(project.id);
                      }
                    }}
                    {...commonBoardProps}
                    onFocusTask={handleFocusTaskClick}
                  />
                );
              })}
            </SortableContext>
          </DndContext>

        </div>
      )}

      {view === 'list' && (
        <TaskTable
          statuses={store.statuses}
          tasks={store.tasks}
          projects={store.projects}
          addTask={store.addTask}
          updateTask={store.updateTask}
          deleteTask={store.deleteTask}
          completeRecurring={store.completeRecurring}
        />
      )}

      {view === 'five-to-nine' && (
        <FiveToNine
          series={f29.series}
          overrides={f29.overrides}
          completions={f29.completions}
          loading={f29.loading}
          addSeries={f29.addSeries}
          updateSeries={f29.updateSeries}
          deleteSeries={f29.deleteSeries}
          moveOccurrence={f29.moveOccurrence}
          toggleOccurrenceDone={f29.toggleOccurrenceDone}
        />
      )}

      {showAddStatus && (
        <AddStatusModal onAdd={store.addStatus} onClose={() => setShowAddStatus(false)} />
      )}
      {showAddProject && (
        <AddProjectModal onAdd={store.addProject} onClose={() => setShowAddProject(false)} />
      )}
      {pendingFocusTaskId && (
        <SwitchFocusModal
          currentTaskTitle={getFocusTaskDisplayTitle(focusTaskId, store.tasks)}
          newTaskTitle={store.tasks.find(t => t.id === pendingFocusTaskId)?.title ?? 'Unknown task'}
          onContinue={continueCurrentSession}
          onSwitch={switchFocusToPending}
          onClose={() => setPendingFocusTaskId(null)}
        />
      )}
    </div>
  );
}

export default App;
