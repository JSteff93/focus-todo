import { describe, it, expect } from 'vitest';
import { createShortcutMatcher, type ShortcutKey } from './keyboardShortcuts';

function key(k: string, time: number, extra: Partial<ShortcutKey> = {}): ShortcutKey {
  return { key: k, ctrlKey: false, metaKey: false, altKey: false, repeat: false, blocked: false, time, ...extra };
}

describe('createShortcutMatcher', () => {
  it('maps G then B/L/F/N to views', () => {
    const cases: [string, string][] = [['b', 'board'], ['l', 'list'], ['f', 'focus'], ['n', 'five-to-nine']];
    for (const [letter, view] of cases) {
      const m = createShortcutMatcher();
      expect(m(key('g', 0)).handled).toBe(true);
      expect(m(key(letter, 300)).action).toEqual({ type: 'view', view });
    }
  });

  it('ignores Caps Lock / Shift casing', () => {
    const m = createShortcutMatcher();
    m(key('G', 0));
    expect(m(key('B', 100)).action).toEqual({ type: 'view', view: 'board' });
  });

  it('does nothing for a letter without G first', () => {
    const m = createShortcutMatcher();
    expect(m(key('b', 0))).toEqual({ action: null, handled: false });
  });

  it('times out after about a second', () => {
    const m = createShortcutMatcher(1000);
    m(key('g', 0));
    expect(m(key('b', 1001)).action).toBeNull();
    m(key('g', 2000));
    expect(m(key('b', 3000)).action).toEqual({ type: 'view', view: 'board' });
  });

  it('cancels on an unknown second key', () => {
    const m = createShortcutMatcher();
    m(key('g', 0));
    expect(m(key('x', 100)).action).toBeNull();
    expect(m(key('b', 200)).action).toBeNull();
  });

  it('does not let a lone Shift cancel the sequence', () => {
    const m = createShortcutMatcher();
    m(key('g', 0));
    m(key('Shift', 50));
    expect(m(key('B', 100, {})).action).toEqual({ type: 'view', view: 'board' });
  });

  it('is ignored while typing or with a modal open', () => {
    const m = createShortcutMatcher();
    expect(m(key('g', 0, { blocked: true })).handled).toBe(false);
    expect(m(key('b', 100, { blocked: true })).action).toBeNull();
    // A G pressed outside a field, then B typed into one, must not switch.
    m(key('g', 200));
    expect(m(key('b', 300, { blocked: true })).action).toBeNull();
    expect(m(key('?', 400, { blocked: true })).action).toBeNull();
  });

  it('is ignored with Ctrl, Cmd or Alt held', () => {
    for (const mod of ['ctrlKey', 'metaKey', 'altKey'] as const) {
      const m = createShortcutMatcher();
      expect(m(key('g', 0, { [mod]: true })).handled).toBe(false);
      m(key('g', 100));
      expect(m(key('b', 200, { [mod]: true })).action).toBeNull();
      expect(m(key('f', 300, { [mod]: true })).action).toBeNull();
    }
  });

  it('ignores auto-repeat', () => {
    const m = createShortcutMatcher();
    m(key('g', 0));
    expect(m(key('b', 100, { repeat: true })).action).toBeNull();
  });

  it('opens help on ?', () => {
    const m = createShortcutMatcher();
    expect(m(key('?', 0)).action).toEqual({ type: 'help' });
  });
});
