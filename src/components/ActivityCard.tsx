import { useDraggable } from '@dnd-kit/core';
import type { ActivityOccurrence } from '../types';

interface Props {
  occurrence: ActivityOccurrence;
  onEdit: () => void;
}

export function ActivityCard({ occurrence, onEdit }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${occurrence.seriesId}__${occurrence.occurrenceDate}`,
  });

  return (
    <div
      ref={setNodeRef}
      className={`activity-card${isDragging ? ' activity-card--dragging' : ''}`}
      style={{ '--cat-color': `var(--cat-${occurrence.category})` } as React.CSSProperties}
      {...attributes}
      {...listeners}
      onClick={onEdit}
    >
      <span className="activity-category-dot" />
      <span className="activity-card-title">{occurrence.title}</span>
      {occurrence.isMoved && <span className="activity-card-moved" title="Moved from its usual day/slot">↻</span>}
    </div>
  );
}
