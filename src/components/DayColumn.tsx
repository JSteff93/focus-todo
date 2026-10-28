import { useDroppable } from '@dnd-kit/core';
import type { ActivityCategoryDef, ActivityOccurrence, ActivitySlot, ExerciseRoutine } from '../types';
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
  routines: ExerciseRoutine[];
  onAddActivity: (slot: ActivitySlot) => void;
  onEditActivity: (seriesId: string) => void;
  onToggleDone: (seriesId: string, occurrenceDate: string) => void;
  onLog: (seriesId: string, occurrenceDate: string) => void;
}

function SlotCard({ date, slot, occurrences, categories, routines, onAdd, onEdit, onToggleDone, onLog }: {
  date: string;
  slot: ActivitySlot;
  occurrences: ActivityOccurrence[];
  categories: ActivityCategoryDef[];
  routines: ExerciseRoutine[];
  onLog: (seriesId: string, occurrenceDate: string) => void;
  onAdd: () => void;
  onEdit: (seriesId: string) => void;
  onToggleDone: (seriesId: string, occurrenceDate: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${date}:${slot}` });

  return (
    <div ref={setNodeRef} className={`slot-card slot-card--${slot}${isOver ? ' slot-card--over' : ''}`}>
      <span className="slot-card-label">{getSlotLabels(isWeekendDate(date))[slot]}</span>
      <div className="slot-card-body">
        {occurrences.map(o => {
          const category = resolveCategory(categories, o.category);
          return (
            <ActivityCard
              key={`${o.seriesId}:${o.occurrenceDate}`}
              occurrence={o}
              color={category.color}
              isExercise={category.isExercise}
              routines={routines}
              onEdit={() => onEdit(o.seriesId)}
              onToggleDone={() => onToggleDone(o.seriesId, o.occurrenceDate)}
              onLog={() => onLog(o.seriesId, o.occurrenceDate)}
            />
          );
        })}
        <button className="activity-add-btn" onClick={onAdd}>+ Add</button>
      </div>
    </div>
  );
}

export function DayColumn({ date, dayLabel, dayNumber, isToday, occurrencesBySlot, categories, routines, onAddActivity, onEditActivity, onToggleDone, onLog }: Props) {
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
          routines={routines}
          onAdd={() => onAddActivity(slot)}
          onEdit={onEditActivity}
          onToggleDone={onToggleDone}
          onLog={onLog}
        />
      ))}
    </div>
  );
}
