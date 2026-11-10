import { describe, it, expect } from 'vitest';
import { nearestStepTime, parseTimeInput, stepMins, timeToMins } from './timeStep';

const at = (h: number, m: number) => new Date(2026, 10, 11, h, m);

describe('nearestStepTime', () => {
  it('keeps times already on a 5-minute step', () => {
    expect(nearestStepTime(at(9, 0))).toBe('09:00');
    expect(nearestStepTime(at(14, 35))).toBe('14:35');
  });

  it('rounds to the nearest 5 minutes', () => {
    expect(nearestStepTime(at(9, 2))).toBe('09:00');
    expect(nearestStepTime(at(9, 3))).toBe('09:05');
    expect(nearestStepTime(at(9, 58))).toBe('10:00');
  });

  it('clamps to 23:55 instead of wrapping past midnight', () => {
    expect(nearestStepTime(at(23, 58))).toBe('23:55');
  });

  it('pads single-digit hours', () => {
    expect(nearestStepTime(at(0, 7))).toBe('00:05');
  });
});

describe('stepMins', () => {
  const t = (s: string) => timeToMins(s)!;

  it('moves by 5 minutes from an on-step time', () => {
    expect(stepMins(t('09:00'), 1)).toBe(t('09:05'));
    expect(stepMins(t('09:00'), -1)).toBe(t('08:55'));
  });

  it('snaps an off-step time to the next step in that direction', () => {
    expect(stepMins(t('09:03'), 1)).toBe(t('09:05'));
    expect(stepMins(t('09:03'), -1)).toBe(t('09:00'));
  });

  it('stops at the ends of the day', () => {
    expect(stepMins(t('23:55'), 1)).toBe(t('23:55'));
    expect(stepMins(t('00:00'), -1)).toBe(0);
  });
});

describe('parseTimeInput', () => {
  it.each([
    ['9:03', '09:03'],
    ['09:03', '09:03'],
    ['9.03', '09:03'],
    ['903', '09:03'],
    ['0903', '09:03'],
    ['1547', '15:47'],
    ['9', '09:00'],
    ['17', '17:00'],
    ['0:00', '00:00'],
    ['23:59', '23:59'],
    ['  9:03  ', '09:03'],
  ])('reads 24-hour %j as %s', (input, expected) => {
    expect(parseTimeInput(input)).toBe(expected);
  });

  it.each([
    ['9am', '09:00'],
    ['9AM', '09:00'],
    ['2:15pm', '14:15'],
    ['2:15 pm', '14:15'],
    ['2:15 p.m.', '14:15'],
    ['215p', '14:15'],
    ['12am', '00:00'],
    ['12:30am', '00:30'],
    ['12pm', '12:00'],
    ['12:45pm', '12:45'],
  ])('reads 12-hour %j as %s', (input, expected) => {
    expect(parseTimeInput(input)).toBe(expected);
  });

  it.each(['', 'abc', '24:00', '9:60', '13pm', '0am', '12345', '9:3', ':30', '9::30'])('rejects %j', input => {
    expect(parseTimeInput(input)).toBeNull();
  });
});
