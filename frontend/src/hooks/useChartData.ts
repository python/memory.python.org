'use client';

import { useMemo } from 'react';
import { format } from 'date-fns';

type TrendDataPoint = {
  sha: string;
  timestamp: string;
  python_version: string;
  high_watermark_bytes: number;
  total_allocated_bytes: number;
};

type ChartDataPoint = {
  date: string;
  timestamp: string;
  sha: string;
  python_version: string;
  [key: string]: string | number;
};

export function useChartData(
  trendData: Record<string, TrendDataPoint[]>,
  selectedBenchmarks: string[],
  selectedMetric: 'high_watermark_bytes' | 'total_allocated_bytes'
) {
  return useMemo(() => {
    if (!trendData || selectedBenchmarks.length === 0) {
      return [];
    }

    // Get all unique dates across all benchmarks
    const allDates = new Set<string>();
    Object.values(trendData).forEach((trends) => {
      trends.forEach((point) => {
        allDates.add(point.timestamp);
      });
    });

    // Sort dates chronologically
    const sortedDates = Array.from(allDates).sort();

    // Create chart data points
    const chartData: ChartDataPoint[] = sortedDates.map((timestamp) => {
      const basePoint: ChartDataPoint = {
        date: format(new Date(timestamp), 'MMM dd'),
        timestamp,
        sha: '',
        python_version: '',
      };

      // For each selected benchmark, find the data point for this timestamp
      selectedBenchmarks.forEach((benchmarkName) => {
        const benchmarkTrends = trendData[benchmarkName] || [];
        const dataPoint = benchmarkTrends.find(
          (point) => point.timestamp === timestamp
        );

        if (dataPoint) {
          basePoint[benchmarkName] = dataPoint[selectedMetric];
          if (!basePoint.sha) {
            basePoint.sha = dataPoint.sha;
            basePoint.python_version = dataPoint.python_version;
          }
        }
      });

      return basePoint;
    });

    return chartData;
  }, [trendData, selectedBenchmarks, selectedMetric]);
}

export function useYAxisDomain(
  chartData: ChartDataPoint[],
  selectedBenchmarks: string[]
) {
  return useMemo(() => {
    if (chartData.length === 0 || selectedBenchmarks.length === 0) {
      return [0, 1000000];
    }

    let min = Infinity;
    let max = -Infinity;

    chartData.forEach((point) => {
      selectedBenchmarks.forEach((benchmark) => {
        const value = point[benchmark];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    if (min === Infinity || max === -Infinity) {
      return [0, 1000000];
    }

    // Add 5% padding
    const padding = (max - min) * 0.05;
    return [Math.max(0, min - padding), max + padding];
  }, [chartData, selectedBenchmarks]);
}

export function useBuildComparisonData(
  allTrendData: Record<string, Record<string, TrendDataPoint[]>>,
  selectedBenchmarks: string[],
  selectedBinaries: string[],
  maxDataPoints: number
) {
  return useMemo(() => {
    if (
      !allTrendData ||
      selectedBenchmarks.length === 0 ||
      selectedBinaries.length === 0
    ) {
      return [];
    }

    const results: Array<{
      benchmark: string;
      data: Array<{
        binary: string;
        points: TrendDataPoint[];
        geometricMean: number;
      }>;
    }> = [];

    selectedBenchmarks.forEach((benchmark) => {
      const benchmarkData: Array<{
        binary: string;
        points: TrendDataPoint[];
        geometricMean: number;
      }> = [];

      selectedBinaries.forEach((binary) => {
        const trendData = allTrendData[binary]?.[benchmark] || [];
        const limitedData = trendData.slice(-maxDataPoints);

        // Calculate geometric mean
        const values = limitedData
          .map((point) => point.high_watermark_bytes)
          .filter((v) => v > 0);
        const geometricMean =
          values.length > 0
            ? Math.exp(
                values.reduce((sum, value) => sum + Math.log(value), 0) /
                  values.length
              )
            : 0;

        benchmarkData.push({
          binary,
          points: limitedData,
          geometricMean,
        });
      });

      results.push({
        benchmark,
        data: benchmarkData,
      });
    });

    return results;
  }, [allTrendData, selectedBenchmarks, selectedBinaries, maxDataPoints]);
}

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
