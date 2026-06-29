import { useState } from 'react';
import { Board } from './components/Board';
import { TaskTable } from './components/TaskTable';
import { AddStatusModal } from './components/AddStatusModal';
import { AddProjectModal } from './components/AddProjectModal';
import { useBoardStore } from './store';
import './index.css';

type View = 'board' | 'list';

function App() {
  const store = useBoardStore();
  const [view, setView] = useState<View>('board');
  const [showAddStatus, setShowAddStatus] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  // openBoards: undefined/missing = open (default). false = collapsed.
  const [openBoards, setOpenBoards] = useState<Record<string, boolean>>({});

  function isBoardOpen(id: string) {
    return openBoards[id] !== false;
  }

  function toggleBoard(id: string) {
    setOpenBoards(prev => ({ ...prev, [id]: prev[id] === false ? true : false }));
  }

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
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Focus Board</h1>
        <div className="header-right">
          {view === 'board' && (
            <>
              <button className="btn btn--ghost btn--sm" onClick={() => setShowAddProject(true)}>
                + New Project
              </button>
              <button className="btn btn--primary btn--sm" onClick={() => setShowAddStatus(true)}>
                + Add Column
              </button>
            </>
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
          </div>
        </div>
      </header>

      {view === 'board' ? (
        <div className="boards-container">

          {/* ── All Projects (overview) ── */}
          <div className="board-section">
            <div className="board-section-header" onClick={() => toggleBoard('all')}>
              <span className="board-section-toggle">{isBoardOpen('all') ? '▼' : '▶'}</span>
              <span className="board-section-title">All Projects</span>
              <span className="board-section-count">{store.tasks.length}</span>
            </div>
            {isBoardOpen('all') && (
              <Board
                {...commonBoardProps}
                tasks={store.tasks}
                defaultProjectId={undefined}
              />
            )}
          </div>

          {/* ── Per-project boards ── */}
          {store.projects.map(project => {
            const projectTasks = store.tasks.filter(t => t.projectId === project.id);
            return (
              <div key={project.id} className="board-section">
                <div className="board-section-header" onClick={() => toggleBoard(project.id)}>
                  <span className="board-section-toggle">{isBoardOpen(project.id) ? '▼' : '▶'}</span>
                  <span className="board-section-dot" style={{ background: project.color }} />
                  <span className="board-section-title">{project.name}</span>
                  <span className="board-section-count">{projectTasks.length}</span>
                  <button
                    className="btn btn--ghost btn--icon board-section-delete"
                    title={`Delete ${project.name}`}
                    onClick={e => {
                      e.stopPropagation();
                      if (window.confirm(`Delete project "${project.name}"? Tasks will become unassigned.`)) {
                        store.removeProject(project.id);
                      }
                    }}
                  >
                    ✕
                  </button>
                </div>
                {isBoardOpen(project.id) && (
                  <Board
                    {...commonBoardProps}
                    tasks={projectTasks}
                    defaultProjectId={project.id}
                  />
                )}
              </div>
            );
          })}

        </div>
      ) : (
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

      {showAddStatus && (
        <AddStatusModal onAdd={store.addStatus} onClose={() => setShowAddStatus(false)} />
      )}
      {showAddProject && (
        <AddProjectModal onAdd={store.addProject} onClose={() => setShowAddProject(false)} />
      )}
    </div>
  );
}

export default App;
