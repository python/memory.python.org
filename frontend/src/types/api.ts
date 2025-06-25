// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
  status: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface ErrorResponse {
  detail:
    | string
    | {
        message: string;
        details?: Record<string, any>;
        type?: string;
      };
  status_code: number;
}

// Query Types
export interface BaseQueryParams {
  skip?: number;
  limit?: number;
}

export interface BenchmarkTrendQuery {
  benchmark_name: string;
  binary_id: string;
  environment_id: string;
  limit: number;
}

export interface BatchBenchmarkQuery {
  queries: BenchmarkTrendQuery[];
}

// Additional API Parameter Types
export interface BenchmarkNamesQueryParams {
  environment_id: string;
  binary_id: string;
  python_major: number;
  python_minor: number;
}

export interface DiffQueryParams {
  commit_sha: string;
  binary_id: string;
  environment_id: string;
  metric_key: string;
}

export interface TrendQueryParams {
  benchmark_name: string;
  binary_id: string;
  environment_id: string;
  python_major: number;
  python_minor: number;
  limit?: number;
}

export interface UploadRequestData {
  commit_sha: string;
  binary_id: string;
  environment_id: string;
  python_version: {
    major: number;
    minor: number;
    patch: number;
  };
  benchmark_results: import('../lib/types').BenchmarkResultJson[];
}

// Chart Data Types
export interface ChartDataPoint {
  date: string;
  timestamp: string;
  sha: string;
  python_version: string;
  [benchmarkName: string]: string | number;
}

export interface TrendDataPoint {
  sha: string;
  timestamp: string;
  python_version: string;
  high_watermark_bytes: number;
  total_allocated_bytes: number;
}

// Binary/Environment API Response Types
export interface EnvironmentSummary {
  id: string;
  name: string;
  description?: string;
  run_count: number;
  commit_count: number;
}

export interface CommitSummary {
  sha: string;
  timestamp: string;
  message: string;
  author: string;
  python_version: { major: number; minor: number; patch: number };
  run_timestamp: string;
}

// Batch Trends Response Types
export interface BatchTrendsResponse {
  results: Record<string, TrendDataPoint[]>;
}

// Upload Response Types
export interface UploadResponse {
  success: boolean;
}

// Filter Types
export interface FilterState {
  selectedBinaryId: string | null;
  selectedEnvironmentId: string | null;
  selectedPythonVersion: string | null;
  selectedBenchmarks: string[];
  benchmarkSearch: string;
  maxDataPoints: number;
}

export interface DiffFilterState extends FilterState {
  filterBenchmarkName: string;
  filterThreshold: number;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

// UI State Types
export interface LoadingState {
  [key: string]: boolean;
}

export interface ErrorState {
  [key: string]: string | null;
}
