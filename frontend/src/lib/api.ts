import type {
  Binary,
  Commit,
  CommitResponse,
  DiffTableRow,
  Environment,
  PythonVersionFilterOption,
  BenchmarkResultJson,
  AuthToken,
  TokenCreate,
  TokenUpdate,
  TokenAnalytics,
  AdminUser,
  AdminUserCreate,
  AdminCurrentUser,
  GitHubAuthResponse,
  MemrayFailure,
  MemrayFailureSummary,
  MemrayStatus,
  DatabaseTable,
  TableSchema,
  QueryResult,
  BenchmarkResult,
  BenchmarkResultUpdate,
  CommitUpdate,
  BinaryCreate,
  EnvironmentCreate,
  AdminUserResponse,
  TokenResponse,
  BenchmarkResultResponse,
  QueryRequest,
} from './types';
import type {
  ErrorResponse,
  TrendDataPoint,
  EnvironmentSummary,
  CommitSummary,
  BatchTrendsResponse,
  UploadResponse,
  TrendRequest,
  TrendQueryParams,
  BatchTrendRequest,
  BenchmarkNamesQueryParams,
  DiffQueryParams,
  UploadRequestData,
} from '../types/api';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public response?: Response
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Network error handler
class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      credentials: 'include', // Include cookies for authentication
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorMessage = `API error: ${response.statusText}`;

      // Try to get more detailed error message from response
      try {
        const errorData: ErrorResponse = await response.json();
        if (errorData.detail) {
          errorMessage =
            typeof errorData.detail === 'string'
              ? errorData.detail
              : errorData.detail.message || errorMessage;
        }
      } catch {
        // If response isn't JSON, fall back to status text
      }

      throw new ApiError(response.status, errorMessage, response);
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      throw new NetworkError(
        'Network connection failed. Please check your internet connection.'
      );
    }

    // Handle timeout
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new NetworkError('Request timed out. Please try again.');
    }

    // Re-throw other errors
    throw error;
  }
}


// Helper for creating typed query parameters
function createQueryParams(params: Record<string, any>): URLSearchParams {
  const queryParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });
  return queryParams;
}

