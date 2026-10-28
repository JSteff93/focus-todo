import { describe, it, expect } from 'vitest';
import { parseQuickAdd, getProjectSuggestions } from './quickAdd';
import type { Project } from '../types';

const projects: Project[] = [
  { id: 'p-work', name: 'Work', color: '#3b82f6' },
  { id: 'p-side', name: 'Side', color: '#10b981' },
  { id: 'p-sidep', name: 'Side Project', color: '#f59e0b' },
];

// Wednesday 28 Oct 2026, mid-morning local time.
const WED = new Date(2026, 9, 28, 10, 30);
const SAT = new Date(2026, 9, 31, 10, 30);
const SUN = new Date(2026, 10, 1, 10, 30);

const parse = (text: string, now = WED) => parseQuickAdd(text, projects, now);

describe('parseQuickAdd', () => {
  it('plain text is just a title', () => {
    expect(parse('Buy milk')).toEqual({ title: 'Buy milk', description: '', errors: [], projectId: undefined, dueDate: undefined, estimatedFocusMins: undefined });
  });

  it('parses every token', () => {
    const r = parse('Send report /work #tomorrow @30 !attach figures');
    expect(r).toMatchObject({
      title: 'Send report',
      projectId: 'p-work',
      dueDate: '2026-10-29',
      estimatedFocusMins: 30,
      description: 'attach figures',
      errors: [],
    });
  });

  it('tokens can come in any order, and ! swallows the rest', () => {
    const r = parse('#today /Work Ship it @1h !notes with /slash #hash @at');
    expect(r).toMatchObject({ title: 'Ship it', projectId: 'p-work', dueDate: '2026-10-28', estimatedFocusMins: 60, description: 'notes with /slash #hash @at' });
  });

  it('prefers the longest multi-word project name', () => {
    expect(parse('Plan /Side Project launch').projectId).toBe('p-sidep');
    expect(parse('Plan /side launch').projectId).toBe('p-side');
  });

  it('unknown project is an error', () => {
    const r = parse('Do it /nonexistent');
    expect(r.errors).toEqual(["No project 'nonexistent'"]);
    expect(r.title).toBe('Do it');
  });

  it('a project name must end at a word boundary', () => {
    expect(parse('Fix /Workshop').errors).toEqual(["No project 'Workshop'"]);
  });

  describe('dates', () => {
    it.each([
      ['#today', '2026-10-28'],
      ['#tomorrow', '2026-10-29'],
      ['#wednesday', '2026-10-28'], // today counts as the next Wednesday
      ['#tue', '2026-11-03'],
      ['#thu', '2026-10-29'],
      ['#monday', '2026-11-02'],
      ['#next monday', '2026-11-02'],
      ['#next friday', '2026-11-06'], // next week's, not this Friday
      ['#next tue', '2026-11-03'],
      ['#end of week', '2026-10-30'],
      ['#eow', '2026-10-30'],
      ['#end of month', '2026-10-31'],
      ['#eom', '2026-10-31'],
      ['#in 3 days', '2026-10-31'],
      ['#3d', '2026-10-31'],
      ['#5/11', '2026-11-05'],
      ['#28/10', '2026-10-28'], // today hasn't passed yet
      ['#27/10', '2027-10-27'], // already passed this year
      ['#1/2/2027', '2027-02-01'],
    ])('%s → %s', (token, expected) => {
      const r = parse(`Task ${token}`);
      expect(r.errors).toEqual([]);
      expect(r.dueDate).toBe(expected);
      expect(r.title).toBe('Task');
    });

    it('end of week on a weekend is the coming Friday', () => {
      expect(parse('Task #end of week', SAT).dueDate).toBe('2026-11-06');
      expect(parse('Task #eow', SUN).dueDate).toBe('2026-11-06');
    });

    it('next monday on a Sunday is the following day (weeks run Mon–Sun)', () => {
      expect(parse('Task #next monday', SUN).dueDate).toBe('2026-11-02');
    });

    it('#28/10 after 28 Oct has passed rolls to next year', () => {
      expect(parse('Task #28/10', SAT).dueDate).toBe('2027-10-28');
    });

    it('unrecognised or impossible dates are errors', () => {
      expect(parse('Task #someday').errors).toEqual(["Unrecognised date 'someday'"]);
      expect(parse('Task #31/02').errors).toEqual(["Unrecognised date '31/02'"]);
    });
  });

  it('symbols mid-word stay in the title', () => {
    const r = parse('Email bob@company.com about and/or C#');
    expect(r).toMatchObject({ title: 'Email bob@company.com about and/or C#', errors: [] });
    expect(r.projectId).toBeUndefined();
    expect(r.dueDate).toBeUndefined();
    expect(r.estimatedFocusMins).toBeUndefined();
    expect(parse('Done!').title).toBe('Done!');
  });

  it.each([
    ['@45', 45],
    ['@90m', 90],
    ['@1h', 60],
    ['@1h30', 90],
    ['@1h30m', 90],
    ['@1.5h', 90],
  ])('focus time %s → %i mins', (token, mins) => {
    expect(parse(`Task ${token}`).estimatedFocusMins).toBe(mins);
  });

  it('@ without a number stays in the title', () => {
    const r = parse('Ping @abc');
    expect(r.title).toBe('Ping @abc');
    expect(r.estimatedFocusMins).toBeUndefined();
  });

  it('the last of a repeated token wins', () => {
    const r = parse('Task /Work #today /Side #tomorrow');
    expect(r).toMatchObject({ projectId: 'p-side', dueDate: '2026-10-29', errors: [] });
  });

  it('collapses spaces in the title', () => {
    expect(parse('  Buy   /Work  milk  ').title).toBe('Buy milk');
  });

  it('an empty title is an error', () => {
    expect(parse('#today').errors).toEqual(['Add a title']);
    expect(parse('   !just notes').errors).toEqual(['Add a title']);
  });
});

describe('getProjectSuggestions', () => {
  it('suggests projects matching the fragment under the caret', () => {
    const text = 'Fix bug /wo';
    expect(getProjectSuggestions(text, text.length, projects)).toEqual({ start: 8, end: 11, matches: [projects[0]] });
  });

  it('a bare / suggests everything', () => {
    expect(getProjectSuggestions('Fix /', 5, projects)?.matches).toHaveLength(3);
  });

  it('keeps matching across a space for multi-word names', () => {
    const text = 'Plan /side p';
    expect(getProjectSuggestions(text, text.length, projects)?.matches).toEqual([projects[2]]);
  });

  it('closes once a completed name is followed by a space', () => {
    const text = 'Plan /Work ';
    expect(getProjectSuggestions(text, text.length, projects)).toBeNull();
  });

  it('closes when nothing matches, mid-word, or inside notes', () => {
    expect(getProjectSuggestions('Fix /zzz', 8, projects)).toBeNull();
    expect(getProjectSuggestions('and/w', 5, projects)).toBeNull();
    expect(getProjectSuggestions('Fix !see /wo', 12, projects)).toBeNull();
    expect(getProjectSuggestions('Fix /Work #to', 13, projects)).toBeNull();
  });
});
