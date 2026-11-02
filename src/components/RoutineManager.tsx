import { useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../utils/dndSensors';
import type { ActivitySeries, ExerciseRoutine, RoutineItem } from '../types';
import { formatStretch } from '../utils/exercise';

// Where the manager opens: the routine list, straight into the builder for
// one routine, or a fresh builder (e.g. the drawer's "+ New routine").
export type RoutineManagerStart =
  | { mode: 'list' }
  | { mode: 'edit'; routineId: string }
  | { mode: 'new'; onCreated?: (id: string) => void };

interface Props {
  start: RoutineManagerStart;
  routines: ExerciseRoutine[]; // stretch routines only
  series: ActivitySeries[];
  onSave: (routine: Omit<ExerciseRoutine, 'sortOrder'>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

interface Draft {
  id: string;
  isNew: boolean;
  name: string;
  notes: string;
  items: RoutineItem[];
}

// Module-level so it isn't treated as an impure call during render.
function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function draftFrom(r: ExerciseRoutine): Draft {
  return { id: r.id, isNew: false, name: r.name, notes: r.notes, items: r.items.map(i => ({ ...i })) };
}

function blankDraft(): Draft {
  return { id: newId(), isNew: true, name: '', notes: '', items: [{ id: newId(), name: '' }] };
}

function toCount(raw: string): number | undefined {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function StretchRow({ item, onChange, onRemove }: {
  item: RoutineItem;
  onChange: (next: RoutineItem) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li
      ref={setNodeRef}
      className={`stretch-row${isDragging ? ' stretch-row--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="stretch-row-line">
        <button ref={setActivatorNodeRef} type="button" className="category-row-handle" title="Drag to reorder" aria-label={`Reorder ${item.name || 'stretch'}`} {...attributes} {...listeners}>⋮⋮</button>
        <input
          className="task-input stretch-row-name"
          value={item.name}
          onChange={e => onChange({ ...item, name: e.target.value })}
          placeholder="Stretch name, e.g. Hamstring stretch"
          aria-label="Stretch name"
        />
        <button type="button" className="category-row-delete" onClick={onRemove} title="Remove stretch" aria-label={`Remove ${item.name || 'stretch'}`}>×</button>
      </div>
      <div className="stretch-row-line stretch-row-numbers">
        <label>Sets <input className="task-input" type="number" min="0" value={item.sets ?? ''} onChange={e => onChange({ ...item, sets: toCount(e.target.value) })} /></label>
        <label>Reps <input className="task-input" type="number" min="0" value={item.reps ?? ''} onChange={e => onChange({ ...item, reps: toCount(e.target.value) })} /></label>
        <label>Hold (s) <input className="task-input" type="number" min="0" value={item.holdSecs ?? ''} onChange={e => onChange({ ...item, holdSecs: toCount(e.target.value) })} /></label>
        <label>Side
          <select className="task-input" value={item.side ?? ''} onChange={e => onChange({ ...item, side: (e.target.value || undefined) as RoutineItem['side'] })}>
            <option value="">—</option>
            <option value="both">Both</option>
            <option value="each">Each side</option>
          </select>
        </label>
      </div>
      <input
        className="task-input stretch-row-notes"
        value={item.notes ?? ''}
        onChange={e => onChange({ ...item, notes: e.target.value })}
        placeholder="Notes (optional)"
        aria-label="Stretch notes"
      />
    </li>
  );
}

export function RoutineManager({ start, routines, series, onSave, onDelete, onClose }: Props) {
  const [draft, setDraft] = useState<Draft | null>(() => {
    if (start.mode === 'new') return blankDraft();
    if (start.mode === 'edit') {
      const r = routines.find(x => x.id === start.routineId);
      return r ? draftFrom(r) : null;
    }
    return null;
  });
  // Opened straight into the builder from elsewhere (drawer / detail view):
  // saving or cancelling closes the whole manager instead of going back to
  // a list the user never saw.
  const openedInBuilder = start.mode !== 'list';
  const [error, setError] = useState('');
  const sensors = useDndSensors({ distance: 4, keyboard: true });

  function usage(id: string): number {
    return series.filter(s => s.details?.type === 'stretch' && s.details.stretchRoutineId === id).length;
  }

  function leaveBuilder() {
    setError('');
    if (openedInBuilder) onClose();
    else setDraft(null);
  }

  function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { setError('Give the routine a name.'); return; }
    // Blank rows (e.g. the starter one) are dropped rather than blocking save.
    const items = draft.items
      .map(i => ({ ...i, name: i.name.trim(), notes: i.notes?.trim() || undefined }))
      .filter(i => i.name);
    onSave({ id: draft.id, kind: 'stretch', name, notes: draft.notes.trim(), items });
    if (draft.isNew && start.mode === 'new') start.onCreated?.(draft.id);
    leaveBuilder();
  }

  function duplicate(r: ExerciseRoutine) {
    onSave({ id: newId(), kind: 'stretch', name: `${r.name} (copy)`, notes: r.notes, items: r.items.map(i => ({ ...i, id: newId() })) });
  }

  function remove(r: ExerciseRoutine) {
    const n = usage(r.id);
    const msg = n > 0
      ? `"${r.name}" is used by ${n} ${n === 1 ? 'activity' : 'activities'}. Delete it? ${n === 1 ? 'It' : 'They'} will show "No routine".`
      : `Delete the "${r.name}" routine?`;
    if (window.confirm(msg)) onDelete(r.id);
  }

  function updateItem(id: string, next: RoutineItem) {
    setDraft(d => d && { ...d, items: d.items.map(i => (i.id === id ? next : i)) });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    setDraft(d => {
      if (!d) return d;
      const ids = d.items.map(i => i.id);
      const from = ids.indexOf(active.id as string);
      const to = ids.indexOf(over.id as string);
      return from === -1 || to === -1 ? d : { ...d, items: arrayMove(d.items, from, to) };
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal routine-manager" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
        {draft ? (
          <>
            <h2 className="modal-title">{draft.isNew ? 'New stretch routine' : 'Edit routine'}</h2>
            <label className="form-label">Name</label>
            <input
              className="task-input"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Morning mobility"
              autoFocus={draft.isNew}
            />
            <label className="form-label" style={{ marginTop: '0.75rem' }}>Routine notes</label>
            <textarea
              className="task-input exercise-notes"
              rows={2}
              value={draft.notes}
              onChange={e => setDraft({ ...draft, notes: e.target.value })}
              placeholder="optional"
            />

            <label className="form-label" style={{ marginTop: '0.75rem' }}>Stretches</label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={draft.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <ul className="stretch-list">
                  {draft.items.map(item => (
                    <StretchRow
                      key={item.id}
                      item={item}
                      onChange={next => updateItem(item.id, next)}
                      onRemove={() => setDraft({ ...draft, items: draft.items.filter(i => i.id !== item.id) })}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <button
              type="button"
              className="btn btn--ghost btn--sm stretch-add-btn"
              onClick={() => setDraft({ ...draft, items: [...draft.items, { id: newId(), name: '' }] })}
            >
              + Add stretch
            </button>

            {error && <p className="auth-error">{error}</p>}
            {!draft.isNew && usage(draft.id) > 0 && (
              <p className="routine-manager-hint">Changes apply everywhere this routine is used ({usage(draft.id)} {usage(draft.id) === 1 ? 'activity' : 'activities'}).</p>
            )}
            <div className="modal-actions">
              <button className="btn btn--primary" onClick={save}>Save routine</button>
              <button className="btn btn--ghost" onClick={leaveBuilder}>{openedInBuilder ? 'Cancel' : 'Back'}</button>
            </div>
          </>
        ) : (
          <>
            <h2 className="modal-title">Stretch routines</h2>
            {routines.length === 0 ? (
              <p className="routine-manager-hint">No routines yet. Build one, then attach it to a Stretching activity.</p>
            ) : (
              <ul className="routine-list">
                {routines.map(r => {
                  const n = usage(r.id);
                  return (
                    <li key={r.id} className="routine-list-row">
                      <button type="button" className="routine-list-main" onClick={() => setDraft(draftFrom(r))}>
                        <span className="routine-list-name">{r.name}</span>
                        <span className="routine-list-meta">
                          {r.items.length} {r.items.length === 1 ? 'stretch' : 'stretches'}
                          {n > 0 && ` · used by ${n}`}
                        </span>
                        {r.items.length > 0 && (
                          <span className="routine-list-preview">{r.items.slice(0, 2).map(formatStretch).join(' · ')}{r.items.length > 2 ? ' …' : ''}</span>
                        )}
                      </button>
                      <button type="button" className="btn btn--ghost btn--sm" onClick={() => duplicate(r)} title="Duplicate to make a variation">Duplicate</button>
                      <button type="button" className="category-row-delete" onClick={() => remove(r)} title={`Delete ${r.name}`} aria-label={`Delete ${r.name}`}>×</button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="modal-actions">
              <button className="btn btn--primary" onClick={() => setDraft(blankDraft())}>+ New routine</button>
              <button className="btn btn--ghost" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
