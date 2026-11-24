import { useSyncExternalStore } from 'react';

// A tiny module-level toast store. Module-level (not context) so plain
// modules like db.ts can raise a toast without being handed a callback.

export const TOAST_DURATION_MS = 6000;

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  key?: string;
  message: string;
  kind: 'error' | 'info';
  actions: ToastAction[];
  // How many notifies have merged into this toast.
  count: number;
}

export interface NotifyOptions {
  // The text, or a function of the merged count for toasts that merge.
  message: string | ((count: number) => string);
  kind?: Toast['kind'];
  actions?: ToastAction[];
  // A notify whose key matches a visible toast updates that toast (bumping
  // its count and restarting its timer) instead of stacking a new one.
  key?: string;
  // Merges arriving within this many ms of the last counted one don't bump
  // the count — one user action can fire several requests that all fail.
  sameEventMs?: number;
  // null keeps the toast until it's closed.
  durationMs?: number | null;
}

type Listener = () => void;

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<Listener>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
// Per toast: when its count was last bumped, and how to render its message.
const meta = new Map<number, { countedAt: number; options: NotifyOptions }>();

function emit() {
  listeners.forEach(l => l());
}

function render(options: NotifyOptions, count: number) {
  return typeof options.message === 'function' ? options.message(count) : options.message;
}

function startTimer(id: number, durationMs: number | null) {
  const existing = timers.get(id);
  if (existing) clearTimeout(existing);
  timers.delete(id);
  if (durationMs !== null) timers.set(id, setTimeout(() => dismissToast(id), durationMs));
}

export function notify(options: NotifyOptions): number {
  const now = Date.now();
  const durationMs = options.durationMs === undefined ? TOAST_DURATION_MS : options.durationMs;
  const existing = options.key ? toasts.find(t => t.key === options.key) : undefined;

  if (existing) {
    const m = meta.get(existing.id)!;
    const sameEvent = options.sameEventMs !== undefined && now - m.countedAt < options.sameEventMs;
    const count = sameEvent ? existing.count : existing.count + 1;
    if (!sameEvent) m.countedAt = now;
    m.options = options;
    toasts = toasts.map(t => t.id === existing.id
      ? { ...t, count, message: render(options, count), kind: options.kind ?? 'info', actions: options.actions ?? [] }
      : t);
    startTimer(existing.id, durationMs);
    emit();
    return existing.id;
  }

  const toast: Toast = {
    id: nextId++,
    key: options.key,
    message: render(options, 1),
    kind: options.kind ?? 'info',
    actions: options.actions ?? [],
    count: 1,
  };
  meta.set(toast.id, { countedAt: now, options });
  toasts = [...toasts, toast];
  startTimer(toast.id, durationMs);
  emit();
  return toast.id;
}

export function dismissToast(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  meta.delete(id);
  const next = toasts.filter(t => t.id !== id);
  if (next.length === toasts.length) return;
  toasts = next;
  emit();
}

export function getToasts(): Toast[] {
  return toasts;
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// The visible toasts, for the Toaster.
export function useToasts(): Toast[] {
  return useSyncExternalStore(subscribeToasts, getToasts);
}

// For components that want to raise one. Plain modules call notify directly.
export function useToast() {
  return { notify, dismiss: dismissToast };
}
