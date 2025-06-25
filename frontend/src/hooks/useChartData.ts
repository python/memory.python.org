'use client';

import { useMemo } from 'react';

export function useFilteredDiffData<T extends Record<string, any>>(
  data: T[],
  filterBenchmarkName: string,
  filterThreshold: number,
  sortField: keyof T,
  sortDirection: 'asc' | 'desc'
) {
  return useMemo(() => {
    let filtered = [...data];

    // Apply benchmark name filter
    if (filterBenchmarkName) {
      const searchTerm = filterBenchmarkName.toLowerCase();
      filtered = filtered.filter((item) =>
        item.benchmark_name?.toLowerCase().includes(searchTerm)
      );
    }

    // Apply threshold filter
    if (filterThreshold > 0) {
      filtered = filtered.filter((item) => {
        const delta = Math.abs(item.relative_change || 0);
        return delta >= filterThreshold / 100;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });

    return filtered;
  }, [data, filterBenchmarkName, filterThreshold, sortField, sortDirection]);
}
