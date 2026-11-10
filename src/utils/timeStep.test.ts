import { describe, it, expect } from 'vitest';
import { nearestStepTime } from './timeStep';

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
