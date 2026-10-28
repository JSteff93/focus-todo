import type { Project } from '../types';

// Pure parsing for the header's quick-add bar — no React here, so it can be
// unit tested (see quickAdd.test.ts).
//
//   Send budget /Work #tomorrow @30 !use the Q3 template
//
// Symbols only count at the start of a word (start of input or after
// whitespace), so `and/or`, `bob@x.com`, `C#` and `Done!` stay in the title.
// If a symbol appears twice, the last one wins.

export interface QuickAddResult {
  title: string;
  projectId?: string;
  dueDate?: string; // YYYY-MM-DD, local time
  estimatedFocusMins?: number;
  description: string;
  // Anything that blocks creating the task (unknown project, unrecognised
  // date, empty title) — shown on the bar instead of being silently dropped.
  errors: string[];
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};
const WEEKDAY_PATTERN = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

// Built from local date parts — toISOString() would be UTC, which in
// Australia shifts the date back a day for most of the morning.
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

// Next occurrence of a weekday, counting today — `#monday` on a Monday is today.
function nextWeekday(today: Date, wd: number): Date {
  return addDays(today, (wd - today.getDay() + 7) % 7);
}

// That weekday in the following Mon–Sun week, even if one comes sooner this
// week — on a Tuesday, `#next monday` is 6 days away and `#next friday` 10.
function weekdayNextWeek(today: Date, wd: number): Date {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const nextMonday = addDays(today, 7 - daysSinceMonday);
  return addDays(nextMonday, (wd + 6) % 7);
}

// This work week's Friday; on a weekend, the coming Friday.
function endOfWeek(today: Date): Date {
  return addDays(today, (5 - today.getDay() + 7) % 7);
}

