export type PythonVersion = {
  major: number;
  minor: number;
  patch: number;
};

export type Binary = {
  id: string;
  name: string;
  flags: string[];
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
};

export type Environment = {
  id: string;
  name: string;
  description?: string;
};

export type Commit = {
  sha: string;
  timestamp: string;
  message: string;
  author: string;
  python_version: PythonVersion;
  prev_commit?: Commit;
};

export type CommitResponse = {
  sha: string;
  timestamp: string;
  message: string;
  author: string;
  python_major: number;
  python_minor: number;
  python_patch: number;
  run_count?: number;
};

export type PythonVersionFilterOption = {
  label: string;
  major: number;
  minor: number;
};

export type MetricKey = 'high_watermark_bytes' | 'total_allocated_bytes';

export const METRIC_OPTIONS = [
  { label: 'High Watermark', value: 'high_watermark_bytes' },
  { label: 'Total Allocated', value: 'total_allocated_bytes' },
] as const;

export type TopAllocatingFunction = {
  function: string;
  count: number;
  total_size: number;
};

export type BenchmarkResultJson = {
  high_watermark_bytes: number;
  allocation_histogram: [number, number][];
  total_allocated_bytes: number;
  top_allocating_functions: TopAllocatingFunction[];
  benchmark_name?: string;
};

export type DiffTableRow = {
  benchmark_name: string;
  metric_delta_percent?: number;
  prev_metric_value?: number;
  curr_metric_value: number;
  curr_commit_details: Commit;
  prev_commit_details?: Commit;
  metric_key: MetricKey;
  prev_python_version_str?: string;
  curr_python_version_str: string;
  curr_result_id: string;
  has_flamegraph: boolean;
};

export type AuthToken = {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  last_used?: string;
  is_active: boolean;
  token_preview: string;
};

export type TokenCreate = {
  name: string;
  description?: string;
};

export type TokenUpdate = {
  name?: string;
  description?: string;
};

export type TokenAnalytics = {
  total_tokens: number;
  active_tokens: number;
  inactive_tokens: number;
  used_tokens: number;
  never_used_tokens: number;
  recent_active_tokens: number;
};

export type EnrichedBenchmarkResult = {
  benchmark_name: string;
  binary: { id: string };
  environment: { id: string };
  commit: {
    sha: string;
    timestamp: string;
    message: string;
    python_version: { major: number; minor: number };
  };
  result_json: {
    high_watermark_bytes: number;
    total_allocated_bytes: number;
  };
  run_python_version: { major: number; minor: number; patch: number };
};

// Admin API Types
export type AdminUser = {
  id: number;
  github_username: string;
  added_by: string;
  added_at: string;
  is_active: boolean;
  notes?: string;
};

export type AdminUserCreate = {
  github_username: string;
  notes?: string;
};

export type AdminCurrentUser = {
  username: string;
  name?: string;
  email?: string;
  avatar_url?: string;
};

export type GitHubAuthResponse = {
  auth_url: string;
};

export type MemrayFailure = {
  id: number;
  commit_sha: string;
  binary_id: string;
  environment_id: string;
  binary_name: string;
  environment_name: string;
  error_message: string;
  failure_timestamp: string;
  commit_timestamp: string;
};

export type MemrayFailureSummary = {
  environment_name: string;
  failure_count: number;
  latest_failure: string;
};

export type MemrayStatus = {
  has_failures: boolean;
  failure_count: number;
  affected_environments: Array<{
    binary_id: string;
    environment_id: string;
    binary_name: string;
    environment_name: string;
    latest_failure: string;
    commit_sha: string;
    error_message: string;
    failure_timestamp: string;
  }>;
  message: string;
};

export type DatabaseTable = {
  tables: string[];
};

export type TableSchema = {
  columns: Array<{
    name: string;
    type: string;
    nullable: boolean;
    default?: any;
  }>;
};

export type QueryResult = {
  success: boolean;
  rows?: Array<Record<string, any>>;
  affected_rows?: number;
  error?: string;
  execution_time_ms?: number;
  column_names?: string[];
};

export type BenchmarkResult = {
  id: string;
  run_id: string;
  benchmark_name: string;
  high_watermark_bytes: number;
  total_allocated_bytes: number;
  allocation_histogram: [number, number][];
  top_allocating_functions: TopAllocatingFunction[];
  has_flamegraph: boolean;
};


export type BenchmarkResultUpdate = {
  high_watermark_bytes?: number;
  total_allocated_bytes?: number;
  allocation_histogram?: [number, number][];
  top_allocating_functions?: TopAllocatingFunction[];
};


export type CommitUpdate = {
  message?: string;
  author?: string;
  python_major?: number;
  python_minor?: number;
  python_patch?: number;
};

export type BinaryCreate = {
  id: string;
  name: string;
  flags: string[];
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
};

export type EnvironmentCreate = {
  id: string;
  name: string;
  description?: string;
};

// OpenAPI Response Types
export type AdminUserResponse = {
  id: number;
  github_username: string;
  added_by: string;
  added_at: string;
  is_active: boolean;
  notes?: string;
};

export type TokenResponse = {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  last_used?: string;
  is_active: boolean;
  token_preview: string;
};

export type BenchmarkResultResponse = {
  id: string;
  run_id: string;
  benchmark_name: string;
  high_watermark_bytes: number;
  total_allocated_bytes: number;
  allocation_histogram: [number, number][];
  top_allocating_functions: TopAllocatingFunction[];
  has_flamegraph: boolean;
};

export type QueryRequest = {
  query: string;
  read_only?: boolean;
};
