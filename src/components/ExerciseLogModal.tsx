import { useState } from 'react';
import type { ExerciseActual, ExerciseDetails, ExerciseRoutine } from '../types';
import { durationInputValue, formatPace, hasDistance, parseDuration, parseNonNegative, summarise } from '../utils/exercise';

interface Props {
  title: string;
  details: ExerciseDetails;
  routines: ExerciseRoutine[];
  // An earlier log for this occurrence, if any — otherwise pre-filled from
  // the plan.
  actual?: ExerciseActual;
  onSave: (actual: ExerciseActual | undefined) => void;
  onClose: () => void;
}

// The optional "Log it" prompt shown after ticking an exercise occurrence
// done (and reopened from the card's ✎ button to edit it later).
export function ExerciseLogModal({ title, details, routines, actual, onSave, onClose }: Props) {
  const base = actual ?? { distanceKm: details.distanceKm, durationMins: details.durationMins };
  const [distance, setDistance] = useState(base.distanceKm?.toString() ?? '');
  const [duration, setDuration] = useState(durationInputValue(base.durationMins));
  const [notes, setNotes] = useState(actual?.notes ?? '');

  const showDistance = hasDistance(details.type);
  const parsedDistance = showDistance ? parseNonNegative(distance, 2) : undefined;
  const parsedDuration = parseDuration(duration);
  const invalid = parsedDistance === null || parsedDuration === null;
  const pace = invalid ? null : formatPace(details.type, parsedDistance, parsedDuration);

  function save() {
    if (invalid) return;
    const next: ExerciseActual = {};
    if (parsedDistance !== undefined) next.distanceKm = parsedDistance;
    if (parsedDuration !== undefined) next.durationMins = parsedDuration;
    if (notes.trim()) next.notes = notes.trim();
    onSave(Object.keys(next).length > 0 ? next : undefined);
    onClose();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal exercise-log"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        <h2 className="modal-title">Log it <span className="exercise-log-sub">· {title}</span></h2>
        <p className="exercise-log-plan">Plan: {summarise(details, routines)}</p>

        <div className="exercise-field-row">
          {showDistance && (
            <div className="exercise-field">
              <label className="form-label">Distance (km)</label>
              <input
                className={`task-input${parsedDistance === null ? ' task-input--invalid' : ''}`}
                inputMode="decimal"
                value={distance}
                onChange={e => setDistance(e.target.value)}
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') save(); }}
              />
            </div>
          )}
          <div className="exercise-field">
            <label className="form-label">Duration</label>
            <input
              className={`task-input${parsedDuration === null ? ' task-input--invalid' : ''}`}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="mins or h:mm"
              autoFocus={!showDistance}
              onKeyDown={e => { if (e.key === 'Enter') save(); }}
            />
          </div>
        </div>
        {pace && <p className="exercise-log-pace">Pace: {pace}</p>}
        {invalid && <p className="auth-error exercise-field-error">Check the distance (no negatives) and duration (45 or 1:30).</p>}

        <div className="exercise-field">
          <label className="form-label">Notes</label>
          <textarea className="task-input exercise-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it go?" />
        </div>

        <div className="modal-actions">
          <button className="btn btn--primary" onClick={save} disabled={invalid}>Save log</button>
          <button className="btn btn--ghost" onClick={onClose}>{actual ? 'Cancel' : 'Skip'}</button>
          {actual && (
            <button className="btn btn--ghost" style={{ color: '#ef4444' }} onClick={() => { onSave(undefined); onClose(); }}>
              Remove log
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
