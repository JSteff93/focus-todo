import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION_MS, dismissToast, getToasts, notify } from './toast';
import { isAuthError, saveFailedMessage } from './dbErrors';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  getToasts().forEach(t => dismissToast(t.id));
  vi.useRealTimers();
});

describe('notify', () => {
  it('shows a toast and auto-dismisses it', () => {
    notify({ message: 'Hello' });
    expect(getToasts().map(t => t.message)).toEqual(['Hello']);
    vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(getToasts()).toHaveLength(0);
  });

  it('keeps a toast with durationMs null until dismissed', () => {
    const id = notify({ message: 'Sticky', durationMs: null });
    vi.advanceTimersByTime(TOAST_DURATION_MS * 10);
    expect(getToasts()).toHaveLength(1);
    dismissToast(id);
    expect(getToasts()).toHaveLength(0);
  });

  it('merges toasts with the same key into one, counting them', () => {
    notify({ key: 'save', message: saveFailedMessage });
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(1000);
      notify({ key: 'save', message: saveFailedMessage });
    }
    expect(getToasts()).toHaveLength(1);
    expect(getToasts()[0].count).toBe(6);
    expect(getToasts()[0].message).toMatch(/^6 changes couldn't be saved\./);
  });

  it('restarts the timer on each merge', () => {
    notify({ key: 'save', message: 'x' });
    vi.advanceTimersByTime(TOAST_DURATION_MS - 100);
    notify({ key: 'save', message: 'x' });
    vi.advanceTimersByTime(TOAST_DURATION_MS - 100);
    expect(getToasts()).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(getToasts()).toHaveLength(0);
  });

  it('counts failures within sameEventMs as one change', () => {
    notify({ key: 'save', message: saveFailedMessage, sameEventMs: 250 });
    vi.advanceTimersByTime(10);
    notify({ key: 'save', message: saveFailedMessage, sameEventMs: 250 });
    expect(getToasts()[0].count).toBe(1);
    vi.advanceTimersByTime(300);
    notify({ key: 'save', message: saveFailedMessage, sameEventMs: 250 });
    expect(getToasts()[0].count).toBe(2);
  });

  it('stacks toasts with different keys', () => {
    notify({ key: 'a', message: 'A' });
    notify({ key: 'b', message: 'B' });
    notify({ message: 'C' });
    expect(getToasts().map(t => t.message)).toEqual(['A', 'B', 'C']);
  });

  it('starts a fresh toast once the merged one is gone', () => {
    notify({ key: 'save', message: saveFailedMessage });
    notify({ key: 'save', message: saveFailedMessage });
    vi.advanceTimersByTime(TOAST_DURATION_MS);
    notify({ key: 'save', message: saveFailedMessage });
    expect(getToasts()[0].count).toBe(1);
    expect(getToasts()[0].message).toMatch(/^Couldn't save your change\./);
  });
});

describe('isAuthError', () => {
  it('treats 401/403 responses as signed out', () => {
    expect(isAuthError({ message: 'x', code: '' }, 401)).toBe(true);
    expect(isAuthError({ message: 'x', code: '' }, 403)).toBe(true);
  });

  it('recognises JWT and RLS error codes and messages', () => {
    expect(isAuthError({ code: 'PGRST301', message: 'JWSError' })).toBe(true);
    expect(isAuthError({ code: 'PGRST303', message: 'JWT expired' })).toBe(true);
    expect(isAuthError({ code: '42501', message: 'new row violates row-level security policy' })).toBe(true);
    expect(isAuthError({ code: '', message: 'JWT expired' })).toBe(true);
  });

  it('does not treat offline or other failures as auth', () => {
    expect(isAuthError({ code: '', message: 'TypeError: Failed to fetch' }, 0)).toBe(false);
    expect(isAuthError({ code: '23505', message: 'duplicate key value' }, 409)).toBe(false);
    expect(isAuthError(null)).toBe(false);
  });
});
