import { useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndSensors } from '../utils/dndSensors';
import type { ActivityCategoryDef, ActivitySeries } from '../types';

const PRESET_COLORS = [
  '#f59e0b', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6',
  '#10b981', '#ef4444', '#f97316', '#84cc16', '#587f65',
];

interface Props {
  categories: ActivityCategoryDef[];
  series: ActivitySeries[];
  onAdd: (label: string, color: string) => void;
  onUpdate: (id: string, updates: Partial<Pick<ActivityCategoryDef, 'label' | 'color'>>) => void;
  onSetExercise: (id: string | null) => void;
  onReorder: (orderedIds: string[]) => void;
  onDelete: (id: string, moveToId?: string) => void;
  onClose: () => void;
}

function CategoryRow({ category, usage, others, onUpdate, onSetExercise, onDelete }: {
  category: ActivityCategoryDef;
  usage: number;
  others: ActivityCategoryDef[];
  onUpdate: Props['onUpdate'];
  onSetExercise: Props['onSetExercise'];
  onDelete: Props['onDelete'];
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const [label, setLabel] = useState(category.label);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [moveToId, setMoveToId] = useState(others[0]?.id ?? '');
  // The chosen target may itself have been deleted while this was open.
  const target = others.some(o => o.id === moveToId) ? moveToId : (others[0]?.id ?? '');

  function commitLabel() {
    const trimmed = label.trim();
    if (!trimmed) { setLabel(category.label); return; }
    if (trimmed !== category.label) onUpdate(category.id, { label: trimmed });
  }

  return (
    <li
      ref={setNodeRef}
      className={`category-row${isDragging ? ' category-row--dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition, '--cat-color': category.color } as React.CSSProperties}
    >
      <div className="category-row-main">
        {/* Only the handle starts a drag, so the inputs stay usable. */}
        <button ref={setActivatorNodeRef} className="category-row-handle" title="Drag to reorder" aria-label={`Reorder ${category.label}`} {...attributes} {...listeners}>⋮⋮</button>
        <input
          type="color"
          className="category-row-color"
          value={category.color}
          onChange={e => onUpdate(category.id, { color: e.target.value })}
          title="Change colour"
          aria-label={`Colour for ${category.label}`}
        />
        <input
          className="task-input category-row-label"
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={commitLabel}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') { setLabel(category.label); e.stopPropagation(); }
          }}
          aria-label="Category name"
        />
        <button
          type="button"
          className={`category-row-exercise${category.isExercise ? ' category-row-exercise--on' : ''}`}
          onClick={() => onSetExercise(category.isExercise ? null : category.id)}
          title={category.isExercise ? 'Exercise options attach to this category — click to turn off' : 'Use this category for exercise options'}
          aria-pressed={category.isExercise}
        >
          🏃
        </button>
        <button type="button" className="category-row-delete" onClick={() => setConfirmingDelete(true)} title="Delete category" aria-label={`Delete ${category.label}`}>×</button>
      </div>

      {confirmingDelete && (
        <div className="category-row-confirm">
          {usage > 0 ? (
            others.length > 0 ? (
              <>
                <p>
                  {usage} {usage === 1 ? 'activity uses' : 'activities use'} “{category.label}”. Move {usage === 1 ? 'it' : 'them'} to:
                </p>
                <select className="task-input" value={target} onChange={e => setMoveToId(e.target.value)}>
                  {others.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </>
            ) : (
              <p>{usage} {usage === 1 ? 'activity uses' : 'activities use'} this category. Add another category to move {usage === 1 ? 'it' : 'them'} to first.</p>
            )
          ) : (
            <p>Delete “{category.label}”? No activities use it.</p>
          )}
          {category.isExercise && usage > 0 && (
            <p className="category-row-warning">⚠ This is your exercise category — exercise details on these activities will be hidden (not deleted).</p>
          )}
          <div className="category-row-confirm-actions">
            <button
              type="button"
              className="btn btn--sm btn--danger"
              disabled={usage > 0 && others.length === 0}
              onClick={() => onDelete(category.id, usage > 0 ? target : undefined)}
            >
              {usage > 0 ? 'Move & delete' : 'Delete'}
            </button>
            <button type="button" className="btn btn--sm btn--ghost" onClick={() => setConfirmingDelete(false)}>Cancel</button>
          </div>
        </div>
      )}
    </li>
  );
}

export function CategoryManager({ categories, series, onAdd, onUpdate, onSetExercise, onReorder, onDelete, onClose }: Props) {
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(() => PRESET_COLORS[categories.length % PRESET_COLORS.length]);
  const sensors = useDndSensors({ distance: 4, keyboard: true });

  const usageById = new Map<string, number>();
  for (const s of series) usageById.set(s.category, (usageById.get(s.category) ?? 0) + 1);

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const ids = categories.map(c => c.id);
    const from = ids.indexOf(active.id as string);
    const to = ids.indexOf(over.id as string);
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(ids, from, to));
  }

  function add() {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    onAdd(trimmed, newColor);
    setNewLabel('');
    setNewColor(PRESET_COLORS[(categories.length + 1) % PRESET_COLORS.length]);
  }

  return (
    <div className="modal-backdrop" onClick={onClose} onKeyDown={e => { if (e.key === 'Escape') onClose(); }}>
      <div className="modal category-manager" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Categories</h2>
        <p className="category-manager-hint">Drag to reorder. 🏃 marks the category that gets exercise options.</p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="category-list">
              {categories.map(c => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  usage={usageById.get(c.id) ?? 0}
                  others={categories.filter(o => o.id !== c.id)}
                  onUpdate={onUpdate}
                  onSetExercise={onSetExercise}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>

        <div className="category-add-row">
          <input
            type="color"
            className="category-row-color"
            value={newColor}
            onChange={e => setNewColor(e.target.value)}
            title="Colour"
            aria-label="New category colour"
          />
          <input
            className="task-input"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') add(); }}
            placeholder="New category, e.g. Study"
            aria-label="New category name"
          />
          <button type="button" className="btn btn--primary btn--sm" onClick={add} disabled={!newLabel.trim()}>Add</button>
        </div>

        <div className="modal-actions">
          <button className="btn btn--ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
