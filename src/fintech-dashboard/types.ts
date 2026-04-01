export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export interface StatCardData {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface ProgressItem {
  label: string;
  progress: number;
  target: string;
  status: 'complete' | 'in-progress' | 'pending';
}

export interface DownloadItem {
  label: string;
  filename: string;
  size: string;
}
