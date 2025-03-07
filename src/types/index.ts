export interface Automation {
  id: string;
  name: string;
  description: string;
  script: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
  output?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}