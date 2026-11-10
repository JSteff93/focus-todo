export const TIME_STEP_MINS = 5;
const DAY_MINS = 24 * 60;

export function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function timeToMins(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Minutes since midnight rounded to the nearest step. Clamped to the last
// slot (23:55) rather than wrapping to 00:00, which would mean the next day.
export function nearestStepMins(mins: number, stepMins = TIME_STEP_MINS): number {
  return Math.min(Math.round(mins / stepMins) * stepMins, DAY_MINS - stepMins);
}

// `HH:MM` for `d` rounded to the nearest step.
export function nearestStepTime(d: Date, stepMins = TIME_STEP_MINS): string {
  return minsToTime(nearestStepMins(d.getHours() * 60 + d.getMinutes(), stepMins));
}

// The next step strictly above (dir 1) or below (dir -1) `mins`, so an
// off-step 09:03 moves to 09:05 / 09:00 like a native time input. Stops at
// the ends of the day instead of wrapping.
export function stepMins(mins: number, dir: 1 | -1, stepMins = TIME_STEP_MINS): number {
  const next = dir === 1
    ? Math.floor(mins / stepMins) * stepMins + stepMins
    : Math.ceil(mins / stepMins) * stepMins - stepMins;
  return Math.max(0, Math.min(next, DAY_MINS - stepMins));
}

// Free-typed time → `HH:MM`, or null if it can't be read. Accepts the ways
// people actually type times: 9:03, 09:03, 9.03, 903, 0903, 9, 9am, 2:15pm,
// 2:15 p.m. Minutes are kept exactly — only the picker list is in 5s.
export function parseTimeInput(text: string): string | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, '').replace(/\./g, (_, i, str) =>
    // A dot inside a.m./p.m. is decoration; one between digits is a separator.
    /\d/.test(str[i - 1] ?? '') && /\d/.test(str[i + 1] ?? '') ? ':' : '');
  const match = /^(\d{1,2})(?::(\d{2}))?(am?|pm?)?$/.exec(s) ?? /^(\d{1,2})(\d{2})(am?|pm?)?$/.exec(s);
  if (!match) return null;
  let h = Number(match[1]);
  const m = match[2] === undefined ? 0 : Number(match[2]);
  const meridiem = match[3]?.[0];
  if (m > 59) return null;
  if (meridiem) {
    if (h < 1 || h > 12) return null;
    if (meridiem === 'a' && h === 12) h = 0;
    if (meridiem === 'p' && h !== 12) h += 12;
  } else if (h > 23) {
    return null;
  }
  return minsToTime(h * 60 + m);
}
