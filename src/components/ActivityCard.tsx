import { useDraggable } from '@dnd-kit/core';
import type { ActivityOccurrence, ExerciseRoutine } from '../types';
import { EXERCISE_ICONS, displayTitle, formatPace, stretchProgress, summarise, summaryBeyondTitle } from '../utils/exercise';

interface Props {
  occurrence: ActivityOccurrence;
  // Resolved category colour (see resolveCategory) — drives --cat-color.
  color: string;
  // Whether the occurrence's category is the exercise one — exercise
  // details are only shown (not deleted) while it is.
  isExercise: boolean;
  routines: ExerciseRoutine[];
  onEdit: () => void;
  onToggleDone: () => void;
  onLog: () => void;
}

export function ActivityCard({ occurrence, color, isExercise, routines, onEdit, onToggleDone, onLog }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${occurrence.seriesId}__${occurrence.occurrenceDate}`,
  });

  const details = isExercise ? occurrence.details : undefined;
  // Unticking keeps the log but hides it until re-ticked.
  const logged = details && occurrence.isDone ? occurrence.actual : undefined;
  const summary = details ? summarise(details, routines, logged) : null;
  const pace = details && logged ? formatPace(details.type, logged.distanceKm, logged.durationMins) : null;
  const progress = details?.type === 'stretch'
    ? stretchProgress(routines.find(r => r.id === details.stretchRoutineId), occurrence.actual)
    : null;
  const partlyTicked = !!progress && progress.done > 0 && progress.done < progress.total;
  const title = displayTitle(occurrence.title, details);
  const summaryText = summary ? summaryBeyondTitle(summary, title) : '';
  const showSummary = !!summaryText || !!pace;

  return (
    <div
      ref={setNodeRef}
      className={`activity-card${isDragging ? ' activity-card--dragging' : ''}${occurrence.isDone ? ' activity-card--done' : ''}`}
      style={{ '--cat-color': color } as React.CSSProperties}
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
        // The drag sensors listen for mouse/touch starts (utils/dndSensors).
        onMouseDown={e => e.stopPropagation()}
        onTouchStart={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        onChange={onToggleDone}
      />
      <span className="activity-category-dot" />
      <span className="activity-card-text">
        <span className="activity-card-title">{title}</span>
        {showSummary && details && (
          <span className={`activity-card-summary${logged ? ' activity-card-summary--logged' : ''}`}>
            {logged ? '✓ ' : <span aria-hidden="true">{EXERCISE_ICONS[details.type]} </span>}
            {[summaryText, pace].filter(Boolean).join(' · ')}
          </span>
        )}
      </span>
      {partlyTicked && (
        <span className="activity-card-progress" title={`${progress.done} of ${progress.total} stretches ticked`} aria-label={`${progress.done} of ${progress.total} stretches ticked`}>
          {progress.done}/{progress.total}
        </span>
      )}
      {details && occurrence.isDone && (
        <button
          type="button"
          className="activity-card-log-btn"
          title={logged ? 'Edit log' : 'Log what you did'}
          aria-label={logged ? 'Edit log' : 'Log what you did'}
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onLog(); }}
        >
          ✎
        </button>
      )}
      {occurrence.isMoved && <span className="activity-card-moved" title="Moved from its usual day/slot" aria-label="Moved from its usual day/slot">↻</span>}
    </div>
  );
}
