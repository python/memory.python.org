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
  MetricKey,
  PythonVersionFilterOption,
  Binary,
  Environment,
} from '@/lib/types';
import { METRIC_OPTIONS } from '@/lib/types';
import { api } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';
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

export default function BenchmarkTrendPage() {
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [availableEnvironments, setAvailableEnvironments] = useState<
    Environment[]
  >([]);
  const [pythonVersionOptions, setPythonVersionOptions] = useState<
    PythonVersionFilterOption[]
  >([]);
  const [allBenchmarkNames, setAllBenchmarkNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataProcessing, setDataProcessing] = useState(false);

  const [selectedBinaryId, setSelectedBinaryId] = useState<
    string | undefined
  >();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<
    string | undefined
  >();
  const [selectedPythonVersionKey, setSelectedPythonVersionKey] = useState<
    string | undefined
  >();
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>(
    METRIC_OPTIONS[0].value
  );
  const [selectedBenchmarks, setSelectedBenchmarks] = useState<string[]>([]);
  const [benchmarkSearch, setBenchmarkSearch] = useState('');
  const [maxDataPoints, setMaxDataPoints] = useState<number>(50);
  const [debouncedMaxDataPoints, setDebouncedMaxDataPoints] = useState<number>(
    50
  );

  const [mounted, setMounted] = useState(false);
  const [trendData, setTrendData] = useState<
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
  >({});

  useEffect(() => setMounted(true), []);

  // Debounce maxDataPoints changes
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedMaxDataPoints(maxDataPoints);
    }, 200);

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
        if (binariesData.length > 0 && !selectedBinaryId) {
          setSelectedBinaryId(binariesData[0].id);
        }
        if (environmentsData.length > 0 && !selectedEnvironmentId) {
          setSelectedEnvironmentId(environmentsData[0].id);
        }
        if (pythonVersionsData.length > 0 && !selectedPythonVersionKey) {
          setSelectedPythonVersionKey(pythonVersionsData[0].label);
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

  // Update available environments when binary is selected
  useEffect(() => {
    async function updateAvailableEnvironments() {
      if (!selectedBinaryId) {
        setAvailableEnvironments([]);
        setSelectedEnvironmentId(undefined);
        return;
      }

      try {
        const environmentsForBinary = await api.getEnvironmentsForBinary(
          selectedBinaryId
        );
        const filteredEnvironments = environments.filter((env) =>
          environmentsForBinary.some((envData) => envData.id === env.id)
        );
        setAvailableEnvironments(filteredEnvironments);

        // Reset environment selection if current one is not available
        if (
          selectedEnvironmentId &&
          !filteredEnvironments.find((e) => e.id === selectedEnvironmentId)
        ) {
          setSelectedEnvironmentId(
            filteredEnvironments.length > 0
              ? filteredEnvironments[0].id
              : undefined
          );
        }
      } catch (err) {
        console.error('Failed to load environments for binary:', err);
        setAvailableEnvironments([]);
      }
    }

    updateAvailableEnvironments();
  }, [selectedBinaryId, environments, selectedEnvironmentId]);

  // Load benchmark data when filters change
  useEffect(() => {
    async function loadBenchmarkData() {
      if (
        !selectedBinaryId ||
        !selectedEnvironmentId ||
        !selectedPythonVersionKey
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
        const uniqueBenchmarks = await api.getBenchmarkNames({
          environment_id: selectedEnvironmentId,
          binary_id: selectedBinaryId,
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

    if (!loading && mounted && availableEnvironments.length > 0) {
      loadBenchmarkData();
    }
  }, [
    selectedBinaryId,
    selectedEnvironmentId,
    selectedPythonVersionKey,
    pythonVersionOptions,
    loading,
    mounted,
    availableEnvironments,
  ]);

  // Load trend data when benchmarks are selected
  useEffect(() => {
    async function loadSelectedBenchmarkTrends() {
      if (
        !selectedBinaryId ||
        !selectedEnvironmentId ||
        selectedBenchmarks.length === 0
      ) {
        return;
      }

      setDataProcessing(true);
      try {
        // Create batch request for all selected benchmarks
        const trendQueries = selectedBenchmarks.map((benchmark) => ({
          benchmark_name: benchmark,
          binary_id: selectedBinaryId,
          environment_id: selectedEnvironmentId,
          limit: debouncedMaxDataPoints,
        }));

        // Make single batch request instead of multiple individual requests
        const batchResponse = await api.getBatchBenchmarkTrends(trendQueries);

        // Update trendData state with batch results
        const newTrendData: typeof trendData = {};

        for (const [key, trends] of Object.entries(batchResponse.results)) {
          const [, benchmarkName] = key.split(':');
          newTrendData[benchmarkName] = trends;
        }

        setTrendData((prev) => ({
          ...prev,
          ...newTrendData,
        }));
      } catch (err) {
        console.error(
          'Failed to load trend data for selected benchmarks:',
          err
        );
      } finally {
        setDataProcessing(false);
      }
    }

    loadSelectedBenchmarkTrends();
  }, [
    selectedBenchmarks,
    selectedBinaryId,
    selectedEnvironmentId,
    debouncedMaxDataPoints,
  ]);

  const chartData = useMemo(() => {
    if (selectedBenchmarks.length === 0) return [];

    // Collect all unique commits from trend data
    const commitMap: {
      [commitSha: string]: {
        commitSha: string;
        timestamp: string;
        fullVersion: string;
        sortTimestamp: number;
        [benchmarkName: string]: any;
      };
    } = {};

    selectedBenchmarks.forEach((benchmarkName) => {
      const trends = trendData[benchmarkName];
      if (!trends) return;

      trends.forEach((trend) => {
        const shortSha = trend.sha.substring(0, 7);
        const timestampMs = new Date(trend.timestamp).getTime();

        if (!commitMap[trend.sha]) {
          commitMap[trend.sha] = {
            commitSha: shortSha,
            timestamp: new Date(trend.timestamp).toLocaleDateString(),
            fullVersion: trend.python_version,
            sortTimestamp: timestampMs,
          };
        }

        // Add the metric value for this benchmark
        commitMap[trend.sha][benchmarkName] =
          selectedMetric === 'high_watermark_bytes'
            ? trend.high_watermark_bytes
            : trend.total_allocated_bytes;
      });
    });

    Object.values(commitMap).forEach((dataPoint) => {
      selectedBenchmarks.forEach((benchmark) => {
        if (!(benchmark in dataPoint)) {
          dataPoint[benchmark] = undefined;
        }
      });
    });

    // Sort by timestamp
    const sortedData = Object.values(commitMap).sort(
      (a, b) => a.sortTimestamp - b.sortTimestamp
    );

    return sortedData;
  }, [trendData, selectedBenchmarks, selectedMetric]);

  // Calculate Y-axis domain for auto-scaling
  const yAxisDomain = useMemo(() => {
    if (chartData.length === 0 || selectedBenchmarks.length === 0) {
      return ['auto', 'auto'];
    }

    let min = Infinity;
    let max = -Infinity;

    chartData.forEach((dataPoint) => {
      selectedBenchmarks.forEach((benchmark) => {
        const value = dataPoint[benchmark];
        if (typeof value === 'number' && !isNaN(value)) {
          min = Math.min(min, value);
          max = Math.max(max, value);
        }
      });
    });

    if (min === Infinity || max === -Infinity) {
      return ['auto', 'auto'];
    }

    const padding = (max - min) * 0.1;
    const domainMin = Math.max(0, min - padding); // Don't go below 0 for memory values
    const domainMax = max + padding;

    return [domainMin, domainMax];
  }, [chartData, selectedBenchmarks]);

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

    // Create CSV headers
    const headers = [
      'Commit SHA',
      'Timestamp',
      'Message',
      'Python Version',
      ...selectedBenchmarks,
    ];

    // Create CSV rows
    const rows = chartData.map((dataPoint) => [
      dataPoint.commitSha,
      dataPoint.timestamp,
      `"${dataPoint.commitMessage}"`, // Quote message to handle commas
      dataPoint.fullVersion || '',
      ...selectedBenchmarks.map((benchmark) => {
        const value = dataPoint[benchmark];
        return typeof value === 'number' ? value : '';
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
      `benchmark-trends-${new Date().toISOString().split('T')[0]}.csv`
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
            scale: 2, // Higher resolution
            useCORS: true,
          })
          .then((canvas) => {
            const link = document.createElement('a');
            link.download = `benchmark-trends-${
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

  const lineColors = [
    '#8884d8',
    '#82ca9d',
    '#ffc658',
    '#ff7300',
    '#00C49F',
    '#FFBB28',
    '#FF8042',
    '#0088FE',
    '#00C49F',
    '#FFBB28',
  ];

  if (!mounted || loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Benchmark Trends</h1>
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-32 animate-pulse bg-muted rounded-md"></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Chart</CardTitle>
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
        <h1 className="text-3xl font-bold font-headline">Benchmark Trends</h1>
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
      <h1 className="text-3xl font-bold font-headline">Benchmark Trends</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Select binary flags, environment, Python version (Major.Minor),
            metric, and benchmarks to visualize trends.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step indicator */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                1
              </div>
              <span>Select Binary</span>
            </div>
            <div className="flex-1 h-px bg-border"></div>
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedBinaryId && availableEnvironments.length > 0
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                2
              </div>
              <span>Select Environment</span>
            </div>
            <div className="flex-1 h-px bg-border"></div>
            <div className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedBinaryId &&
                  availableEnvironments.length > 0 &&
                  selectedEnvironmentId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                3
              </div>
              <span>Configure & View</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Binary Selection */}
            <div>
              <Label
                htmlFor="binary-select"
                className="flex items-center gap-2"
              >
                <div className="w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  1
                </div>
                Binary Flags
              </Label>
              <Select
                value={selectedBinaryId}
                onValueChange={setSelectedBinaryId}
              >
                <SelectTrigger id="binary-select">
                  <SelectValue placeholder="Select Binary Flags" />
                </SelectTrigger>
                <SelectContent>
                  {binaries.map((binary) => (
                    <SelectItem key={binary.id} value={binary.id}>
                      {binary.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Step 2: Environment Selection */}
            <div>
              <Label
                htmlFor="environment-select"
                className="flex items-center gap-2"
              >
                <div
                  className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                    selectedBinaryId && availableEnvironments.length > 0
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  2
                </div>
                Environment
              </Label>
              <Select
                value={selectedEnvironmentId}
                onValueChange={setSelectedEnvironmentId}
                disabled={
                  !selectedBinaryId || availableEnvironments.length === 0
                }
              >
                <SelectTrigger
                  id="environment-select"
                  className={
                    !selectedBinaryId || availableEnvironments.length === 0
                      ? 'opacity-50'
                      : ''
                  }
                >
                  <SelectValue
                    placeholder={
                      !selectedBinaryId
                        ? 'First select a binary'
                        : availableEnvironments.length === 0
                        ? 'No environments available for this binary'
                        : 'Select Environment'
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableEnvironments.map((environment) => (
                    <SelectItem key={environment.id} value={environment.id}>
                      {environment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Step 3: Additional Configuration */}
          <div className="border-t pt-6">
            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <div
                className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedBinaryId &&
                  availableEnvironments.length > 0 &&
                  selectedEnvironmentId
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                3
              </div>
              Additional Configuration
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label htmlFor="python-version-select">
                  Python Version (Major.Minor)
                </Label>
                <Select
                  value={selectedPythonVersionKey}
                  onValueChange={setSelectedPythonVersionKey}
                  disabled={
                    !selectedBinaryId ||
                    availableEnvironments.length === 0 ||
                    !selectedEnvironmentId
                  }
                >
                  <SelectTrigger
                    id="python-version-select"
                    className={
                      !selectedBinaryId ||
                      availableEnvironments.length === 0 ||
                      !selectedEnvironmentId
                        ? 'opacity-50'
                        : ''
                    }
                  >
                    <SelectValue
                      placeholder={
                        !selectedBinaryId
                          ? 'Select binary first'
                          : availableEnvironments.length === 0
                          ? 'No environments available'
                          : !selectedEnvironmentId
                          ? 'Select environment first'
                          : 'Select Python Version'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {pythonVersionOptions.map((v) => (
                      <SelectItem key={v.label} value={v.label}>
                        <div className="flex items-center gap-2">
                          <Code2 className="h-4 w-4 text-primary/80" />{' '}
                          {v.label}
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
                  disabled={
                    !selectedBinaryId ||
                    availableEnvironments.length === 0 ||
                    !selectedEnvironmentId
                  }
                >
                  <SelectTrigger
                    id="metric-select"
                    className={
                      !selectedBinaryId ||
                      availableEnvironments.length === 0 ||
                      !selectedEnvironmentId
                        ? 'opacity-50'
                        : ''
                    }
                  >
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
          </div>

          {/* Benchmark Selection */}
          <div className="border-t pt-6">
            <Label>Benchmarks (Select up to {lineColors.length})</Label>
            <Input
              placeholder="Search benchmarks..."
              value={benchmarkSearch}
              onChange={(e) => setBenchmarkSearch(e.target.value)}
              className="mb-2"
              disabled={loading || allBenchmarkNames.length === 0}
            />
            <ScrollArea className="h-40 rounded-md border p-2">
              {loading || dataProcessing ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
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
                    Try selecting a different binary, environment, or Python
                    version
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
                  {displayedBenchmarkNames.map((name) => (
                    <div key={name} className="flex items-center space-x-2">
                      <Checkbox
                        id={`bench-${name}`}
                        checked={selectedBenchmarks.includes(name)}
                        onCheckedChange={() => handleBenchmarkSelection(name)}
                        disabled={
                          !selectedBenchmarks.includes(name) &&
                          selectedBenchmarks.length >= lineColors.length
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
            {selectedBenchmarks.length >= lineColors.length && (
              <p className="text-xs text-muted-foreground mt-1">
                Maximum number of benchmarks selected for visualization.
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
              Trend Chart
            </CardTitle>
            <CardDescription>
              Showing{' '}
              {METRIC_OPTIONS.find((m) => m.value === selectedMetric)?.label}{' '}
              for {binaries.find((b) => b.id === selectedBinaryId)?.name} in{' '}
              {environments.find((e) => e.id === selectedEnvironmentId)?.name}{' '}
              on Python {selectedPythonVersionKey}.x.
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
                <p className="text-lg font-medium">Processing data...</p>
                <p className="text-sm text-muted-foreground">
                  Loading benchmark results for{' '}
                  {binaries.find((b) => b.id === selectedBinaryId)?.name ||
                    'selected binary'}
                </p>
              </div>
            </div>
          ) : chartData.length > 0 && selectedBenchmarks.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
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
                  tickFormatter={(value, index) =>
                    chartData[index]?.commitSha || value
                  }
                />
                <YAxis
                  domain={yAxisDomain}
                  tickFormatter={(value) => formatBytes(value)}
                />
                <Tooltip
                  formatter={(value: number, name: string, props) => {
                    const displayName = name.replace(/_/g, ' ');
                    const formattedValue = formatBytes(value);
                    // props.payload.fullVersion comes from the commit's python_version
                    const fullVersion = props.payload.fullVersion
                      ? `(py ${props.payload.fullVersion})`
                      : '';
                    return [`${formattedValue} ${fullVersion}`, displayName];
                  }}
                  labelFormatter={(label, payload) => {
                    // label is commitSha here
                    const commitData = payload?.[0]?.payload;
                    if (
                      commitData &&
                      commitData.commitSha &&
                      commitData.fullVersion
                    ) {
                      const message = commitData.commitMessage || '';
                      const truncatedMessage =
                        message.length > 50
                          ? `${message.substring(0, 50)}...`
                          : message;
                      return `${commitData.commitSha} (py ${commitData.fullVersion}): ${truncatedMessage}`;
                    }
                    return label || 'No data';
                  }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 'var(--radius)',
                  }}
                  itemSorter={(item) =>
                    selectedBenchmarks.indexOf(item.dataKey as string)
                  }
                />
                <Legend formatter={(value) => value.replace(/_/g, ' ')} />
                {selectedBenchmarks.map((benchName, index) => (
                  <Line
                    key={benchName}
                    type="monotone"
                    dataKey={benchName}
                    stroke={lineColors[index % lineColors.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-muted-foreground">
              <AlertCircle className="w-16 h-16 mb-4" />
              <p className="text-lg">
                No data available for the selected filters.
              </p>
              <p>
                Please select a binary, environment, Python version, metric, and
                at least one benchmark, ensuring commits exist for that
                combination.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
