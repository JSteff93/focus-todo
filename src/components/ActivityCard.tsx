import { useDraggable } from '@dnd-kit/core';
import type { ActivityOccurrence } from '../types';

interface Props {
  occurrence: ActivityOccurrence;
  onEdit: () => void;
  onToggleDone: () => void;
}

export function ActivityCard({ occurrence, onEdit, onToggleDone }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${occurrence.seriesId}__${occurrence.occurrenceDate}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`activity-card${isDragging ? ' activity-card--dragging' : ''}${occurrence.isDone ? ' activity-card--done' : ''}`}
      style={{ '--cat-color': `var(--cat-${occurrence.category})` } as React.CSSProperties}
      {...attributes}
      {...listeners}
      onClick={onEdit}
    >
      <input
        type="checkbox"
        className="activity-card-check"
        checked={occurrence.isDone}
        title={occurrence.isDone ? 'Mark as not done' : 'Mark as done'}
        // Keep the tick from also starting a drag or opening the edit drawer.
        onPointerDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onChange={onToggleDone}
      />
      <span className="activity-category-dot" />
      <span className="activity-card-title">{occurrence.title}</span>
      {occurrence.isMoved && <span className="activity-card-moved" title="Moved from its usual day/slot">↻</span>}
    </div>
  );
}
