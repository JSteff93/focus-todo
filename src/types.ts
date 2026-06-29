export interface Recurrence {
  unit: 'day' | 'week' | 'month';
  interval: number;
  daysOfWeek?: number[]; // 0=Sun … 6=Sat, only used when unit='week'
}

export interface Task {
  id: string;
  title: string;
  description: string;
  statusId: string;
  createdAt: number;
  dueDate?: string; // YYYY-MM-DD
  recurrence?: Recurrence;
  assignee?: string;
  projectId?: string;
}

export interface Status {
  id: string;
  label: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  color: string;
}
