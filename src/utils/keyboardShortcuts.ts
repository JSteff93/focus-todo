export type View = 'board' | 'list' | 'focus' | 'five-to-nine';

// Single source for both the key handler and the help overlay. Plain-letter
// "G then X" sequences (Gmail/GitHub style) instead of Ctrl/Cmd+letter,
// which the browser already owns (Ctrl+F find, Ctrl+B bold/bookmarks, …).
export const VIEW_SHORTCUTS: { key: string; view: View; label: string }[] = [
  { key: 'b', view: 'board', label: 'Board' },
  { key: 'l', view: 'list', label: 'List' },
  { key: 'f', view: 'focus', label: 'Focus' },
  { key: 'n', view: 'five-to-nine', label: 'Five to Nine' },
];

export const SHORTCUT_HELP_ROWS: { keys: string[]; label: string }[] = [
  ...VIEW_SHORTCUTS.map(s => ({ keys: ['G', s.key.toUpperCase()], label: `Go to ${s.label}` })),
  { keys: ['?'], label: 'Show keyboard shortcuts' },
  { keys: ['Ctrl/⌘', 'K'], label: 'Quick add a task' },
];

export const SEQUENCE_TIMEOUT_MS = 1000;

export function isTypingElsewhere(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

// Modals and drawers are rendered by many components, so rather than lifting
// all their open state into App, look for their backdrops. getClientRects
// skips ones hidden by CSS (e.g. the phone-only Focus sheet backdrop).
export function isOverlayOpen(): boolean {
  return [...document.querySelectorAll('.modal-backdrop, .drawer-overlay, .focus-sheet-backdrop')]
    .some(el => el.getClientRects().length > 0);
}

export interface ShortcutKey {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  // Focus is in a field, or a modal/drawer is open.
  blocked: boolean;
  time: number;
}

export type ShortcutAction = { type: 'view'; view: View } | { type: 'help' };

const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Meta', 'Alt', 'CapsLock']);

// Pure state machine so it can be unit-tested without a DOM. Returns the
// action a key triggers (null if none); `handled` says whether the key was
// consumed (G arming a sequence) so the caller can preventDefault.
export function createShortcutMatcher(timeoutMs = SEQUENCE_TIMEOUT_MS) {
  let armedAt: number | null = null;

  return function match(k: ShortcutKey): { action: ShortcutAction | null; handled: boolean } {
    const none = { action: null, handled: false };
    // Pressing Shift on the way to `?` mustn't cancel an armed G.
    if (MODIFIER_KEYS.has(k.key)) return none;
    if (k.blocked || k.ctrlKey || k.metaKey || k.altKey || k.repeat) {
      armedAt = null;
      return none;
    }
    // Lower-cased so Caps Lock / Shift don't matter for letters.
    const key = k.key.length === 1 ? k.key.toLowerCase() : k.key;
    const armed = armedAt !== null && k.time - armedAt <= timeoutMs;
    armedAt = null;

    if (armed) {
      const hit = VIEW_SHORTCUTS.find(s => s.key === key);
      if (hit) return { action: { type: 'view', view: hit.view }, handled: true };
    }
    if (key === 'g') {
      armedAt = k.time;
      return { action: null, handled: true };
    }
    if (key === '?') return { action: { type: 'help' }, handled: true };
    return none;
  };
}
