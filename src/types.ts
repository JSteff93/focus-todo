export interface Task {
  id: string;
  title: string;
  description: string;
  statusId: string;
  createdAt: number;
  dueDate?: string; // YYYY-MM-DD
}

export interface Status {
  id: string;
  label: string;
  color: string;
}
