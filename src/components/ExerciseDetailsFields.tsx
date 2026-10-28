import { useState } from 'react';
import type { ExerciseDetails, ExerciseRoutine, ExerciseType } from '../types';
import { EXERCISE_ICONS, EXERCISE_LABELS, EXERCISE_TYPES, durationInputValue, hasDistance, parseDuration, parseNonNegative } from '../utils/exercise';

interface Props {
  value: ExerciseDetails;
  // `valid` is false while any number field holds something unparseable or
  // negative — the drawer disables Save until it's fixed.
  onChange: (next: ExerciseDetails, valid: boolean) => void;
  gymRoutines: ExerciseRoutine[];
  onAddRoutine: (name: string) => string;
  onRenameRoutine: (id: string, name: string) => void;
  onDeleteRoutine: (id: string) => void;
}

interface Drafts {
  distance: string;
  duration: string;
  elevation: string;
}

function GymRoutinePicker({ routines, value, onChange, onAdd, onRename, onDelete }: {
  routines: ExerciseRoutine[];
  value?: string;
  onChange: (id: string | undefined) => void;
  onAdd: (name: string) => string;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState('');

  function add() {
    const name = newName.trim();
    if (!name) return;
    onChange(onAdd(name));
    setNewName('');
  }

  return (
    <div className="exercise-field">
      <label className="form-label">Routine</label>
      <div className="exercise-routine-row">
        <select className="task-input" value={value ?? ''} onChange={e => onChange(e.target.value || undefined)}>
          <option value="">— none —</option>
          {routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => setEditing(e => !e)} aria-expanded={editing}>
          {editing ? 'Done' : 'Edit list'}
        </button>
      </div>
      {editing && (
        <div className="exercise-routine-editor">
          {routines.map(r => (
            <div key={r.id} className="exercise-routine-edit-row">
              <input
                className="task-input"
                defaultValue={r.name}
                aria-label="Routine name"
                onBlur={e => {
                  const name = e.target.value.trim();
                  if (name && name !== r.name) onRename(r.id, name);
                  else e.target.value = r.name;
                }}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              />
              <button
                type="button"
                className="category-row-delete"
                title={`Delete ${r.name}`}
                aria-label={`Delete ${r.name}`}
                onClick={() => {
                  if (!window.confirm(`Delete the "${r.name}" routine? Activities using it will just show "Gym".`)) return;
                  if (value === r.id) onChange(undefined);
                  onDelete(r.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div className="exercise-routine-edit-row">
            <input
              className="task-input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
              placeholder="New routine, e.g. Arms"
              aria-label="New routine name"
            />
            <button type="button" className="btn btn--primary btn--sm" onClick={add} disabled={!newName.trim()}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Exercise-specific plan fields for the activity drawer, kept out of
// ActivityDrawer itself so it doesn't keep growing.
export function ExerciseDetailsFields({ value, onChange, gymRoutines, onAddRoutine, onRenameRoutine, onDeleteRoutine }: Props) {
  const [drafts, setDrafts] = useState<Drafts>(() => ({
    distance: value.distanceKm?.toString() ?? '',
    duration: durationInputValue(value.durationMins),
    elevation: value.elevationM?.toString() ?? '',
  }));

  const parsed = {
    distance: parseNonNegative(drafts.distance, 2),
    duration: parseDuration(drafts.duration),
    elevation: parseNonNegative(drafts.elevation, 0),
  };

  function emit(next: ExerciseDetails, nextDrafts: Drafts = drafts) {
    const p = {
      distance: parseNonNegative(nextDrafts.distance, 2),
      duration: parseDuration(nextDrafts.duration),
      elevation: parseNonNegative(nextDrafts.elevation, 0),
    };
    const valid = p.distance !== null && p.duration !== null && p.elevation !== null;
    onChange({
      ...next,
      distanceKm: p.distance ?? undefined,
      durationMins: p.duration ?? undefined,
      elevationM: p.elevation ?? undefined,
    }, valid);
  }

  function setDraft(key: keyof Drafts, raw: string) {
    const nextDrafts = { ...drafts, [key]: raw };
    setDrafts(nextDrafts);
    emit(value, nextDrafts);
  }

  function setType(type: ExerciseType) {
    emit({ ...value, type });
  }

  const type = value.type;
  const durationLabel = type === 'run' || type === 'ride' || type === 'hike' ? 'Target duration' : 'Duration';

  return (
    <div className="exercise-fields">
      <label className="form-label">Exercise type</label>
      <div className="exercise-type-picker" role="radiogroup" aria-label="Exercise type">
        {EXERCISE_TYPES.map(t => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            className={`exercise-type-pill${type === t ? ' exercise-type-pill--active' : ''}`}
            onClick={() => setType(t)}
          >
            <span aria-hidden="true">{EXERCISE_ICONS[t]}</span> {EXERCISE_LABELS[t]}
          </button>
        ))}
      </div>

      {type === 'other' && (
        <div className="exercise-field">
          <label className="form-label">Name</label>
          <input
            className="task-input"
            value={value.customName ?? ''}
            onChange={e => emit({ ...value, customName: e.target.value })}
            placeholder="e.g. Swim"
          />
        </div>
      )}

      {type === 'gym' && (
        <GymRoutinePicker
          routines={gymRoutines}
          value={value.gymRoutineId}
          onChange={id => emit({ ...value, gymRoutineId: id })}
          onAdd={onAddRoutine}
          onRename={onRenameRoutine}
          onDelete={onDeleteRoutine}
        />
      )}

      <div className="exercise-field-row">
        {hasDistance(type) && (
          <div className="exercise-field">
            <label className="form-label">Distance (km){type === 'other' ? ' — optional' : ''}</label>
            <input
              className={`task-input${parsed.distance === null ? ' task-input--invalid' : ''}`}
              inputMode="decimal"
              value={drafts.distance}
              onChange={e => setDraft('distance', e.target.value)}
              placeholder="e.g. 5"
            />
          </div>
        )}
        <div className="exercise-field">
          <label className="form-label">{durationLabel}</label>
          <input
            className={`task-input${parsed.duration === null ? ' task-input--invalid' : ''}`}
            value={drafts.duration}
            onChange={e => setDraft('duration', e.target.value)}
            placeholder="mins or h:mm"
          />
        </div>
      </div>

      {type === 'hike' && (
        <div className="exercise-field-row">
          <div className="exercise-field">
            <label className="form-label">Elevation (m)</label>
            <input
              className={`task-input${parsed.elevation === null ? ' task-input--invalid' : ''}`}
              inputMode="numeric"
              value={drafts.elevation}
              onChange={e => setDraft('elevation', e.target.value)}
              placeholder="optional"
            />
          </div>
          <div className="exercise-field">
            <label className="form-label">Location</label>
            <input
              className="task-input"
              value={value.location ?? ''}
              onChange={e => emit({ ...value, location: e.target.value })}
              placeholder="optional"
            />
          </div>
        </div>
      )}

      {(parsed.distance === null || parsed.duration === null || parsed.elevation === null) && (
        <p className="auth-error exercise-field-error">
          {parsed.duration === null ? 'Duration should be minutes (45) or h:mm (1:30). ' : ''}
          {parsed.distance === null || parsed.elevation === null ? 'Numbers can’t be negative.' : ''}
        </p>
      )}

      <div className="exercise-field">
        <label className="form-label">Notes</label>
        <textarea
          className="task-input exercise-notes"
          rows={2}
          value={value.notes ?? ''}
          onChange={e => emit({ ...value, notes: e.target.value })}
          placeholder="optional"
        />
      </div>
    </div>
  );
}
