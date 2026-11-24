import { describe, it, expect } from 'vitest';
import { repairOrphanedTasks } from './orphanRepair';
import type { Task, Status, Project } from '../types';

const statuses: Status[] = [
  { id: 'todo', label: 'To-Do', color: '#000' },
  { id: 'doing', label: 'Doing', color: '#000' },
];
const projects: Project[] = [{ id: 'work', name: 'Work', color: '#000' }];

function task(id: string, statusId: string, projectId?: string): Task {
  return { id, title: id, description: '', statusId, createdAt: 0, projectId };
}

describe('repairOrphanedTasks', () => {
  it('leaves healthy tasks untouched and returns the same array', () => {
    const tasks = [task('a', 'todo', 'work'), task('b', 'doing')];
    const r = repairOrphanedTasks(tasks, statuses, projects, 'todo');
    expect(r.repairedCount).toBe(0);
    expect(r.tasks).toBe(tasks);
    expect(r.missingStatusIds).toEqual([]);
    expect(r.missingProjectIds).toEqual([]);
  });

  it('moves tasks with a missing status to To-Do', () => {
    const r = repairOrphanedTasks([task('a', 'gone'), task('b', 'gone'), task('c', 'doing')], statuses, projects, 'todo');
    expect(r.repairedCount).toBe(2);
    expect(r.tasks.map(t => t.statusId)).toEqual(['todo', 'todo', 'doing']);
    expect(r.missingStatusIds).toEqual(['gone']);
  });

  it('unassigns tasks with a missing project', () => {
    const r = repairOrphanedTasks([task('a', 'todo', 'old'), task('b', 'todo', 'work')], statuses, projects, 'todo');
    expect(r.repairedCount).toBe(1);
    expect(r.tasks[0].projectId).toBeUndefined();
    expect(r.tasks[1].projectId).toBe('work');
    expect(r.missingProjectIds).toEqual(['old']);
  });

  it('counts a task with both problems once', () => {
    const r = repairOrphanedTasks([task('a', 'gone', 'old')], statuses, projects, 'todo');
    expect(r.repairedCount).toBe(1);
    expect(r.tasks[0]).toMatchObject({ statusId: 'todo', projectId: undefined });
    expect(r.missingStatusIds).toEqual(['gone']);
    expect(r.missingProjectIds).toEqual(['old']);
  });
});
