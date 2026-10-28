import { useState } from 'react';
import type { ActivityOccurrence, ExerciseRoutine } from '../types';
import { formatStretch, stretchProgress } from '../utils/exercise';

interface Props {
  occurrence: ActivityOccurrence;
  routine?: ExerciseRoutine;
  onToggleItem: (itemId: string) => void;
  onSaveNotes: (notes: string) => void;
  onMarkDone: () => void;
  onEditActivity: () => void;
  onEditRoutine: () => void;
  onClose: () => void;
}

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });
}

// What clicking a Stretching card opens: the attached routine laid out in
// full, with per-day ticks and notes (stored on this occurrence's actual).
export function StretchDetailModal({ occurrence, routine, onToggleItem, onSaveNotes, onMarkDone, onEditActivity, onEditRoutine, onClose }: Props) {
  const [notes, setNotes] = useState(occurrence.actual?.notes ?? '');
  const checked = new Set(occurrence.actual?.checkedItemIds ?? []);
  const progress = stretchProgress(routine, occurrence.actual);
  const allTicked = progress.total > 0 && progress.done === progress.total;

  function commitNotes() {
    if (notes.trim() !== (occurrence.actual?.notes ?? '')) onSaveNotes(notes.trim());
  }

  return (
    <div className="modal-backdrop" onClick={() => { commitNotes(); onClose(); }}>
      <div
        className="modal stretch-detail"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') { commitNotes(); onClose(); } }}
      >
        <div className="stretch-detail-head">
          <h2 className="modal-title">{occurrence.title}</h2>
          <span className="stretch-detail-day">
            {formatDay(occurrence.date)}{occurrence.isDone ? ' · ✓ Done' : ''}
          </span>
        </div>

        {routine ? (
          <>
            <p className="stretch-detail-routine">
              🧘 {routine.name}
              {progress.total > 0 && <span className="stretch-detail-progress"> · {progress.done}/{progress.total}</span>}
            </p>
            {routine.items.length === 0 ? (
              <p className="routine-manager-hint">This routine has no stretches yet.</p>
            ) : (
              <ul className="stretch-detail-list">
                {routine.items.map(item => (
                  <li key={item.id}>
                    <label className={`stretch-detail-item${checked.has(item.id) ? ' stretch-detail-item--done' : ''}`}>
                      <input type="checkbox" checked={checked.has(item.id)} onChange={() => onToggleItem(item.id)} />
                      <span>
                        <span className="stretch-detail-item-name">{formatStretch(item)}</span>
                        {item.notes && <span className="stretch-detail-item-notes">{item.notes}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {routine.notes && <p className="stretch-detail-routine-notes">{routine.notes}</p>}
            {allTicked && !occurrence.isDone && (
              <div className="stretch-detail-alldone">
                <span>All stretches done 🎉</span>
                <button className="btn btn--primary btn--sm" onClick={() => { commitNotes(); onMarkDone(); }}>Mark activity done</button>
              </div>
            )}
          </>
        ) : (
          <p className="routine-manager-hint">No routine — attach one with Edit activity.</p>
        )}

        <label className="form-label" style={{ marginTop: '0.75rem' }}>Notes for today</label>
        <textarea
          className="task-input exercise-notes"
          rows={2}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={commitNotes}
          placeholder="e.g. felt tight today"
        />

        <div className="modal-actions">
          <button className="btn btn--primary" onClick={() => { commitNotes(); onClose(); }}>Done</button>
          <button className="btn btn--ghost" onClick={() => { commitNotes(); onEditActivity(); }}>Edit activity</button>
          {routine && <button className="btn btn--ghost" onClick={() => { commitNotes(); onEditRoutine(); }}>Edit routine</button>}
        </div>
      </div>
    </div>
  );
}
