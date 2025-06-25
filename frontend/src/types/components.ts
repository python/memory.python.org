import { ReactNode } from 'react';
import {
  Binary,
  Environment,
  PythonVersionFilterOption,
  DiffTableRow,
} from '@/lib/types';
import { ChartDataPoint, TrendDataPoint } from './api';

// Base component props
export interface BaseComponentProps {
  className?: string;
  children?: ReactNode;
}

// Chart component props
export interface ChartProps extends BaseComponentProps {
  data: ChartDataPoint[];
  selectedBenchmarks: string[];
  selectedMetric: 'high_watermark_bytes' | 'total_allocated_bytes';
  colors: string[];
  height?: number;
  yAxisDomain?: [number, number];
}



// Data table component props
export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  formatter?: (value: any, row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T extends Record<string, any>>
  extends BaseComponentProps {
  data: T[];
  columns: DataTableColumn<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: (keyof T)[];
  filterable?: boolean;
  pageSize?: number;
}

// Page component props
export interface TrendsPageProps {
  initialBinaryId?: string;
  initialEnvironmentId?: string;
}

export interface DiffPageProps {
  initialBinaryId?: string;
  initialEnvironmentId?: string;
  initialCommitSha?: string;
}

export interface BuildComparisonPageProps {
  initialBinaries?: string[];
  initialEnvironmentId?: string;
}



// Metric and utility types
export type MetricKey = 'high_watermark_bytes' | 'total_allocated_bytes';
export type SortDirection = 'asc' | 'desc';

