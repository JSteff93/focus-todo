export interface Task {
  id: string;
  title: string;
  description: string;
  statusId: string;
  createdAt: number;
}

export interface Status {
  id: string;
  label: string;
  color: string;
}
