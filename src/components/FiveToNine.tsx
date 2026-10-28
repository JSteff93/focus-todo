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
import type { ActivitySeries, ActivityOverride, ActivityCompletion, ActivityCategory, ActivityCategoryDef, ActivitySlot, WeeklyRecurrence, ExerciseActual, ExerciseDetails, ExerciseRoutine } from '../types';
import { getWeekStart, getWeekDates, addWeeks, formatWeekRange, getWeekOccurrences, resolveCategory } from '../utils/fiveToNine';
import { DayColumn } from './DayColumn';
import { ActivityDrawer } from './ActivityDrawer';
import { CategoryManager } from './CategoryManager';
import { ExerciseLogModal } from './ExerciseLogModal';
import { displayTitle } from '../utils/exercise';
import { RoutineManager, type RoutineManagerStart } from './RoutineManager';
import { StretchDetailModal } from './StretchDetailModal';

interface Props {
  series: ActivitySeries[];
  overrides: ActivityOverride[];
  completions: ActivityCompletion[];
  categories: ActivityCategoryDef[];
  routines: ExerciseRoutine[];
  loading: boolean;
  addSeries: (title: string, category: ActivityCategory, slot: ActivitySlot, anchorDate: string, recurrence?: WeeklyRecurrence, details?: ExerciseDetails) => void;
  updateSeries: (id: string, updates: Partial<Pick<ActivitySeries, 'title' | 'category' | 'slot' | 'anchorDate' | 'recurrence' | 'details'>>) => void;
  deleteSeries: (id: string) => void;
  moveOccurrence: (seriesId: string, occurrenceDate: string, newDate: string, newSlot: ActivitySlot) => void;
  toggleOccurrenceDone: (seriesId: string, occurrenceDate: string) => void;
  logOccurrence: (seriesId: string, occurrenceDate: string, actual: ExerciseActual | undefined) => void;
  updateOccurrenceActual: (seriesId: string, occurrenceDate: string, updates: Partial<ExerciseActual>) => void;
  addRoutine: (kind: ExerciseRoutine['kind'], name: string) => string;
  saveRoutine: (routine: Omit<ExerciseRoutine, 'sortOrder'>) => void;
  updateRoutine: (id: string, updates: Partial<Pick<ExerciseRoutine, 'name' | 'items' | 'notes'>>) => void;
  deleteRoutine: (id: string) => void;
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

export function FiveToNine({ series, overrides, completions, categories, routines, loading, addSeries, updateSeries, deleteSeries, moveOccurrence, toggleOccurrenceDone, logOccurrence, updateOccurrenceActual, addRoutine, saveRoutine, updateRoutine, deleteRoutine, addCategory, updateCategory, setExerciseCategory, reorderCategories, deleteCategory }: Props) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart());
  const [drawerTarget, setDrawerTarget] = useState<{ date: string; slot: ActivitySlot } | null>(null);
  const [editingSeriesId, setEditingSeriesId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [managingCategories, setManagingCategories] = useState(false);
  const [logging, setLogging] = useState<{ seriesId: string; occurrenceDate: string } | null>(null);
  const [viewingStretch, setViewingStretch] = useState<{ seriesId: string; occurrenceDate: string } | null>(null);
  const [routineManager, setRoutineManager] = useState<RoutineManagerStart | null>(null);

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

  // Ticking an exercise occurrence done offers the optional "Log it" prompt;
  // unticking (or a non-exercise activity) just toggles.
  function handleToggleDone(seriesId: string, occurrenceDate: string) {
    const o = occurrences.find(x => x.seriesId === seriesId && x.occurrenceDate === occurrenceDate);
    toggleOccurrenceDone(seriesId, occurrenceDate);
    if (o && !o.isDone && o.details && resolveCategory(categories, o.category).isExercise) {
      setLogging({ seriesId, occurrenceDate });
    }
  }

  // Stretching cards open their routine instead of going straight to edit.
  function handleOpenActivity(seriesId: string, occurrenceDate: string) {
    const o = occurrences.find(x => x.seriesId === seriesId && x.occurrenceDate === occurrenceDate);
    if (o?.details?.type === 'stretch' && resolveCategory(categories, o.category).isExercise) {
      setViewingStretch({ seriesId, occurrenceDate });
    } else {
      setEditingSeriesId(seriesId);
    }
  }

  const viewingOccurrence = viewingStretch
    ? occurrences.find(o => o.seriesId === viewingStretch.seriesId && o.occurrenceDate === viewingStretch.occurrenceDate)
    : undefined;
  const stretchRoutines = routines.filter(r => r.kind === 'stretch');

  function toggleStretchItem(seriesId: string, occurrenceDate: string, itemId: string, current: string[]) {
    const next = current.includes(itemId) ? current.filter(id => id !== itemId) : [...current, itemId];
    updateOccurrenceActual(seriesId, occurrenceDate, { checkedItemIds: next });
  }

  const loggingOccurrence = logging
    ? occurrences.find(o => o.seriesId === logging.seriesId && o.occurrenceDate === logging.occurrenceDate)
    : undefined;

  const routineProps = {
    routines,
    onAddRoutine: addRoutine,
    onRenameRoutine: (id: string, name: string) => updateRoutine(id, { name }),
    onDeleteRoutine: deleteRoutine,
    onNewStretchRoutine: (select: (id: string) => void) => setRoutineManager({ mode: 'new', onCreated: select }),
    onManageStretchRoutines: () => setRoutineManager({ mode: 'list' }),
  };

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
        <button className="btn btn--ghost btn--sm five-to-nine-categories-btn" onClick={() => setRoutineManager({ mode: 'list' })}>
          🧘 Routines
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => setManagingCategories(true)}>
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
                  routines={routines}
                  onLog={(seriesId, occurrenceDate) => setLogging({ seriesId, occurrenceDate })}
                  occurrencesBySlot={{
                    before: dayOccurrences.filter(o => o.slot === 'before'),
                    work: dayOccurrences.filter(o => o.slot === 'work'),
                    after: dayOccurrences.filter(o => o.slot === 'after'),
                  }}
                  onAddActivity={slot => setDrawerTarget({ date, slot })}
                  onEditActivity={handleOpenActivity}
                  onToggleDone={handleToggleDone}
                />
              );
            })}
          </div>

          <DragOverlay>
            {activeOccurrence && (
              <div className={`activity-card activity-card--overlay${activeOccurrence.isDone ? ' activity-card--done' : ''}`} style={{ '--cat-color': resolveCategory(categories, activeOccurrence.category).color } as React.CSSProperties}>
                <span className="activity-category-dot" />
                <span className="activity-card-title">{displayTitle(activeOccurrence.title, activeOccurrence.details)}</span>
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
          {...routineProps}
          onSave={(title, category, slot, anchorDate, recurrence, details) => addSeries(title, category, slot, anchorDate, recurrence, details)}
          onClose={() => setDrawerTarget(null)}
        />
      )}

      {editingSeries && (
        <ActivityDrawer
          activity={editingSeries}
          categories={categories}
          onManageCategories={() => setManagingCategories(true)}
          {...routineProps}
          onSave={(title, category, slot, anchorDate, recurrence, details) => updateSeries(editingSeries.id, { title, category, slot, anchorDate, recurrence, details })}
          onDelete={() => deleteSeries(editingSeries.id)}
          onClose={() => setEditingSeriesId(null)}
        />
      )}

      {loggingOccurrence?.details && (
        <ExerciseLogModal
          key={`${loggingOccurrence.seriesId}:${loggingOccurrence.occurrenceDate}`}
          title={loggingOccurrence.title}
          details={loggingOccurrence.details}
          routines={routines}
          actual={loggingOccurrence.actual}
          onSave={actual => logOccurrence(loggingOccurrence.seriesId, loggingOccurrence.occurrenceDate, actual)}
          onClose={() => setLogging(null)}
        />
      )}

      {viewingOccurrence && (
        <StretchDetailModal
          key={`${viewingOccurrence.seriesId}:${viewingOccurrence.occurrenceDate}`}
          occurrence={viewingOccurrence}
          routine={stretchRoutines.find(r => r.id === viewingOccurrence.details?.stretchRoutineId)}
          onToggleItem={itemId => toggleStretchItem(viewingOccurrence.seriesId, viewingOccurrence.occurrenceDate, itemId, viewingOccurrence.actual?.checkedItemIds ?? [])}
          onSaveNotes={notes => updateOccurrenceActual(viewingOccurrence.seriesId, viewingOccurrence.occurrenceDate, { notes })}
          onMarkDone={() => toggleOccurrenceDone(viewingOccurrence.seriesId, viewingOccurrence.occurrenceDate)}
          onEditActivity={() => { setViewingStretch(null); setEditingSeriesId(viewingOccurrence.seriesId); }}
          onEditRoutine={() => {
            const id = viewingOccurrence.details?.stretchRoutineId;
            if (id) setRoutineManager({ mode: 'edit', routineId: id });
          }}
          onClose={() => setViewingStretch(null)}
        />
      )}

      {/* After the drawers so it stacks on top when opened from one. */}
      {routineManager && (
        <RoutineManager
          start={routineManager}
          routines={stretchRoutines}
          series={series}
          onSave={saveRoutine}
          onDelete={deleteRoutine}
          onClose={() => setRoutineManager(null)}
        />
      )}

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
