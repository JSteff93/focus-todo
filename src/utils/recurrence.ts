import type { Recurrence } from '../types';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_FULL  = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number) {
  if (n === 1) return 'every';
  if (n === 2) return 'every 2nd';
  if (n === 3) return 'every 3rd';
  return `every ${n}th`;
}

export function describeRecurrence(rec: Recurrence): string {
  const { unit, interval, daysOfWeek = [] } = rec;

  if (unit === 'day') {
    return interval === 1 ? 'Every day' : `Every ${interval} days`;
  }

  if (unit === 'month') {
    return interval === 1 ? 'Every month' : `Every ${interval} months`;
  }

  // weekly
  const sorted = [...daysOfWeek].sort((a, b) => a - b);

  if (sorted.length === 0) {
    return interval === 1 ? 'Every week' : `Every ${interval} weeks`;
  }

  if (sorted.length === 1) {
    return interval === 1
      ? `Every ${DAY_FULL[sorted[0]]}`
      : `${ordinal(interval).replace('every', 'Every')} ${DAY_FULL[sorted[0]]}`;
  }

  // Multiple days — interval is treated as weekly cycle
  const labels = sorted.map(d => DAY_SHORT[d]);
  const last = labels.pop()!;
  const prefix = interval === 1 ? 'Every' : `Every ${interval}nd`;
  return `${prefix} ${labels.join(', ')} & ${last}`;
}

export function getNextDueDate(currentDueDate: string, rec: Recurrence): string {
  const [y, m, d] = currentDueDate.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (rec.unit === 'day') {
    date.setDate(date.getDate() + rec.interval);
  } else if (rec.unit === 'month') {
    date.setMonth(date.getMonth() + rec.interval);
  } else {
    const sorted = [...(rec.daysOfWeek ?? [])].sort((a, b) => a - b);

    if (sorted.length === 0) {
      date.setDate(date.getDate() + rec.interval * 7);
    } else if (sorted.length > 1 && rec.interval === 1) {
      // Multi-day weekly: advance to next day in the same week, wrapping to next cycle
      const cur = date.getDay();
      const next = sorted.find(d => d > cur);
      if (next !== undefined) {
        date.setDate(date.getDate() + (next - cur));
      } else {
        const toNextSunday = 7 - cur;
        date.setDate(date.getDate() + toNextSunday + sorted[0]);
      }
    } else {
      // Single day or interval > 1: jump N full weeks to the target day
      const cur = date.getDay();
      const target = sorted[0] ?? cur;
      const toNextSunday = 7 - cur;
      date.setDate(date.getDate() + toNextSunday + target + (rec.interval - 1) * 7);
    }
  }

  const yr = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dy = String(date.getDate()).padStart(2, '0');
  return `${yr}-${mo}-${dy}`;
}
