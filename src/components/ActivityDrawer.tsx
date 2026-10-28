import { useState } from 'react';
import type { ActivitySeries, ActivityCategory, ActivityCategoryDef, ActivitySlot, WeeklyRecurrence, ExerciseDetails, ExerciseRoutine } from '../types';
import { UNCATEGORISED, getSlotLabels, isWeekendDate } from '../utils/fiveToNine';
import { cleanDetails, generateTitle } from '../utils/exercise';
import { WeekdayPicker } from './WeekdayPicker';
import { ExerciseDetailsFields } from './ExerciseDetailsFields';
const SLOTS: ActivitySlot[] = ['before', 'work', 'after'];

interface Props {
  activity?: ActivitySeries; // undefined = create mode
  defaultDate?: string;
  defaultSlot?: ActivitySlot;
  categories: ActivityCategoryDef[];
  onManageCategories: () => void;
  routines: ExerciseRoutine[];
  onAddRoutine: (kind: ExerciseRoutine['kind'], name: string) => string;
  onRenameRoutine: (id: string, name: string) => void;
  onDeleteRoutine: (id: string) => void;
  onSave: (title: string, category: ActivityCategory, slot: ActivitySlot, anchorDate: string, recurrence: WeeklyRecurrence | undefined, details: ExerciseDetails | undefined) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function ActivityDrawer({ activity, defaultDate, defaultSlot, categories, onManageCategories, routines, onAddRoutine, onRenameRoutine, onDeleteRoutine, onSave, onDelete, onClose }: Props) {
  const [title, setTitle] = useState(activity?.title ?? '');
  const [category, setCategory] = useState<ActivityCategory>(activity?.category ?? categories[0]?.id ?? '');
  const [slot, setSlot] = useState<ActivitySlot>(activity?.slot ?? defaultSlot ?? 'before');
  const [anchorDate, setAnchorDate] = useState(activity?.anchorDate ?? defaultDate ?? '');
  const [repeats, setRepeats] = useState(!!activity?.recurrence);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(activity?.recurrence?.daysOfWeek ?? [new Date().getDay()]);
  const [details, setDetails] = useState<ExerciseDetails>(activity?.details ?? { type: 'run' });
  const [detailsValid, setDetailsValid] = useState(true);

  // Weekend wording only when every day this activity lands on is a weekend
  // day; a series spanning weekdays keeps the work-day wording.
  const slotLabels = getSlotLabels(
    repeats
      ? daysOfWeek.length > 0 && daysOfWeek.every(d => d === 0 || d === 6)
      : !!anchorDate && isWeekendDate(anchorDate)
  );

  // The selected id can stop existing (deleted in the manager opened from
  // here, or an old dangling reference) — a new activity just falls back to
  // the first category; an existing one shows "Uncategorised" rather than
  // silently changing what it was saved with.
  const categoryExists = categories.some(c => c.id === category);
  const effectiveCategory = categoryExists || activity ? category : (categories[0]?.id ?? '');

  // Exercise fields follow the is_exercise flag, not the label. Switching
  // away hides them; they're only dropped if saved that way. Details that
  // were already hidden when the drawer opened (e.g. the exercise category
  // was deleted) are left untouched, not deleted.
  const isExercise = categories.some(c => c.id === effectiveCategory && c.isExercise);
  const openedAsExercise = !!activity && categories.some(c => c.id === activity.category && c.isExercise);
  const savedDetails = isExercise
    ? cleanDetails(details)
    : openedAsExercise ? undefined : activity?.details;
  const exerciseRoutines = routines.filter(r => r.kind === 'gym');
  // A blank title is fine for exercise — one is generated ("Run · 5 km").
  const resolvedTitle = title.trim() || (isExercise ? generateTitle(cleanDetails(details), routines) : '');
  const canSave = !!resolvedTitle && !!anchorDate && (!isExercise || detailsValid);

  function submit() {
    if (!canSave) return;
    onSave(resolvedTitle, effectiveCategory, slot, anchorDate, repeats ? { daysOfWeek } : undefined, savedDetails);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal activity-drawer" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">{activity ? 'Edit Activity' : 'New Activity'}</h2>

        <label className="form-label">Title</label>
        <input
          className="task-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={isExercise ? 'Optional — e.g. Morning run' : 'e.g. Gym'}
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onClose(); }}
        />

        <label className="form-label" style={{ marginTop: '1rem' }}>Category</label>
        <div className="category-picker">
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              className={`category-pill${effectiveCategory === c.id ? ' category-pill--active' : ''}`}
              style={{ '--cat-color': c.color } as React.CSSProperties}
              onClick={() => setCategory(c.id)}
            >
              <span className="activity-category-dot" />
              {c.label}
            </button>
          ))}
          {!categories.some(c => c.id === effectiveCategory) && (
            <span className="category-pill category-pill--active" style={{ '--cat-color': UNCATEGORISED.color } as React.CSSProperties}>
              <span className="activity-category-dot" />
              {UNCATEGORISED.label}
            </span>
          )}
          <button type="button" className="category-pill category-pill--add" onClick={onManageCategories} title="Manage categories">
            + Manage
          </button>
        </div>

        {isExercise && (
          <ExerciseDetailsFields
            value={details}
            onChange={(next, valid) => { setDetails(next); setDetailsValid(valid); }}
            gymRoutines={exerciseRoutines}
            onAddRoutine={name => onAddRoutine('gym', name)}
            onRenameRoutine={onRenameRoutine}
            onDeleteRoutine={onDeleteRoutine}
          />
        )}

        <label className="form-label" style={{ marginTop: '1rem' }}>Slot</label>
        <select className="task-input" value={slot} onChange={e => setSlot(e.target.value as ActivitySlot)}>
          {SLOTS.map(s => <option key={s} value={s}>{slotLabels[s]}</option>)}
        </select>

        {!activity && (
          <>
            <label className="form-label" style={{ marginTop: '1rem' }}>Date</label>
            <input
              className="task-input"
              type="date"
              value={anchorDate}
              onChange={e => setAnchorDate(e.target.value)}
            />
          </>
        )}

        <div className="recurrence-picker" style={{ marginTop: '1rem' }}>
          <label className="recurrence-toggle-label">
            <input type="checkbox" checked={repeats} onChange={e => setRepeats(e.target.checked)} />
            <span>Repeats weekly</span>
          </label>
          {repeats && (
            <div className="recurrence-body">
              <WeekdayPicker value={daysOfWeek} onChange={setDaysOfWeek} />
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn--primary" onClick={submit} disabled={!canSave}>
            {activity ? 'Save' : 'Add Activity'}
          </button>
          <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
          {activity && onDelete && (
            <button className="btn btn--ghost" style={{ color: '#ef4444' }} onClick={() => { onDelete(); onClose(); }}>Delete</button>
          )}
        </div>
      </div>
    </div>
  );
}
