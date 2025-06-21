'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LineChart as ChartIcon,
  Download,
  AlertCircle,
  Code2,
  GitCompare,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  EnrichedBenchmarkResult,
  MetricKey,
  PythonVersionFilterOption,
  Binary,
  Environment,
} from '@/lib/types';
import { METRIC_OPTIONS } from '@/lib/types';
import { api } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

const formatBytes = (bytes: number, decimals = 2) => {
  if (!bytes && bytes !== 0) return 'N/A';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export default function BuildComparisonPage() {
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [pythonVersionOptions, setPythonVersionOptions] = useState<
    PythonVersionFilterOption[]
  >([]);
  const [allBenchmarkNames, setAllBenchmarkNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataProcessing, setDataProcessing] = useState(false);

  // Store trend data for each binary-benchmark combination
  const [trendData, setTrendData] = useState<
    Record<
      string,
      Record<
        string,
        Array<{
          sha: string;
          timestamp: string;
          python_version: string;
          high_watermark_bytes: number;
          total_allocated_bytes: number;
        }>
      >
    >
  >({});

  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<
    string | undefined
  >();
  const [selectedPythonVersionKey, setSelectedPythonVersionKey] = useState<
    string | undefined
  >();
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(
    METRIC_OPTIONS[0].value
  );
  const [selectedBinaries, setSelectedBinaries] = useState<string[]>([]);
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  const [benchmarkSearch, setBenchmarkSearch] = useState('');
  const [benchmarkMode, setBenchmarkMode] = useState<'all' | 'specific'>(
    'specific'
  );
  const [viewMode, setViewMode] = useState<'index' | 'relative'>('index');
  const [maxDataPoints, setMaxDataPoints] = useState<number>(50);
  const [debouncedMaxDataPoints, setDebouncedMaxDataPoints] = useState<number>(
    50
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Debounce maxDataPoints changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMaxDataPoints(maxDataPoints);
    }, 500);

    return () => clearTimeout(timer);
  }, [maxDataPoints]);

  // Load initial data (metadata only)
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        setError(null);

        const [
          binariesData,
          environmentsData,
          pythonVersionsData,
        ] = await Promise.all([
          api.getBinaries(),
          api.getEnvironments(),
          api.getPythonVersions(),
        ]);

        setBinaries(binariesData);
        setEnvironments(environmentsData);
        setPythonVersionOptions(pythonVersionsData);

        // Set initial selections
        if (environmentsData.length > 0 && !selectedEnvironmentId) {
          setSelectedEnvironmentId(environmentsData[0].id);
        }
        if (pythonVersionsData.length > 0 && !selectedPythonVersionKey) {
          setSelectedPythonVersionKey(pythonVersionsData[0].label);
        }
        if (binariesData.length > 1 && selectedBinaries.length === 0) {
          // Select first two binaries by default for comparison
          setSelectedBinaries([binariesData[0].id, binariesData[1].id]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    if (mounted) {
      loadInitialData();
    }
  }, [mounted]);

  // Load benchmark data when filters change
  useEffect(() => {
    async function loadBenchmarkData() {
      if (
        !selectedEnvironmentId ||
        !selectedPythonVersionKey ||
        selectedBinaries.length === 0
      ) {
        setDataProcessing(false);
        return;
      }

      const versionOption = pythonVersionOptions.find(
        (v) => v.label === selectedPythonVersionKey
      );
      if (!versionOption) {
        setDataProcessing(false);
        return;
      }

      try {
        setDataProcessing(true);

        // Get available benchmark names for the first binary
        const uniqueBenchmarks = await api.getBenchmarkNames({
          environment_id: selectedEnvironmentId,
          binary_id: selectedBinaries[0],
          python_major: versionOption.major,
          python_minor: versionOption.minor,
        });

        setAllBenchmarkNames(uniqueBenchmarks);

        // Set initial benchmark selection if empty
        if (uniqueBenchmarks.length > 0 && selectedBenchmarks.length === 0) {
          setSelectedBenchmarks([uniqueBenchmarks[0]]);
        }
      } catch (err) {
        console.error('Failed to load benchmark data:', err);
      } finally {
        setDataProcessing(false);
      }
    }

    if (!loading && mounted) {
      loadBenchmarkData();
    }
  }, [
    selectedEnvironmentId,
    selectedPythonVersionKey,
    selectedBinaries,
    pythonVersionOptions,
    loading,
    mounted,
  ]);

  // Load ALL benchmark data upfront for selected binaries and environment
  useEffect(() => {
    async function loadAllTrendData() {
      if (
        !selectedEnvironmentId ||
        selectedBinaries.length === 0 ||
        allBenchmarkNames.length === 0
      ) {
        setDataProcessing(false);
        return;
      }

      setDataProcessing(true);
      try {
        // Create batch request for ALL benchmarks and selected binaries (load everything upfront)
        const trendQueries = allBenchmarkNames.flatMap((benchmark) =>
          selectedBinaries.map((binaryId) => ({
            benchmark_name: benchmark,
            binary_id: binaryId,
            environment_id: selectedEnvironmentId,
            limit: debouncedMaxDataPoints,
          }))
        );

        // Make single batch request for all data
        const batchResponse = await api.getBatchBenchmarkTrends(trendQueries);

        // Update trendData state with all benchmark results
        const newTrendData: typeof trendData = {};

        for (const [key, trends] of Object.entries(batchResponse.results)) {
          const [binaryId, benchmarkName] = key.split(':');
          if (!newTrendData[binaryId]) {
            newTrendData[binaryId] = {};
          }
          newTrendData[binaryId][benchmarkName] = trends;
        }

        setTrendData(newTrendData); // Replace entirely since we're loading all data
      } catch (err) {
        console.error('Failed to load trend data:', err);
      } finally {
        setDataProcessing(false);
      }
    }

    loadAllTrendData();
  }, [
    selectedBinaries,
    selectedEnvironmentId,
    allBenchmarkNames,
    debouncedMaxDataPoints,
  ]); // Remove selectedBenchmarks and benchmarkMode from dependencies

  const filteredData = useMemo(() => {
    // For "All Benchmarks" mode, don't require selectedBenchmarks
    const requiresBenchmarkSelection =
      benchmarkMode === 'specific' && selectedBenchmarks.length === 0;

    if (
      !selectedEnvironmentId ||
      !selectedPythonVersionKey ||
      requiresBenchmarkSelection ||
      selectedBinaries.length === 0
    )
      return [];

    const versionOption = pythonVersionOptions.find(
      (v) => v.label === selectedPythonVersionKey
    );
    if (!versionOption) return [];

    // Determine which benchmarks to include
    const benchmarksToInclude =
      benchmarkMode === 'all' ? allBenchmarkNames : selectedBenchmarks;

    // Extract data from trendData structure
    const results: any[] = [];

    benchmarksToInclude.forEach((benchmarkName) => {
      selectedBinaries.forEach((binaryId) => {
        const trends = trendData[binaryId]?.[benchmarkName];
        if (trends) {
          trends.forEach((trend) => {
            // Filter by Python version
            const [major, minor] = trend.python_version.split('.').map(Number);
            if (
              major === versionOption.major &&
              minor === versionOption.minor
            ) {
              results.push({
                benchmark_name: benchmarkName,
                binary: { id: binaryId },
                environment: { id: selectedEnvironmentId },
                commit: {
                  sha: trend.sha,
                  timestamp: trend.timestamp,
                  message: '', // We don't have commit messages in trend data
                  python_version: { major, minor },
                },
                result_json: {
                  high_watermark_bytes: trend.high_watermark_bytes,
                  total_allocated_bytes: trend.total_allocated_bytes,
                },
                run_python_version: { major, minor, patch: 0 },
              });
            }
          });
        }
      });
    });

    return results.sort(
      (a, b) =>
        new Date(a.commit.timestamp).getTime() -
        new Date(b.commit.timestamp).getTime()
    );
  }, [
    selectedEnvironmentId,
    selectedPythonVersionKey,
    selectedBenchmarks,
    selectedBinaries,
    trendData,
    pythonVersionOptions,
    benchmarkMode,
    allBenchmarkNames,
  ]);

  const chartData = useMemo(() => {
    // Determine which benchmarks to use based on mode
    const benchmarksToUse =
      benchmarkMode === 'all' ? allBenchmarkNames : selectedBenchmarks;

    if (benchmarksToUse.length === 0 || selectedBinaries.length === 0)
      return [];

    // Group data by commit first
    const commitDataMap: {
      [commitSha: string]: {
        commitSha: string;
        timestamp: string;
        commitMessage: string;
        fullVersion?: string;
        sortTimestamp: number;
        benchmarkData: {
          [benchmarkName: string]: { [binaryId: string]: number };
        };
      };
    } = {};

    // Collect data from trendData structure
    benchmarksToUse.forEach((benchmarkName) => {
      selectedBinaries.forEach((binaryId) => {
        const trends = trendData[binaryId]?.[benchmarkName];
        if (trends) {
          trends.forEach((trend) => {
            const commitSha = trend.sha;

            if (!commitDataMap[commitSha]) {
              const timestampMs = new Date(trend.timestamp).getTime();
              commitDataMap[commitSha] = {
                commitSha: commitSha.substring(0, 7),
                timestamp: new Date(trend.timestamp).toLocaleDateString(),
                commitMessage: '', // We don't have commit messages in trend data
                fullVersion: trend.python_version,
                sortTimestamp: timestampMs,
                benchmarkData: {},
              };
            }

            if (!commitDataMap[commitSha].benchmarkData[benchmarkName]) {
              commitDataMap[commitSha].benchmarkData[benchmarkName] = {};
            }

            commitDataMap[commitSha].benchmarkData[benchmarkName][binaryId] =
              selectedMetric === 'high_watermark_bytes'
                ? trend.high_watermark_bytes
                : trend.total_allocated_bytes;
          });
        }
      });
    });

    // Determine which binary to use as X-axis basis
    let xAxisBinaryId: string;

    if (viewMode === 'relative') {
      // For relative performance, always use Default as the baseline
      xAxisBinaryId =
        selectedBinaries.find(
          (id) => binaries.find((b) => b.id === id)?.id === 'default'
        ) || selectedBinaries[0];
    } else {
      // For index mode, find the binary configuration with the most data points
      const binaryDataCounts = selectedBinaries.map((binaryId) => {
        const commitCount = Object.values(commitDataMap).filter((commitData) =>
          benchmarksToUse.some(
            (benchmarkName) =>
              commitData.benchmarkData[benchmarkName] &&
              commitData.benchmarkData[benchmarkName][binaryId] !== undefined
          )
        ).length;
        return { binaryId, commitCount };
      });

      const maxDataBinary =
        binaryDataCounts.length > 0
          ? binaryDataCounts.reduce((max, current) =>
              current.commitCount > max.commitCount ? current : max
            )
          : { binaryId: selectedBinaries[0] };
      xAxisBinaryId = maxDataBinary.binaryId;
    }

    // Use commits that have data for the chosen X-axis binary
    const usableCommits = Object.values(commitDataMap).filter((commitData) =>
      benchmarksToUse.some(
        (benchmarkName) =>
          commitData.benchmarkData[benchmarkName] &&
          commitData.benchmarkData[benchmarkName][xAxisBinaryId] !== undefined
      )
    );

    // Create aggregated chart data
    const aggregatedData = usableCommits.map((commitData) => {
      const dataPoint: any = {
        commitSha: commitData.commitSha,
        timestamp: commitData.timestamp,
        commitMessage: commitData.commitMessage,
        fullVersion: commitData.fullVersion,
        sortTimestamp: commitData.sortTimestamp,
        benchmarkBreakdown: {}, // Store individual benchmark values for tooltips
      };

      selectedBinaries.forEach((binaryId) => {
        // Calculate aggregated performance score across benchmarks that have data for this binary
        const availableBenchmarkValues = benchmarksToUse
          .filter(
            (benchmarkName) =>
              commitData.benchmarkData[benchmarkName] &&
              commitData.benchmarkData[benchmarkName][binaryId] !== undefined
          )
          .map(
            (benchmarkName) => commitData.benchmarkData[benchmarkName][binaryId]
          );

        if (availableBenchmarkValues.length === 0) {
          // No data for this binary in this commit - set as undefined so chart can handle gaps
          dataPoint[binaryId] = undefined;
          return;
        }

        if (viewMode === 'index') {
          // Performance Index: Geometric mean of available benchmark values
          const geometricMean = Math.pow(
            availableBenchmarkValues.reduce(
              (product, value) => product * value,
              1
            ),
            1 / availableBenchmarkValues.length
          );
          dataPoint[binaryId] = geometricMean;
        } else {
          // Relative Performance: Calculate average percentage difference from default
          const defaultBinaryId =
            selectedBinaries.find(
              (id) => binaries.find((b) => b.id === id)?.id === 'default'
            ) || selectedBinaries[0];

          if (binaryId === defaultBinaryId) {
            // Default binary is always 0% difference
            dataPoint[binaryId] = 0;
          } else {
            // Get available benchmarks for both current and default binary
            const commonBenchmarks = benchmarksToUse.filter(
              (benchmarkName) =>
                commitData.benchmarkData[benchmarkName] &&
                commitData.benchmarkData[benchmarkName][binaryId] !==
                  undefined &&
                commitData.benchmarkData[benchmarkName][defaultBinaryId] !==
                  undefined
            );

            if (commonBenchmarks.length === 0) {
              // No common benchmarks to compare - get default binary's available benchmarks for this commit
              const defaultAvailableBenchmarks = benchmarksToUse
                .filter(
                  (benchmarkName) =>
                    commitData.benchmarkData[benchmarkName] &&
                    commitData.benchmarkData[benchmarkName][defaultBinaryId] !==
                      undefined
                )
                .map(
                  (benchmarkName) =>
                    commitData.benchmarkData[benchmarkName][defaultBinaryId]
                );

              if (defaultAvailableBenchmarks.length === 0) {
                // No default data at all - just show current binary's relative performance as a raw index
                dataPoint[binaryId] =
                  availableBenchmarkValues.reduce((sum, val) => sum + val, 0) /
                  availableBenchmarkValues.length;
              } else {
                // Compare averages between current binary and default binary
                const avgDefaultValue =
                  defaultAvailableBenchmarks.reduce(
                    (sum, val) => sum + val,
                    0
                  ) / defaultAvailableBenchmarks.length;
                const avgCurrentValue =
                  availableBenchmarkValues.reduce((sum, val) => sum + val, 0) /
                  availableBenchmarkValues.length;
                dataPoint[binaryId] =
                  ((avgCurrentValue - avgDefaultValue) / avgDefaultValue) * 100;
              }
            } else {
              const avgRelativePerformance =
                commonBenchmarks.reduce((sum, benchmarkName) => {
                  const currentValue =
                    commitData.benchmarkData[benchmarkName][binaryId];
                  const defaultValue =
                    commitData.benchmarkData[benchmarkName][defaultBinaryId];
                  const relativePerf =
                    ((currentValue - defaultValue) / defaultValue) * 100;
                  return sum + relativePerf;
                }, 0) / commonBenchmarks.length;

              dataPoint[binaryId] = avgRelativePerformance;
            }
          }
        }

        // Store breakdown for tooltips
        dataPoint.benchmarkBreakdown[binaryId] = {};
        benchmarksToUse.forEach((benchmarkName) => {
          if (
            commitData.benchmarkData[benchmarkName] &&
            commitData.benchmarkData[benchmarkName][binaryId] !== undefined
          ) {
            dataPoint.benchmarkBreakdown[binaryId][benchmarkName] =
              commitData.benchmarkData[benchmarkName][binaryId];
          }
        });
      });

      return dataPoint;
    });

    // Sort by timestamp and limit to maxDataPoints
    const sortedData = aggregatedData.sort(
      (a, b) => a.sortTimestamp - b.sortTimestamp
    );

    // If we have more data points than the limit, take the most recent ones
    if (sortedData.length > maxDataPoints) {
      return sortedData.slice(-maxDataPoints);
    }

    return sortedData;
  }, [
    trendData,
    selectedMetric,
    selectedBinaries,
    selectedBenchmarks,
    viewMode,
    binaries,
    benchmarkMode,
    allBenchmarkNames,
    maxDataPoints,
  ]);

  // Calculate Y-axis domain for the single aggregated chart
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0 || selectedBinaries.length === 0) {
      return ['auto', 'auto'];
    }

    let min = Infinity;
    let max = -Infinity;
    const valuesByBinary: { [key: string]: number[] } = {};

    chartData.forEach((dataPoint) => {
      selectedBinaries.forEach((binaryId) => {
        const value = dataPoint[binaryId];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
          if (!valuesByBinary[binaryId]) valuesByBinary[binaryId] = [];
          valuesByBinary[binaryId].push(value);
        }
      });
    });

    if (min === Infinity || max === -Infinity) {
      return ['auto', 'auto'];
    }

    if (viewMode === 'relative') {
      // For relative view, ensure 0 is included but optimize range usage
      const range = max - min;
      const padding = Math.max(range * 0.05, Math.abs(range) * 0.02); // Smaller padding

      // Don't force symmetric range - use actual data bounds with minimal padding
      const domainMin = min - padding;
      const domainMax = max + padding;

      // Ensure 0 is visible but don't waste space if data is far from 0
      if (min > 0 && max > 0) {
        // All positive values - start from 0 or close to min
        return [Math.min(0, domainMin), domainMax];
      } else if (min < 0 && max < 0) {
        // All negative values - end at 0 or close to max
        return [domainMin, Math.max(0, domainMax)];
      } else {
        // Mixed values - include 0 but don't add extra symmetric padding
        return [domainMin, domainMax];
      }
    } else {
      // For index view, use tighter padding
      const range = max - min;
      const padding = range * 0.05; // Reduced from 10% to 5%
      const domainMin = Math.max(0, min - padding);
      const domainMax = max + padding;
      return [domainMin, domainMax];
    }
  }, [chartData, selectedBinaries, viewMode]);

  const handleBinarySelection = (binaryId: string) => {
    setSelectedBinaries((prev) =>
      prev.includes(binaryId)
        ? prev.filter((b) => b !== binaryId)
        : [...prev, binaryId]
    );
  };

  const handleBenchmarkSelection = (benchmarkName: string) => {
    setSelectedBenchmarks((prev) =>
      prev.includes(benchmarkName)
        ? prev.filter((b) => b !== benchmarkName)
        : [...prev, benchmarkName]
    );
  };

  const handleExport = (format: 'png' | 'csv') => {
    if (format === 'csv') {
      exportAsCSV();
    } else if (format === 'png') {
      exportAsPNG();
    }
  };

  const exportAsCSV = () => {
    if (chartData.length === 0) return;

    // Export aggregated performance data
    const binaryNames = selectedBinaries.map(
      (id) => binaries.find((b) => b.id === id)?.name || id
    );
    const metricUnit =
      viewMode === 'relative' ? '(% vs Default)' : '(Aggregated Score)';
    const headers = [
      'Commit SHA',
      'Timestamp',
      'Message',
      'Python Version',
      'View Mode',
      'Selected Benchmarks',
      ...binaryNames.map((name) => `${name} ${metricUnit}`),
    ];

    const rows = chartData.map((dataPoint) => [
      dataPoint.commitSha,
      dataPoint.timestamp,
      `"${dataPoint.commitMessage || 'No message'}"`,
      dataPoint.fullVersion || '',
      viewMode === 'index' ? 'Performance Index' : 'Relative Performance',
      `"${(benchmarkMode === 'all'
        ? allBenchmarkNames
        : selectedBenchmarks
      ).join(', ')}"`,
      ...selectedBinaries.map((binaryId) => {
        const value = dataPoint[binaryId];
        return typeof value === 'number' ? value.toFixed(2) : '';
      }),
    ]);

    // Combine headers and rows
    const csvContent = [headers, ...rows]
      .map((row) => row.join(','))
      .join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `build-comparison-${viewMode}-${
        new Date().toISOString().split('T')[0]
      }.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsPNG = () => {
    // Use html2canvas to capture the chart
    const chartElement = document.querySelector('.recharts-wrapper');
    if (!chartElement) return;

    import('html2canvas')
      .then((html2canvas) => {
        html2canvas
          .default(chartElement as HTMLElement, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
          })
          .then((canvas) => {
            const link = document.createElement('a');
            link.download = `build-comparison-${viewMode}-${
              new Date().toISOString().split('T')[0]
            }.png`;
            link.href = canvas.toDataURL();
            link.click();
          });
      })
      .catch((error) => {
        console.error('Failed to export chart as PNG:', error);
        alert('PNG export failed. Please try again.');
      });
  };

  const displayedBenchmarkNames = useMemo(() => {
    if (allBenchmarkNames.length === 0) {
      return [];
    }
    return allBenchmarkNames.filter((name) =>
      name.toLowerCase().includes(benchmarkSearch.toLowerCase())
    );
  }, [allBenchmarkNames, benchmarkSearch]);

  const lineColors = ['#8884d8', '#82ca9d', '#ffc658'];
  const MAX_BINARIES = 3;

  if (!mounted || loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <GitCompare className="h-8 w-8 text-primary" />
            Binary Configuration Comparison
          </h1>
          <p className="text-muted-foreground mt-2">
            Compare performance across different binary configurations for the
            same commits
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 animate-pulse bg-muted rounded-md"></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Charts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-96 animate-pulse bg-muted rounded-md"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
            <GitCompare className="h-8 w-8 text-primary" />
            Binary Configuration Comparison
          </h1>
          <p className="text-muted-foreground mt-2">
            Compare performance across different binary configurations for the
            same commits
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
            <p className="text-lg">Error loading data</p>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
          <GitCompare className="h-8 w-8 text-primary" />
          Binary Configuration Comparison
        </h1>
        <p className="text-muted-foreground mt-2">
          Compare performance across {binaries.length} different binary
          configurations
          {binaries.length > 0 &&
            ` (${binaries.map((b) => b.name).join(', ')})`}{' '}
          for the same commits
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            Select environment, Python version, benchmarks, and multiple binary
            configurations from the {binaries.length} available options to
            compare
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="environment-select">Environment</Label>
              <Select
                value={selectedEnvironmentId}
                onValueChange={setSelectedEnvironmentId}
              >
                <SelectTrigger id="environment-select">
                  <SelectValue placeholder="Select Environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((environment) => (
                    <SelectItem key={environment.id} value={environment.id}>
                      {environment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="python-version-select">Python Version</Label>
              <Select
                value={selectedPythonVersionKey}
                onValueChange={setSelectedPythonVersionKey}
              >
                <SelectTrigger id="python-version-select">
                  <SelectValue placeholder="Select Python Version" />
                </SelectTrigger>
                <SelectContent>
                  {pythonVersionOptions.map((v) => (
                    <SelectItem key={v.label} value={v.label}>
                      <div className="flex items-center gap-2">
                        <Code2 className="h-4 w-4 text-primary/80" /> {v.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="metric-select">Metric</Label>
              <Select
                value={selectedMetric}
                onValueChange={(val) => setSelectedMetric(val as MetricKey)}
              >
                <SelectTrigger id="metric-select">
                  <SelectValue placeholder="Select Metric" />
                </SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/50">
            <Label className="text-base font-semibold">
              Aggregation Method
            </Label>
            <div className="flex gap-2 mt-3">
              <Button
                variant={viewMode === 'index' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('index')}
              >
                Memory Usage
              </Button>
              <Button
                variant={viewMode === 'relative' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('relative')}
              >
                Relative Performance
              </Button>
            </div>

            <div className="mt-4 p-3 bg-background rounded border-l-4 border-primary">
              <div className="text-sm">
                <div className="font-medium mb-2">How aggregation works:</div>
                {viewMode === 'index' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        Geometric Mean
                      </span>
                      <span className="text-muted-foreground">
                        across selected benchmarks
                      </span>
                    </div>
                    <div className="font-mono text-xs bg-muted/50 p-2 rounded">
                      Aggregated Memory = ⁿ√(bench₁ × bench₂ × ... × benchₙ)
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Shows aggregated memory usage across all benchmarks.
                      Higher values = more memory used.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
                        Average % Change
                      </span>
                      <span className="text-muted-foreground">
                        vs Default binary
                      </span>
                    </div>
                    <div className="font-mono text-xs bg-muted/50 p-2 rounded">
                      Avg % Change = (Σ[((binary_benchᵢ - default_benchᵢ) /
                      default_benchᵢ) × 100%]) / n_benchmarks
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Each benchmark's % change vs Default is calculated, then
                      averaged across all selected benchmarks. 0% = same as
                      default, positive = uses more memory, negative = uses less
                      memory.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <Label className="text-base">Benchmarks</Label>
              <div className="flex gap-1">
                <Button
                  variant={benchmarkMode === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBenchmarkMode('all')}
                >
                  All Benchmarks
                </Button>
                <Button
                  variant={benchmarkMode === 'specific' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBenchmarkMode('specific')}
                >
                  Select Specific
                </Button>
              </div>
            </div>

            {benchmarkMode === 'all' ? (
              <div className="p-4 border rounded-md bg-muted/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 bg-primary rounded-full"></div>
                  <span className="font-medium">
                    Using all {allBenchmarkNames.length} available benchmarks
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Aggregating across all benchmarks in the dataset:{' '}
                  {allBenchmarkNames
                    .map((name) => name.replace('_', ' '))
                    .slice(0, 3)
                    .join(', ')}
                  {allBenchmarkNames.length > 3 &&
                    ` and ${allBenchmarkNames.length - 3} more...`}
                </p>
              </div>
            ) : (
              <div>
                <Input
                  placeholder="Search benchmarks..."
                  value={benchmarkSearch}
                  onChange={(e) => setBenchmarkSearch(e.target.value)}
                  className="mb-2"
                  disabled={
                    loading || dataProcessing || allBenchmarkNames.length === 0
                  }
                />
                <ScrollArea className="h-48 rounded-md border p-4">
                  {loading ||
                  dataProcessing ||
                  (allBenchmarkNames.length === 0 &&
                    selectedEnvironmentId &&
                    selectedPythonVersionKey &&
                    selectedBinaries.length > 0) ? (
                    <div className="space-y-2">
                      {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex items-center space-x-2">
                          <div className="w-4 h-4 bg-muted rounded animate-pulse"></div>
                          <div className="h-4 bg-muted rounded animate-pulse flex-1"></div>
                        </div>
                      ))}
                    </div>
                  ) : allBenchmarkNames.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <p className="text-sm">No benchmarks available</p>
                      <p className="text-xs">
                        Try selecting a different environment, Python version,
                        or binaries
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
                      {displayedBenchmarkNames.map((name) => (
                        <div key={name} className="flex items-center space-x-2">
                          <Checkbox
                            id={`bench-${name}`}
                            checked={selectedBenchmarks.includes(name)}
                            onCheckedChange={() =>
                              handleBenchmarkSelection(name)
                            }
                          />
                          <Label
                            htmlFor={`bench-${name}`}
                            className="font-normal cursor-pointer text-sm truncate"
                            title={name}
                          >
                            {name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
                {selectedBenchmarks.length === 0 && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Select at least 1 benchmark to compare
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>
              Binary Configurations (Select 2-{MAX_BINARIES} from{' '}
              {binaries.length} available)
            </Label>
            <ScrollArea className="h-48 rounded-md border p-4 mt-2">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-3">
                {binaries.map((binary) => (
                  <div key={binary.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={`binary-${binary.id}`}
                      checked={selectedBinaries.includes(binary.id)}
                      onCheckedChange={() => handleBinarySelection(binary.id)}
                      disabled={
                        !selectedBinaries.includes(binary.id) &&
                        selectedBinaries.length >= MAX_BINARIES
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`binary-${binary.id}`}
                        className="font-normal cursor-pointer text-sm"
                      >
                        <div
                          className="font-medium truncate"
                          title={binary.name}
                        >
                          {binary.name}
                        </div>
                        {binary.flags.length > 0 && (
                          <div
                            className="text-xs text-muted-foreground mt-1 truncate"
                            title={binary.flags.join(', ')}
                          >
                            {binary.flags.join(', ')}
                          </div>
                        )}
                      </Label>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            {selectedBinaries.length < 2 && (
              <p className="text-sm text-muted-foreground mt-2">
                Select at least 2 binary configurations to compare
              </p>
            )}
            {selectedBinaries.length >= MAX_BINARIES && (
              <p className="text-sm text-muted-foreground mt-2">
                Maximum {MAX_BINARIES} binary configurations can be displayed
                simultaneously
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ChartIcon className="h-6 w-6 text-primary" />
              Binary Configuration Comparison Charts
            </CardTitle>
            <CardDescription>
              Aggregated comparison of {selectedBinaries.length} binary
              configuration{selectedBinaries.length !== 1 ? 's' : ''}
              {(() => {
                const benchmarksToUse =
                  benchmarkMode === 'all'
                    ? allBenchmarkNames
                    : selectedBenchmarks;
                if (benchmarksToUse.length > 0) {
                  return (
                    <>
                      {' '}
                      averaging{' '}
                      {benchmarkMode === 'all'
                        ? 'all'
                        : benchmarksToUse.length}{' '}
                      benchmark{benchmarksToUse.length !== 1 ? 's' : ''}
                      {benchmarkMode === 'specific' &&
                        benchmarksToUse.length <= 5 && (
                          <>
                            {' '}
                            (
                            {benchmarksToUse
                              .map((name) => name.replace('_', ' '))
                              .join(', ')}
                            )
                          </>
                        )}
                      {benchmarkMode === 'all' && (
                        <> ({benchmarksToUse.length} total)</>
                      )}
                    </>
                  );
                }
                return null;
              })()}{' '}
              on Python {selectedPythonVersionKey}
            </CardDescription>

            {/* Data Points Control - always show if we have data */}
            {chartData.length > 0 && (
              <div className="flex items-center gap-4 mt-4 p-3 bg-muted/30 rounded-md">
                <span className="text-sm text-muted-foreground min-w-0">
                  Points:
                </span>
                <div className="flex items-center space-x-3 flex-1">
                  <span className="text-xs text-muted-foreground">10</span>
                  <Slider
                    value={[maxDataPoints]}
                    onValueChange={(value) => setMaxDataPoints(value[0])}
                    max={200}
                    min={10}
                    step={5}
                    className="flex-1"
                  />
                  <span className="text-xs text-muted-foreground">200</span>
                </div>
                <span className="text-sm font-medium min-w-0">
                  {maxDataPoints}
                </span>
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={chartData.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('png')}>
                <Download className="mr-2 h-4 w-4" />
                Export as PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <Download className="mr-2 h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {dataProcessing ? (
            <div className="flex flex-col items-center justify-center h-96 space-y-4">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <div className="text-center space-y-2">
                <p className="text-lg font-medium">Loading benchmark data...</p>
                <p className="text-sm text-muted-foreground">
                  Fetching all benchmark trends for {selectedBinaries.length}{' '}
                  binary configurations
                </p>
              </div>
            </div>
          ) : chartData.length > 0 && selectedBinaries.length >= 2 ? (
            <ResponsiveContainer width="100%" height={500}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="commitSha"
                  angle={-35}
                  textAnchor="end"
                  height={80}
                  interval={
                    chartData.length > 20
                      ? Math.floor(chartData.length / 10)
                      : 0
                  }
                />
                <YAxis
                  domain={yAxisDomain}
                  tickFormatter={(value) => {
                    if (viewMode === 'relative') {
                      return `${value.toFixed(1)}%`;
                    } else {
                      return formatBytes(value);
                    }
                  }}
                />
                <Tooltip
                  formatter={(value: number, name: string, props) => {
                    const binary = binaries.find((b) => b.id === name);
                    const displayName = binary?.name || name;

                    if (viewMode === 'relative') {
                      return [`${value.toFixed(2)}%`, displayName];
                    } else {
                      return [formatBytes(value), displayName];
                    }
                  }}
                  labelFormatter={(label, payload) => {
                    const commitData = payload?.[0]?.payload;
                    if (commitData) {
                      const message = commitData.commitMessage || 'No message';
                      return `${commitData.commitSha}: ${message.substring(
                        0,
                        50
                      )}${message.length > 50 ? '...' : ''}`;
                    }
                    return label;
                  }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                  itemSorter={(item) =>
                    selectedBinaries.indexOf(item.dataKey as string)
                  }
                />
                <Legend
                  formatter={(value) =>
                    binaries.find((b) => b.id === value)?.name || value
                  }
                />
                {selectedBinaries.map((binaryId, index) => {
                  // For the default binary in relative mode, make it more visible
                  const isDefaultInRelative =
                    viewMode === 'relative' &&
                    binaries.find((b) => b.id === binaryId)?.id === 'default';

                  return (
                    <Line
                      key={binaryId}
                      type="monotone"
                      dataKey={binaryId}
                      stroke={lineColors[index % lineColors.length]}
                      strokeWidth={isDefaultInRelative ? 3 : 2}
                      strokeDasharray={isDefaultInRelative ? '8 4' : undefined}
                      dot={{ r: isDefaultInRelative ? 4 : 3 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  );
                })}
                {viewMode === 'relative' && (
                  <Line
                    type="monotone"
                    dataKey={() => 0}
                    stroke="#888"
                    strokeWidth={1}
                    strokeDasharray="2 2"
                    dot={false}
                    legendType="none"
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
              <AlertCircle className="w-16 h-16 mb-4" />
              <p className="text-lg">No data available</p>
              {selectedBinaries.length < 2 ? (
                <p>Please select at least 2 binary configurations to compare</p>
              ) : selectedBenchmarks.length === 0 ? (
                <p>Please select at least 1 benchmark</p>
              ) : (
                <p>
                  No commits found with results for all selected binary
                  configurations and benchmarks
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
