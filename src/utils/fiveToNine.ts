import type { ActivitySeries, ActivityOverride, ActivityCompletion, ActivityOccurrence, ActivityCategory, ActivitySlot } from '../types';

export const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  exercise: 'Exercise',
  chores: 'Chores',
  fun: 'Fun',
  social: 'Social',
};

export const SLOT_LABELS: Record<ActivitySlot, string> = {
  before: 'Before Work',
  work: 'Work',
  after: 'After Work',
};

// Saturday/Sunday have no work day to frame the slots around, so the same
// three slots read as times of day instead.
export const WEEKEND_SLOT_LABELS: Record<ActivitySlot, string> = {
  before: 'Morning',
  work: 'Afternoon',
  after: 'Night',
};

export function isWeekendDate(dateStr: string): boolean {
  const day = parseDate(dateStr).getDay();
  return day === 0 || day === 6;
}

export function getSlotLabels(weekend: boolean): Record<ActivitySlot, string> {
  return weekend ? WEEKEND_SLOT_LABELS : SLOT_LABELS;
}

function toDateInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getWeekStart(dateStr?: string): string {
  const date = dateStr ? parseDate(dateStr) : new Date();
  const day = date.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  return toDateInput(date);
}

export function getWeekDates(weekStart: string): string[] {
  const start = parseDate(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return toDateInput(d);
  });
}

export function addWeeks(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setDate(d.getDate() + n * 7);
  return toDateInput(d);
}

export function formatWeekRange(weekDates: string[]): string {
  const start = parseDate(weekDates[0]);
  const end = parseDate(weekDates[weekDates.length - 1]);
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = sameMonth
    ? end.toLocaleDateString('en-US', { day: 'numeric' })
    : end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const year = end.getFullYear();
  return `${startLabel} – ${endLabel}, ${year}`;
}

export function getWeekOccurrences(
  series: ActivitySeries[],
  overrides: ActivityOverride[],
  completions: ActivityCompletion[],
  weekDates: string[],
): ActivityOccurrence[] {
  const weekSet = new Set(weekDates);
  const overrideByKey = new Map(overrides.map(o => [`${o.seriesId}:${o.occurrenceDate}`, o]));
  const doneKeys = new Set(completions.map(c => `${c.seriesId}:${c.occurrenceDate}`));
  const results: ActivityOccurrence[] = [];

  for (const s of series) {
    if (!s.recurrence) {
      if (weekSet.has(s.anchorDate)) {
        results.push({
          seriesId: s.id, occurrenceDate: s.anchorDate, date: s.anchorDate,
          slot: s.slot, title: s.title, category: s.category, isRecurring: false, isMoved: false,
          isDone: doneKeys.has(`${s.id}:${s.anchorDate}`),
        });
      }
      continue;
    }
    for (const natural of weekDates) {
      if (natural < s.anchorDate) continue;
      const weekday = parseDate(natural).getDay();
      if (!s.recurrence.daysOfWeek.includes(weekday)) continue;
      const ov = overrideByKey.get(`${s.id}:${natural}`);
      results.push({
        seriesId: s.id, occurrenceDate: natural,
        date: ov?.movedDate ?? natural, slot: ov?.movedSlot ?? s.slot,
        title: s.title, category: s.category, isRecurring: true, isMoved: !!ov,
        isDone: doneKeys.has(`${s.id}:${natural}`),
      });
    }
  }
  return results;
}
