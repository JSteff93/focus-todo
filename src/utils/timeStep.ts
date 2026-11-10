export const TIME_STEP_MINS = 5;

// `HH:MM` for `d` rounded to the nearest TIME_STEP_MINS. Clamped to 23:55
// rather than wrapping to 00:00, which would silently mean the next day.
export function nearestStepTime(d: Date, stepMins = TIME_STEP_MINS): string {
  const lastSlot = 24 * 60 - stepMins;
  const mins = Math.min(Math.round((d.getHours() * 60 + d.getMinutes()) / stepMins) * stepMins, lastSlot);
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
