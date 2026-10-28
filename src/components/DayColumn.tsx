import { useDroppable } from '@dnd-kit/core';
import type { ActivityCategoryDef, ActivityOccurrence, ActivitySlot } from '../types';
import { getSlotLabels, isWeekendDate, resolveCategory } from '../utils/fiveToNine';
import { ActivityCard } from './ActivityCard';

const SLOTS: ActivitySlot[] = ['before', 'work', 'after'];

interface Props {
  date: string;
  dayLabel: string;
  dayNumber: string;
  isToday: boolean;
  occurrencesBySlot: Record<ActivitySlot, ActivityOccurrence[]>;
  categories: ActivityCategoryDef[];
  onAddActivity: (slot: ActivitySlot) => void;
  onEditActivity: (seriesId: string) => void;
  onToggleDone: (seriesId: string, occurrenceDate: string) => void;
}

function SlotCard({ date, slot, occurrences, categories, onAdd, onEdit, onToggleDone }: {
  date: string;
  slot: ActivitySlot;
  occurrences: ActivityOccurrence[];
  categories: ActivityCategoryDef[];
  onAdd: () => void;
  onEdit: (seriesId: string) => void;
  onToggleDone: (seriesId: string, occurrenceDate: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${date}:${slot}` });

  return (
    <div ref={setNodeRef} className={`slot-card slot-card--${slot}${isOver ? ' slot-card--over' : ''}`}>
      <span className="slot-card-label">{getSlotLabels(isWeekendDate(date))[slot]}</span>
      <div className="slot-card-body">
        {occurrences.map(o => (
          <ActivityCard key={`${o.seriesId}:${o.occurrenceDate}`} occurrence={o} color={resolveCategory(categories, o.category).color} onEdit={() => onEdit(o.seriesId)} onToggleDone={() => onToggleDone(o.seriesId, o.occurrenceDate)} />
        ))}
        <button className="activity-add-btn" onClick={onAdd}>+ Add</button>
      </div>
    </div>
  );
}

export function DayColumn({ date, dayLabel, dayNumber, isToday, occurrencesBySlot, categories, onAddActivity, onEditActivity, onToggleDone }: Props) {
  return (
    <div className="day-column">
      <div className={`day-column-header${isToday ? ' day-column-header--today' : ''}`}>
        <span className="day-column-weekday">{dayLabel}</span>
        <span className="day-column-date">{dayNumber}</span>
      </div>
      {SLOTS.map(slot => (
        <SlotCard
          key={slot}
          date={date}
          slot={slot}
          occurrences={occurrencesBySlot[slot]}
          categories={categories}
          onAdd={() => onAddActivity(slot)}
          onEdit={onEditActivity}
          onToggleDone={onToggleDone}
        />
      ))}
    </div>
  );
}
