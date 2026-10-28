import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  closestCorners,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ActivitySeries, ActivityOverride, ActivityCompletion, ActivityCategory, ActivityCategoryDef, ActivitySlot, WeeklyRecurrence } from '../types';
import { getWeekStart, getWeekDates, addWeeks, formatWeekRange, getWeekOccurrences, resolveCategory } from '../utils/fiveToNine';
import { DayColumn } from './DayColumn';
import { ActivityDrawer } from './ActivityDrawer';
import { CategoryManager } from './CategoryManager';

interface Props {
  series: ActivitySeries[];
  overrides: ActivityOverride[];
  completions: ActivityCompletion[];
  categories: ActivityCategoryDef[];
  loading: boolean;
  addSeries: (title: string, category: ActivityCategory, slot: ActivitySlot, anchorDate: string, recurrence?: WeeklyRecurrence) => void;
  updateSeries: (id: string, updates: Partial<Pick<ActivitySeries, 'title' | 'category' | 'slot' | 'anchorDate' | 'recurrence'>>) => void;
  deleteSeries: (id: string) => void;
  moveOccurrence: (seriesId: string, occurrenceDate: string, newDate: string, newSlot: ActivitySlot) => void;
  toggleOccurrenceDone: (seriesId: string, occurrenceDate: string) => void;
  addCategory: (label: string, color: string) => void;
  updateCategory: (id: string, updates: Partial<Pick<ActivityCategoryDef, 'label' | 'color'>>) => void;
  setExerciseCategory: (id: string | null) => void;
  reorderCategories: (orderedIds: string[]) => void;
  deleteCategory: (id: string, moveToId?: string) => void;
}

function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function FiveToNine({ series, overrides, completions, categories, loading, addSeries, updateSeries, deleteSeries, moveOccurrence, toggleOccurrenceDone, addCategory, updateCategory, setExerciseCategory, reorderCategories, deleteCategory }: Props) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [drawerTarget, setDrawerTarget] = useState<{ date: string; slot: ActivitySlot } | null>(null);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);

  const today = toDateInput(new Date());
  const currentWeekStart = getWeekStart();
  const weekDates = getWeekDates(weekStart);
  const occurrences = getWeekOccurrences(series, overrides, completions, weekDates);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over) return;
    const [seriesId, occurrenceDate] = (active.id as string).split('__');
    const [newDate, newSlot] = (over.id as string).split(':') as [string, ActivitySlot];
    const occurrence = occurrences.find(o => o.seriesId === seriesId && o.occurrenceDate === occurrenceDate);
    if (!occurrence) return;
    if (occurrence.date === newDate && occurrence.slot === newSlot) return;
    moveOccurrence(seriesId, occurrenceDate, newDate, newSlot);
  }

  const activeOccurrence = activeId
    ? occurrences.find(o => `${o.seriesId}__${o.occurrenceDate}` === activeId)
    : undefined;

  const editingSeries = editingSeriesId ? series.find(s => s.id === editingSeriesId) : undefined;

  return (
    <div className="five-to-nine">
      <div className="five-to-nine-header">
        <button className="btn btn--ghost btn--icon five-to-nine-nav-btn" onClick={() => setWeekStart(w => addWeeks(w, -1))} title="Previous week">
          ‹
        </button>
        <span className="five-to-nine-range-label">{formatWeekRange(weekDates)}</span>
        <button className="btn btn--ghost btn--icon five-to-nine-nav-btn" onClick={() => setWeekStart(w => addWeeks(w, 1))} title="Next week">
          ›
        </button>
        {weekStart !== currentWeekStart && (
          <button className="btn btn--ghost btn--sm five-to-nine-today-btn" onClick={() => setWeekStart(currentWeekStart)}>
            Return to current week
          </button>
        )}
        <button className="btn btn--ghost btn--sm five-to-nine-categories-btn" onClick={() => setManagingCategories(true)}>
          ● Categories
        </button>
      </div>

      {loading ? (
        <div className="app-loading"><span className="app-loading-spinner" /></div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={({ active }) => setActiveId(active.id as string)}
          onDragEnd={handleDragEnd}
        >
          <div className="five-to-nine-grid">
            {weekDates.map((date, i) => {
              const dayOccurrences = occurrences.filter(o => o.date === date);
              return (
                <DayColumn
                  key={date}
                  date={date}
                  dayLabel={WEEKDAY_LABELS[i]}
                  dayNumber={String(parseInt(date.slice(-2), 10))}
                  isToday={date === today}
                  categories={categories}
                  occurrencesBySlot={{
                    before: dayOccurrences.filter(o => o.slot === 'before'),
                    work: dayOccurrences.filter(o => o.slot === 'work'),
                    after: dayOccurrences.filter(o => o.slot === 'after'),
                  }}
                  onAddActivity={slot => setDrawerTarget({ date, slot })}
                  onEditActivity={id => setEditingSeriesId(id)}
                  onToggleDone={toggleOccurrenceDone}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeOccurrence && (
              <div className={`activity-card activity-card--overlay${activeOccurrence.isDone ? ' activity-card--done' : ''}`} style={{ '--cat-color': resolveCategory(categories, activeOccurrence.category).color } as React.CSSProperties}>
                <span className="activity-category-dot" />
                <span className="activity-card-title">{activeOccurrence.title}</span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {drawerTarget && (
        <ActivityDrawer
          defaultDate={drawerTarget.date}
          defaultSlot={drawerTarget.slot}
          categories={categories}
          onManageCategories={() => setManagingCategories(true)}
          onSave={(title, category, slot, anchorDate, recurrence) => addSeries(title, category, slot, anchorDate, recurrence)}
          onClose={() => setDrawerTarget(null)}
        />
      )}

      {editingSeries && (
        <ActivityDrawer
          activity={editingSeries}
          categories={categories}
          onManageCategories={() => setManagingCategories(true)}
          onSave={(title, category, slot, anchorDate, recurrence) => updateSeries(editingSeries.id, { title, category, slot, anchorDate, recurrence })}
          onDelete={() => deleteSeries(editingSeries.id)}
          onClose={() => setEditingSeriesId(null)}
        />
      )}

      {/* After the drawers so it stacks on top when opened from one. */}
      {managingCategories && (
        <CategoryManager
          categories={categories}
          series={series}
          onAdd={addCategory}
          onUpdate={updateCategory}
          onSetExercise={setExerciseCategory}
          onReorder={reorderCategories}
          onDelete={deleteCategory}
          onClose={() => setManagingCategories(false)}
        />
      )}
    </div>
  );
}
