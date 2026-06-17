import { useState } from 'react';
import { Board } from './components/Board';
import { TaskTable } from './components/TaskTable';
import { AddStatusModal } from './components/AddStatusModal';
import { useBoardStore } from './store';
import './index.css';

type View = 'board' | 'list';

function App() {
  const store = useBoardStore();
  const [view, setView] = useState<View>('board');
  const [showAddStatus, setShowAddStatus] = useState(false);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">Focus Board</h1>
        <div className="header-right">
          {view === 'board' && (
            <button className="btn btn--primary" onClick={() => setShowAddStatus(true)}>
              + Add Column
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
          </div>
        </div>
      </header>

      {view === 'board' ? (
        <Board
          statuses={store.statuses}
          tasks={store.tasks}
          addTask={store.addTask}
          updateTask={store.updateTask}
          deleteTask={store.deleteTask}
          moveTask={store.moveTask}
          removeStatus={store.removeStatus}
          updateStatus={store.updateStatus}
        />
      ) : (
        <TaskTable
          statuses={store.statuses}
          tasks={store.tasks}
          addTask={store.addTask}
          updateTask={store.updateTask}
          deleteTask={store.deleteTask}
        />
      )}

      {showAddStatus && (
        <AddStatusModal onAdd={store.addStatus} onClose={() => setShowAddStatus(false)} />
      )}
    </div>
  );
}

export default App;
