import type { ExerciseActual, ExerciseDetails, ExerciseRoutine, ExerciseType } from '../types';

export const EXERCISE_TYPES: ExerciseType[] = ['run', 'ride', 'hike', 'gym', 'stretch', 'other'];

export const EXERCISE_LABELS: Record<ExerciseType, string> = {
  run: 'Run',
  ride: 'Ride',
  hike: 'Hike',
  gym: 'Gym',
  stretch: 'Stretching',
  other: 'Other',
};

export const EXERCISE_ICONS: Record<ExerciseType, string> = {
  run: '🏃',
  ride: '🚴',
  hike: '🥾',
  gym: '🏋️',
  stretch: '🧘',
  other: '✨',
};

// Types whose plan/log is mainly a distance (Other can optionally have one).
export function hasDistance(type: ExerciseType): boolean {
  return type === 'run' || type === 'ride' || type === 'hike' || type === 'other';
}

// "45" → 45, "1:30" → 90, "1h30" / "1h 30m" → 90, "90m" → 90. Blank → undefined;
// anything unparseable (or negative) → null so the form can flag it.
export function parseDuration(raw: string): number | undefined | null {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  let m = s.match(/^(\d+):([0-5]?\d)$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = s.match(/^(\d+(?:\.\d+)?)\s*h(?:\s*(\d{1,2})\s*m?)?$/);
  if (m) return Math.round(Number(m[1]) * 60) + (m[2] ? Number(m[2]) : 0);
  m = s.match(/^(\d+(?:\.\d+)?)\s*m?$/);
  if (m) return Math.round(Number(m[1]));
  return null;
}

// Non-negative number, rounded to `decimals`. Blank → undefined; invalid → null.
export function parseNonNegative(raw: string, decimals = 0): number | undefined | null {
  const s = raw.trim();
  if (!s) return undefined;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

// For pre-filling an input: 90 → "1:30", 45 → "45".
export function durationInputValue(mins: number | undefined): string {
  if (mins === undefined) return '';
  if (mins < 60) return String(mins);
  return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}`;
}

export function formatKm(km: number): string {
  return `${Number(km.toFixed(2))} km`;
}

// Run → min/km, ride → km/h; null where it doesn't make sense or can't be
// computed.
export function formatPace(type: ExerciseType, distanceKm?: number, durationMins?: number): string | null {
  if (!distanceKm || !durationMins || distanceKm <= 0 || durationMins <= 0) return null;
  if (type === 'run') {
    const secsPerKm = Math.round((durationMins * 60) / distanceKm);
    return `${Math.floor(secsPerKm / 60)}:${String(secsPerKm % 60).padStart(2, '0')} /km`;
  }
  if (type === 'ride') return `${(distanceKm / (durationMins / 60)).toFixed(1)} km/h`;
  return null;
}

function typeName(details: ExerciseDetails, routines: ExerciseRoutine[]): string {
  if (details.type === 'other') return details.customName?.trim() || EXERCISE_LABELS.other;
  if (details.type === 'gym') {
    const routine = routines.find(r => r.id === details.gymRoutineId);
    return routine ? `Gym · ${routine.name}` : 'Gym';
  }
  return EXERCISE_LABELS[details.type];
}

// One-line card summary: "Run · 5 km" for the plan, or what was logged once
// done ("Run · 6.2 km · 34m" — the card adds the ✓).
export function summarise(details: ExerciseDetails, routines: ExerciseRoutine[], actual?: ExerciseActual): string {
  const parts = [typeName(details, routines)];
  const distance = actual ? actual.distanceKm : details.distanceKm;
  const duration = actual ? actual.durationMins : details.durationMins;
  if (distance !== undefined && hasDistance(details.type)) parts.push(formatKm(distance));
  // The plan leads with distance when there is one; a log shows both.
  if (duration !== undefined && (actual || distance === undefined || !hasDistance(details.type))) {
    parts.push(formatDuration(duration));
  }
  return parts.join(' · ');
}

// Title used when the drawer's title is left blank.
export function generateTitle(details: ExerciseDetails, routines: ExerciseRoutine[]): string {
  return summarise(details, routines);
}

// Drops fields that don't apply to the chosen type, so switching Run → Gym
// doesn't save a stale distance.
export function cleanDetails(d: ExerciseDetails): ExerciseDetails {
  const out: ExerciseDetails = { type: d.type };
  if (d.type === 'other' && d.customName?.trim()) out.customName = d.customName.trim();
  if (hasDistance(d.type) && d.distanceKm !== undefined) out.distanceKm = d.distanceKm;
  if (d.durationMins !== undefined) out.durationMins = d.durationMins;
  if (d.type === 'hike') {
    if (d.elevationM !== undefined) out.elevationM = d.elevationM;
    if (d.location?.trim()) out.location = d.location.trim();
  }
  if (d.type === 'gym' && d.gymRoutineId) out.gymRoutineId = d.gymRoutineId;
  if (d.type === 'stretch' && d.stretchRoutineId) out.stretchRoutineId = d.stretchRoutineId;
  if (d.notes?.trim()) out.notes = d.notes.trim();
  return out;
}
