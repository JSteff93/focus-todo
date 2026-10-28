import { describe, it, expect } from 'vitest';
import { parseDuration, parseNonNegative, formatPace, summarise, cleanDetails, durationInputValue } from './exercise';
import type { ExerciseRoutine } from '../types';

const routines: ExerciseRoutine[] = [
  { id: 'r-push', kind: 'gym', name: 'Push', sortOrder: 0, items: [], notes: '' },
];

describe('parseDuration', () => {
  it.each([
    ['45', 45],
    ['90m', 90],
    ['1:30', 90],
    ['1h', 60],
    ['1h30', 90],
    ['1h 30m', 90],
    ['1.5h', 90],
  ])('%s → %i', (raw, mins) => expect(parseDuration(raw)).toBe(mins));

  it('blank is undefined, junk is null', () => {
    expect(parseDuration('  ')).toBeUndefined();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('-5')).toBeNull();
    expect(parseDuration('1:75')).toBeNull();
  });

  it('round-trips through the input value', () => {
    expect(parseDuration(durationInputValue(95)!)).toBe(95);
    expect(durationInputValue(45)).toBe('45');
  });
});

describe('parseNonNegative', () => {
  it('rounds to the given decimals and rejects negatives', () => {
    expect(parseNonNegative('6.237', 2)).toBe(6.24);
    expect(parseNonNegative('-1', 2)).toBeNull();
    expect(parseNonNegative('x')).toBeNull();
    expect(parseNonNegative('')).toBeUndefined();
  });
});

describe('formatPace', () => {
  it('run is min/km', () => expect(formatPace('run', 6.2, 34)).toBe('5:29 /km'));
  it('ride is km/h', () => expect(formatPace('ride', 30, 90)).toBe('20.0 km/h'));
  it('nothing for hikes or missing values', () => {
    expect(formatPace('hike', 10, 180)).toBeNull();
    expect(formatPace('run', undefined, 30)).toBeNull();
  });
});

describe('summarise', () => {
  it('plan shows distance', () => {
    expect(summarise({ type: 'run', distanceKm: 5, durationMins: 30 }, routines)).toBe('Run · 5 km');
  });
  it('log shows distance and duration', () => {
    expect(summarise({ type: 'run', distanceKm: 5 }, routines, { distanceKm: 6.2, durationMins: 34 })).toBe('Run · 6.2 km · 34m');
  });
  it('gym shows the routine name', () => {
    expect(summarise({ type: 'gym', gymRoutineId: 'r-push' }, routines)).toBe('Gym · Push');
    expect(summarise({ type: 'gym', gymRoutineId: 'gone' }, routines)).toBe('Gym');
  });
  it('other uses its custom name', () => {
    expect(summarise({ type: 'other', customName: 'Swim', durationMins: 45 }, routines)).toBe('Swim · 45m');
  });
});

describe('cleanDetails', () => {
  it('drops fields that do not apply to the type', () => {
    expect(cleanDetails({ type: 'gym', distanceKm: 5, elevationM: 100, gymRoutineId: 'r-push', notes: '  ' }))
      .toEqual({ type: 'gym', gymRoutineId: 'r-push' });
  });
});
