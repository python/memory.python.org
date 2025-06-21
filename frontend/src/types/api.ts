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

export interface ComparisonDataPoint {
  binary: string;
  points: TrendDataPoint[];
  geometricMean: number;
}

export interface BenchmarkComparisonData {
  benchmark: string;
  data: ComparisonDataPoint[];
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

// Hook Return Types
export interface UseApiResult<T> {
  data: T | undefined;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export interface UseBatchResult<T> {
  data: T[];
  errors: (Error | null)[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
