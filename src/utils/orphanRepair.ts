import type { Task, Status, Project } from '../types';

export interface OrphanRepair {
  tasks: Task[];
  // Status/project ids that no longer exist but still had tasks pointing at
  // them — the DB fix is one bulk update per id.
  missingStatusIds: string[];
  missingProjectIds: string[];
  repairedCount: number;
}

// Deleting a column or project used to only update local state, leaving task
// rows in the DB that point at a status/project that's gone (invisible on the
// Board, or tagged with a phantom project). Send those to `todoStatusId` /
// unassigned so they reappear.
export function repairOrphanedTasks(tasks: Task[], statuses: Status[], projects: Project[], todoStatusId: string): OrphanRepair {
  const statusIds = new Set(statuses.map(s => s.id));
  const projectIds = new Set(projects.map(p => p.id));
  const missingStatusIds = new Set<string>();
  const missingProjectIds = new Set<string>();
  let repairedCount = 0;

  const repaired = tasks.map(t => {
    const badStatus = !statusIds.has(t.statusId);
    const badProject = t.projectId !== undefined && !projectIds.has(t.projectId);
    if (!badStatus && !badProject) return t;
    repairedCount++;
    const fixed = { ...t };
    if (badStatus) {
      missingStatusIds.add(t.statusId);
      fixed.statusId = todoStatusId;
    }
    if (badProject) {
      missingProjectIds.add(t.projectId!);
      fixed.projectId = undefined;
    }
    return fixed;
  });

  return {
    tasks: repairedCount ? repaired : tasks,
    missingStatusIds: [...missingStatusIds],
    missingProjectIds: [...missingProjectIds],
    repairedCount,
  };
}