export const api = {
  // Commit endpoints
  getCommits: (skip: number = 0, limit: number = 100) =>
    fetchApi<Commit[]>(`/commits?skip=${skip}&limit=${limit}`),
  getCommit: (sha: string) => fetchApi<Commit>(`/commits/${sha}`),

  // Binary endpoints
  getBinaries: () => fetchApi<Binary[]>(`/binaries?_t=${Date.now()}`),
  getBinary: (id: string) => fetchApi<Binary>(`/binaries/${id}`),
  getEnvironmentsForBinary: (binaryId: string) =>
    fetchApi<EnvironmentSummary[]>(`/binaries/${binaryId}/environments`),
  getCommitsForBinaryAndEnvironment: (
    binaryId: string,
    environmentId: string
  ) =>
    fetchApi<CommitSummary[]>(
      `/binaries/${binaryId}/environments/${environmentId}/commits`
    ),

  // Environment endpoints
  getEnvironments: () => fetchApi<Environment[]>('/environments'),
  getEnvironment: (id: string) => fetchApi<Environment>(`/environments/${id}`),

  // Python version endpoints
  getPythonVersions: () =>
    fetchApi<PythonVersionFilterOption[]>('/python-versions'),

  // Benchmark endpoints
  getAllBenchmarks: () => fetchApi<string[]>('/benchmarks'),
  getBenchmarkNames: (params: BenchmarkNamesQueryParams) => {
    const queryParams = createQueryParams(params);
    return fetchApi<string[]>(`/benchmark-names?${queryParams.toString()}`);
  },

  // Diff endpoint
  getDiffTable: (params: DiffQueryParams) => {
    const queryParams = createQueryParams(params);
    return fetchApi<DiffTableRow[]>(`/diff?${queryParams.toString()}`);
  },


  // Optimized trends endpoint
  getBenchmarkTrends: (params: TrendRequest) => {
    const queryParams = createQueryParams(params);
    return fetchApi<TrendDataPoint[]>(`/trends?${queryParams.toString()}`);
  },

  // Batch trends endpoint
  getBatchBenchmarkTrends: (trendQueries: TrendRequest[]) => {
    const requestBody: BatchTrendRequest = {
      trend_queries: trendQueries.map((query) => ({
        ...query,
        limit: query.limit || 50,
      })),
    };
    return fetchApi<BatchTrendsResponse>('/trends-batch', {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  // Flamegraph endpoint
  getFlamegraph: (id: string) =>
    fetchApi<{ flamegraph_html: string }>(`/flamegraph/${id}`),

  // Token management endpoints
  getTokens: () =>
    fetchApi<TokenResponse[]>('/admin/tokens', {
      credentials: 'include',
    }),

  createToken: (tokenData: TokenCreate) =>
    fetchApi<{ success: boolean; token: string; token_info: TokenResponse }>(
      '/admin/tokens',
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(tokenData),
      }
    ),

  updateToken: (tokenId: number, tokenUpdate: TokenUpdate) =>
    fetchApi<TokenResponse>(`/admin/tokens/${tokenId}`, {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify(tokenUpdate),
    }),

  deactivateToken: (tokenId: number) =>
    fetchApi<{ success: boolean }>(`/admin/tokens/${tokenId}/deactivate`, {
      method: 'POST',
      credentials: 'include',
    }),

  activateToken: (tokenId: number) =>
    fetchApi<{ success: boolean }>(`/admin/tokens/${tokenId}/activate`, {
      method: 'POST',
      credentials: 'include',
    }),

  deleteToken: (tokenId: number) =>
    fetchApi<{ success: boolean }>(`/admin/tokens/${tokenId}`, {
      method: 'DELETE',
      credentials: 'include',
    }),

  getTokenAnalytics: () =>
    fetchApi<TokenAnalytics>('/admin/tokens/analytics', {
      credentials: 'include',
    }),

  // Admin user endpoints
  getAdminUsers: () =>
    fetchApi<AdminUserResponse[]>('/admin/users', {
      credentials: 'include',
    }),

  // Public endpoints
  getMaintainers: () =>
    fetchApi<
      Array<{
        id: number;
        github_username: string;
        added_by: string;
        added_at: string;
        is_active: boolean;
      }>
    >('/maintainers'),

  // Admin Authentication endpoints
  getAdminMe: () =>
    fetchApi<AdminCurrentUser>('/admin/me', {
      credentials: 'include',
    }),

  getGitHubAuthUrl: () =>
    fetchApi<GitHubAuthResponse>('/admin/auth/github'),

  adminLogout: () =>
    fetchApi<{ success: boolean }>('/admin/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }),

  // Query Console endpoints
  getDatabaseTables: () =>
    fetchApi<DatabaseTable>('/admin/query/tables', {
      credentials: 'include',
    }),

  getTableSchema: (tableName: string) =>
    fetchApi<TableSchema>(`/admin/query/schema/${tableName}`, {
      credentials: 'include',
    }),

  executeQuery: (query: string, readOnly: boolean) => {
    const requestBody: QueryRequest = {
      query: query.trim(),
      read_only: readOnly,
    };
    return fetchApi<QueryResult>('/admin/query', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(requestBody),
    });
  },

  // Memray endpoints
  getMemrayFailures: () =>
    fetchApi<MemrayFailure[]>('/admin/memray-failures', {
      credentials: 'include',
    }),

  getMemrayFailuresSummary: () =>
    fetchApi<MemrayFailureSummary[]>('/admin/memray-failures/summary', {
      credentials: 'include',
    }),

  deleteMemrayFailure: (id: number) =>
    fetchApi<{ success: boolean }>(`/admin/memray-failures/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }),

  getMemrayStatus: () =>
    fetchApi<MemrayStatus>('/memray-status'),

  // Admin Benchmark Results endpoints
  getAdminBenchmarkResults: (params: {
    run_id?: string;
    benchmark_name?: string;
    min_memory?: number;
    max_memory?: number;
    skip?: number;
    limit?: number;
  }) => {
    const queryParams = createQueryParams(params);
    return fetchApi<BenchmarkResultResponse[]>(
      `/admin/benchmark-results?${queryParams.toString()}`,
      {
        credentials: 'include',
      }
    );
  },

  getAdminBenchmarkResult: (id: string) =>
    fetchApi<BenchmarkResultResponse>(`/admin/benchmark-results/${id}`, {
      credentials: 'include',
    }),

  updateBenchmarkResult: (id: string, data: BenchmarkResultUpdate) =>
    fetchApi<BenchmarkResultResponse>(`/admin/benchmark-results/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify(data),
    }),

  deleteBenchmarkResult: (id: string) =>
    fetchApi<{ success: boolean }>(`/admin/benchmark-results/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }),

  bulkDeleteBenchmarkResults: (ids: string[]) =>
    fetchApi<{ success: boolean; deleted_count: number }>(
      '/admin/benchmark-results/bulk-delete',
      {
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(ids),
      }
    ),

  getBenchmarkResultFlamegraph: (id: string) =>
    fetchApi<{ flamegraph_html: string }>(
      `/admin/benchmark-results/${id}/flamegraph`,
      {
        credentials: 'include',
      }
    ),

  // Admin Commit endpoints
  getAdminCommits: (params: {
    sha?: string;
    author?: string;
    python_version?: string;
    skip?: number;
    limit?: number;
  }) => {
    const queryParams = createQueryParams(params);
    return fetchApi<CommitResponse[]>(`/admin/commits?${queryParams.toString()}`, {
      credentials: 'include',
    });
  },

  getAdminCommit: (sha: string) =>
    fetchApi<CommitResponse>(`/admin/commits/${sha}`, {
      credentials: 'include',
    }),

  updateCommit: (sha: string, data: CommitUpdate) =>
    fetchApi<CommitResponse>(`/admin/commits/${sha}`, {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify(data),
    }),

  deleteCommit: (sha: string) =>
    fetchApi<{ success: boolean }>(`/admin/commits/${sha}`, {
      method: 'DELETE',
      credentials: 'include',
    }),


  // Admin Binary endpoints
  getAdminBinaries: () =>
    fetchApi<Binary[]>('/admin/binaries', {
      credentials: 'include',
    }),

  createBinary: (data: BinaryCreate) =>
    fetchApi<Binary>('/admin/binaries', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(data),
    }),

  updateBinary: (id: string, data: BinaryCreate) =>
    fetchApi<Binary>(`/admin/binaries/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify(data),
    }),

  deleteBinary: (id: string) =>
    fetchApi<{ success: boolean }>(`/admin/binaries/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }),

  // Admin Environment endpoints
  getAdminEnvironments: () =>
    fetchApi<Environment[]>('/admin/environments', {
      credentials: 'include',
    }),

  createEnvironment: (data: EnvironmentCreate) =>
    fetchApi<Environment>('/admin/environments', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(data),
    }),

  updateEnvironment: (id: string, data: EnvironmentCreate) =>
    fetchApi<Environment>(`/admin/environments/${id}`, {
      method: 'PUT',
      credentials: 'include',
      body: JSON.stringify(data),
    }),

  deleteEnvironment: (id: string) =>
    fetchApi<{ success: boolean }>(`/admin/environments/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    }),

  // Admin User Management endpoints (renamed to avoid conflict with getAdminUsers)
  getAdminUsersList: () =>
    fetchApi<AdminUserResponse[]>('/admin/users', {
      credentials: 'include',
    }),

  createAdminUser: (data: AdminUserCreate) =>
    fetchApi<AdminUserResponse>('/admin/users', {
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify(data),
    }),

  deleteAdminUser: (username: string) =>
    fetchApi<{ success: boolean }>(`/admin/users/${username}`, {
      method: 'DELETE',
      credentials: 'include',
    }),
};

export default api;
export { ApiError };
