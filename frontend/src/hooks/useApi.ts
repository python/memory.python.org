'use client';

import { useQuery, useQueries, UseQueryOptions } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Query keys for consistent caching
export const queryKeys = {
  binaries: ['binaries'] as const,
  environments: ['environments'] as const,
  pythonVersions: ['pythonVersions'] as const,
  environmentsForBinary: (binaryId: string) =>
    ['environmentsForBinary', binaryId] as const,
  commitsForBinaryEnvironment: (binaryId: string, environmentId: string) =>
    ['commitsForBinaryEnvironment', binaryId, environmentId] as const,
  benchmarkNames: (binaryId: string, environmentId: string) =>
    ['benchmarkNames', binaryId, environmentId] as const,
  benchmarkTrends: (params: {
    benchmark_name: string;
    binary_id: string;
    environment_id: string;
    limit: number;
  }) => ['benchmarkTrends', params] as const,
  batchBenchmarkTrends: (
    queries: Array<{
      benchmark_name: string;
      binary_id: string;
      environment_id: string;
      limit: number;
    }>
  ) => ['batchBenchmarkTrends', queries] as const,
};

// Basic data fetching hooks
export function useBinaries() {
  return useQuery({
    queryKey: queryKeys.binaries,
    queryFn: api.getBinaries,
    staleTime: 10 * 60 * 1000, // 10 minutes - binaries rarely change
  });
}

export function useEnvironments() {
  return useQuery({
    queryKey: queryKeys.environments,
    queryFn: api.getEnvironments,
    staleTime: 10 * 60 * 1000, // 10 minutes - environments rarely change
  });
}

export function usePythonVersions() {
  return useQuery({
    queryKey: queryKeys.pythonVersions,
    queryFn: api.getPythonVersions,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Dependent data fetching hooks
export function useEnvironmentsForBinary(binaryId: string | null) {
  return useQuery({
    queryKey: queryKeys.environmentsForBinary(binaryId || ''),
    queryFn: () => api.getEnvironmentsForBinary(binaryId!),
    enabled: !!binaryId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCommitsForBinaryEnvironment(
  binaryId: string | null,
  environmentId: string | null
) {
  return useQuery({
    queryKey: queryKeys.commitsForBinaryEnvironment(
      binaryId || '',
      environmentId || ''
    ),
    queryFn: () =>
      api.getCommitsForBinaryAndEnvironment(binaryId!, environmentId!),
    enabled: !!binaryId && !!environmentId,
    staleTime: 2 * 60 * 1000, // 2 minutes - commits change more frequently
  });
}

export function useBenchmarkNames(
  binaryId: string | null,
  environmentId: string | null
) {
  return useQuery({
    queryKey: queryKeys.benchmarkNames(binaryId || '', environmentId || ''),
    queryFn: () => api.getBenchmarkNames(binaryId!, environmentId!),
    enabled: !!binaryId && !!environmentId,
    staleTime: 5 * 60 * 1000,
  });
}

// Single benchmark trend hook
export function useBenchmarkTrends(
  params: {
    benchmark_name: string;
    binary_id: string;
    environment_id: string;
    limit: number;
  } | null
) {
  return useQuery({
    queryKey: params
      ? queryKeys.benchmarkTrends(params)
      : ['benchmarkTrends', 'disabled'],
    queryFn: () => api.getBenchmarkTrends(params!),
    enabled: !!params,
    staleTime: 1 * 60 * 1000, // 1 minute - benchmark data changes frequently
  });
}

// Batch benchmark trends hook - optimized for multiple queries
export function useBatchBenchmarkTrends(
  queries: Array<{
    benchmark_name: string;
    binary_id: string;
    environment_id: string;
    limit: number;
  }>
) {
  return useQueries({
    queries: queries.map((query) => ({
      queryKey: queryKeys.benchmarkTrends(query),
      queryFn: () => api.getBenchmarkTrends(query),
      staleTime: 1 * 60 * 1000,
      enabled:
        !!query.benchmark_name && !!query.binary_id && !!query.environment_id,
    })),
  });
}

// Optimized batch trends for build comparison
export function useBatchBenchmarkTrendsOptimized(
  queries: Array<{
    benchmark_name: string;
    binary_id: string;
    environment_id: string;
    limit: number;
  }>,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.batchBenchmarkTrends(queries),
    queryFn: () => api.getBatchBenchmarkTrends(queries),
    enabled: enabled && queries.length > 0,
    staleTime: 1 * 60 * 1000,
    // Split large requests into smaller chunks to avoid overwhelming the server
    select: (data) => {
      // Group results by binary_id for easier processing
      const grouped = data.reduce((acc, result) => {
        const key = `${result.binary_id}_${result.environment_id}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(result);
        return acc;
      }, {} as Record<string, typeof data>);
      return grouped;
    },
  });
}

// Generic hook for any API call with custom options
export function useApiQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options?: Partial<UseQueryOptions<T>>
) {
  return useQuery({
    queryKey,
    queryFn,
    ...options,
  });
}
