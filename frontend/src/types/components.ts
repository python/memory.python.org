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

export interface LazyChartProps {
  data: any[];
  selectedBenchmarks: string[];
  yAxisDomain: [number, number];
  colors: string[];
}

export interface ComparisonChartProps {
  data: any[];
  metric: string;
  colors: string[];
}

// Filter component props
export interface FilterComponentProps extends BaseComponentProps {
  selectedBinaryId: string | null;
  onBinaryChange: (binaryId: string) => void;
  binaries: Binary[];

  selectedEnvironmentId: string | null;
  onEnvironmentChange: (environmentId: string) => void;
  environments: Environment[];

  selectedPythonVersion: string | null;
  onPythonVersionChange: (version: string | null) => void;
  pythonVersions: PythonVersionFilterOption[];

  selectedBenchmarks: string[];
  onBenchmarkToggle: (benchmark: string) => void;
  onSelectAllBenchmarks: () => void;
  onClearAllBenchmarks: () => void;
  availableBenchmarks: string[];

  benchmarkSearch: string;
  onBenchmarkSearchChange: (search: string) => void;

  isLoadingBinaries?: boolean;
  isLoadingEnvironments?: boolean;
  isLoadingBenchmarks?: boolean;
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

// Loading and error component props
export interface LoadingSpinnerProps extends BaseComponentProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export interface ErrorBoundaryProps extends BaseComponentProps {
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: any) => void;
}

export interface ErrorDisplayProps extends BaseComponentProps {
  error: Error | string;
  retry?: () => void;
  title?: string;
}

// Form component props
export interface FormFieldProps extends BaseComponentProps {
  label: string;
  error?: string;
  required?: boolean;
  helpText?: string;
}

export interface SelectFieldProps extends FormFieldProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    description?: string;
  }>;
  placeholder?: string;
  disabled?: boolean;
}

export interface SearchFieldProps extends FormFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

// Metric and utility types
export type MetricKey = 'high_watermark_bytes' | 'total_allocated_bytes';
export type SortDirection = 'asc' | 'desc';
export type ChartType = 'line' | 'bar' | 'area';
export type ThemeMode = 'light' | 'dark' | 'system';

// Event handler types
export type BinaryChangeHandler = (binaryId: string) => void;
export type EnvironmentChangeHandler = (environmentId: string) => void;
export type BenchmarkToggleHandler = (benchmark: string) => void;
export type SearchChangeHandler = (search: string) => void;
export type SortChangeHandler = (
  field: string,
  direction: SortDirection
) => void;

// Configuration types
export interface ChartConfiguration {
  colors: string[];
  height: number;
  showGrid: boolean;
  showLegend: boolean;
  animationDuration: number;
}

export interface TableConfiguration {
  pageSize: number;
  sortable: boolean;
  searchable: boolean;
  exportable: boolean;
}

export interface AppConfiguration {
  apiBaseUrl: string;
  defaultPageSize: number;
  maxDataPoints: number;
  cacheTimeout: number;
  retryAttempts: number;
}
