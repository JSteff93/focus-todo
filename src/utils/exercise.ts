import type { ExerciseActual, ExerciseDetails, ExerciseRoutine, ExerciseType, RoutineItem } from '../types';

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
  if (details.type === 'stretch' && details.stretchRoutineId) {
    const routine = routines.find(r => r.id === details.stretchRoutineId);
    return routine ? `Stretching · ${routine.name}` : 'Stretching · No routine';
  }
  return EXERCISE_LABELS[details.type];
}

// "Hamstring stretch, 3 × 10 (30s hold, each side)"
export function formatStretch(item: RoutineItem): string {
  let out = item.name;
  if (item.sets && item.reps) out += `, ${item.sets} × ${item.reps}`;
  else if (item.sets) out += `, ${item.sets} ${item.sets === 1 ? 'set' : 'sets'}`;
  else if (item.reps) out += `, ${item.reps} ${item.reps === 1 ? 'rep' : 'reps'}`;
  const extras: string[] = [];
  if (item.holdSecs) extras.push(`${item.holdSecs}s hold`);
  if (item.side === 'each') extras.push('each side');
  else if (item.side === 'both') extras.push('both sides');
  return extras.length > 0 ? `${out} (${extras.join(', ')})` : out;
}

// Ticked-off progress for a stretch occurrence, counting only items still in
// the routine (an item deleted from the template no longer counts).
export function stretchProgress(routine: ExerciseRoutine | undefined, actual?: ExerciseActual): { done: number; total: number } {
  if (!routine) return { done: 0, total: 0 };
  const checked = new Set(actual?.checkedItemIds ?? []);
  return { done: routine.items.filter(i => checked.has(i.id)).length, total: routine.items.length };
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

// Generated stretch titles used to end in a stretch count ("… · 6
// stretches"); the card no longer shows it, so strip it from older titles too.
export function displayTitle(title: string, details?: ExerciseDetails): string {
  return details?.type === 'stretch' ? title.replace(/\s*·\s*\d+\s+stretch(?:es)?$/, '') : title;
}

// The card's second line, minus anything the title already says — a title
// generated from the plan would otherwise be repeated underneath it. When
// the summary extends the title (a log adding "· 34m"), only the extra part
// is kept.
export function summaryBeyondTitle(summary: string, title: string): string {
  if (summary.startsWith(title)) return summary.slice(title.length).replace(/^\s*·\s*/, '');
  if (title.startsWith(summary)) return '';
  return summary;
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