// dd/mm or dd/mm/yyyy (Australian order). A dd/mm already gone this year
// rolls to next year.
function explicitDate(today: Date, dd: number, mm: number, yyyy?: number): Date | null {
  const year = yyyy ?? today.getFullYear();
  const d = new Date(year, mm - 1, dd);
  if (d.getFullYear() !== year || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  if (yyyy === undefined && d < today) return new Date(year + 1, mm - 1, dd);
  return d;
}

// Matches the longest known date phrase at the start of `s` (the text after
// `#`). Returns its length so the caller can consume exactly that much, or
// null if nothing is recognised.
function matchDatePhrase(s: string, today: Date): { length: number; date: Date | null } | null {
  const lower = s.toLowerCase();
  const end = '(?=\\s|$)';
  const rules: [RegExp, (m: RegExpMatchArray) => Date | null][] = [
    [new RegExp(`^next\\s+(${WEEKDAY_PATTERN})${end}`), m => weekdayNextWeek(today, WEEKDAYS[m[1]])],
    [new RegExp(`^end\\s+of\\s+(?:the\\s+)?week${end}`), () => endOfWeek(today)],
    [new RegExp(`^end\\s+of\\s+(?:the\\s+)?month${end}`), () => new Date(today.getFullYear(), today.getMonth() + 1, 0)],
    [new RegExp(`^in\\s+(\\d{1,3})\\s+days?${end}`), m => addDays(today, Number(m[1]))],
    [new RegExp(`^(\\d{1,2})/(\\d{1,2})/(\\d{4})${end}`), m => explicitDate(today, Number(m[1]), Number(m[2]), Number(m[3]))],
    [new RegExp(`^(\\d{1,2})/(\\d{1,2})${end}`), m => explicitDate(today, Number(m[1]), Number(m[2]))],
    [new RegExp(`^(\\d{1,3})d${end}`), m => addDays(today, Number(m[1]))],
    [new RegExp(`^(?:today|tod)${end}`), () => today],
    [new RegExp(`^(?:tomorrow|tmr|tmrw)${end}`), () => addDays(today, 1)],
    [new RegExp(`^(?:eow)${end}`), () => endOfWeek(today)],
    [new RegExp(`^(?:eom)${end}`), () => new Date(today.getFullYear(), today.getMonth() + 1, 0)],
    [new RegExp(`^(${WEEKDAY_PATTERN})${end}`), m => nextWeekday(today, WEEKDAYS[m[1]])],
  ];
  for (const [re, toDate] of rules) {
    const m = lower.match(re);
    if (m) return { length: m[0].length, date: toDate(m) };
  }
  return null;
}

// @45, @90m, @1h, @1h30, @1h30m, @1.5h — minutes, rounded.
function matchFocusTime(s: string): { length: number; mins: number } | null {
  const m = s.toLowerCase().match(/^(\d+(?:\.\d+)?)(?:(h)(?:(\d{1,2})m?)?|m)?(?=\s|$)/);
  if (!m) return null;
  const n = Number(m[1]);
  const mins = m[2] ? Math.round(n * 60) + (m[3] ? Number(m[3]) : 0) : Math.round(n);
  return mins > 0 ? { length: m[0].length, mins } : null;
}

// Longest project name the text after `/` starts with, case-insensitively, so
// multi-word names like `/Side Project` beat a shorter `/Side`.
function matchProject(s: string, projects: Project[]): Project | null {
  const lower = s.toLowerCase();
  let best: Project | null = null;
  for (const p of projects) {
    const name = p.name.toLowerCase();
    if (!name || !lower.startsWith(name)) continue;
    const next = lower.charAt(name.length);
    if (next && !/\s/.test(next)) continue;
    if (!best || name.length > best.name.length) best = p;
  }
  return best;
}

function isWordStart(text: string, i: number): boolean {
  return i === 0 || /\s/.test(text[i - 1]);
}

function wordAt(s: string): string {
  return s.match(/^\S*/)![0];
}

export function parseQuickAdd(text: string, projects: Project[], now: Date): QuickAddResult {
  const today = startOfDay(now);
  const errors: string[] = [];

  // `!` takes everything after it, so split that off first.
  let body = text;
  let description = '';
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '!' && isWordStart(text, i)) {
      body = text.slice(0, i);
      description = text.slice(i + 1).trim();
      break;
    }
  }

  let projectId: string | undefined;
  let dueDate: string | undefined;
  let estimatedFocusMins: number | undefined;
  const titleParts: string[] = [];

  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    const rest = body.slice(i + 1);
    if (isWordStart(body, i) && ch === '/') {
      const project = matchProject(rest, projects);
      if (project) {
        projectId = project.id;
        i += 1 + project.name.length;
      } else {
        const word = wordAt(rest);
        errors.push(word ? `No project '${word}'` : 'Type a project name after /');
        i += 1 + word.length;
      }
      continue;
    }
    if (isWordStart(body, i) && ch === '#') {
      const match = matchDatePhrase(rest, today);
      if (match?.date) {
        dueDate = toLocalDateString(match.date);
        i += 1 + match.length;
      } else {
        const word = match ? rest.slice(0, match.length) : wordAt(rest);
        errors.push(word ? `Unrecognised date '${word}'` : 'Type a date after #');
        i += 1 + word.length;
      }
      continue;
    }
    if (isWordStart(body, i) && ch === '@') {
      const match = matchFocusTime(rest);
      if (match) {
        estimatedFocusMins = match.mins;
        i += 1 + match.length;
        continue;
      }
      // Not a duration (e.g. `@abc`) — stays part of the title.
    }
    titleParts.push(ch);
    i++;
  }

  const title = titleParts.join('').replace(/\s+/g, ' ').trim();
  if (!title) errors.push('Add a title');

  return { title, projectId, dueDate, estimatedFocusMins, description, errors };
}

export interface ProjectSuggestionContext {
  // Range of the `/fragment` being typed (start is the `/`), to replace on
  // completion.
  start: number;
  end: number;
  matches: Project[];
}

// The `/project` fragment the caret is currently in, if any, plus the
// projects whose name starts with it — drives the suggestion dropdown.
export function getProjectSuggestions(text: string, caret: number, projects: Project[]): ProjectSuggestionContext | null {
  const before = text.slice(0, caret);
  // Nothing after `!` is ever a token.
  for (let i = 0; i < before.length; i++) {
    if (before[i] === '!' && isWordStart(before, i)) return null;
  }
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] !== '/' || !isWordStart(before, i)) continue;
    const query = before.slice(i + 1).toLowerCase();
    // Project names can contain spaces, but not another token's symbol.
    if (/\s[/#@]/.test(query)) return null;
    // A completed name followed by a space closes the dropdown, even if a
    // longer name (e.g. "Work Admin" after "Work ") would still match.
    if (query.endsWith(' ') && projects.some(p => p.name.toLowerCase() === query.trimEnd())) return null;
    const matches = projects.filter(p => p.name.toLowerCase().startsWith(query));
    if (matches.length === 0) return null;
    return { start: i, end: caret, matches };
  }
  return null;
}
