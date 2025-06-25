'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  GitBranch,
  Download,
  ArrowUpDown,
  Filter,
  AlertCircle,
  Info,
  Code2,
  BarChart3,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Commit, Binary, Environment } from '@/lib/types';
import type {
  TrendDataPoint,
  BatchTrendsResponse,
  BenchmarkNamesQueryParams,
  TrendQueryParams,
} from '@/types/api';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface VersionComparisonRow {
  benchmark_name: string;
  commit_details: Commit;
  python_version_str: string;
  high_watermark_bytes: number;
  total_allocated_bytes: number;
  result_id?: string;
}

interface ComparisonMatrix {
  benchmark_name: string;
  versions: Map<string, VersionComparisonRow>; // Key is python version like "3.13", "3.12"
}

type SortField = 'benchmark_name';
type SortDirection = 'asc' | 'dsc';

function VersionComparisonContent() {
  const router = useRouter();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [availableEnvironments, setAvailableEnvironments] = useState<
    Environment[]
  >([]);
  const [availablePythonVersions, setAvailablePythonVersions] = useState<
    string[]
  >([]);
  const [latestCommitPerVersion, setLatestCommitPerVersion] = useState<
    Map<string, Commit>
  >(new Map());
  const [comparisonData, setComparisonData] = useState<ComparisonMatrix[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataProcessing, setDataProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filterBenchmarkName, setFilterBenchmarkName] = useState('');
  const [selectedBinaryId, setSelectedBinaryId] = useState<
    string | undefined
  >();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<
    string | undefined
  >();
  const [selectedVersions, setSelectedVersions] = useState<Set<string>>(
    new Set()
  );
  const [baselineVersion, setBaselineVersion] = useState<string | undefined>();
  const [sortField, setSortField] = useState<SortField>('benchmark_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const [mounted, setMounted] = useState(false);
  const { toast } = useToast();
  useEffect(() => setMounted(true), []);

  // Toggle version selection
  const toggleVersionSelection = (version: string) => {
    const newSelection = new Set(selectedVersions);
    if (newSelection.has(version)) {
      newSelection.delete(version);
      // If we're removing the baseline version, set a new baseline
      if (version === baselineVersion) {
        const remainingVersions = Array.from(newSelection).sort((a, b) => {
          const [aMajor, aMinor] = a.split('.').map(Number);
          const [bMajor, bMinor] = b.split('.').map(Number);
          if (aMajor !== bMajor) return bMajor - aMajor;
          return bMinor - aMinor;
        });
        setBaselineVersion(remainingVersions[0] || undefined);
      }
    } else {
      // Check if we're at the maximum limit
      if (newSelection.size >= 5) {
        return; // Don't add more versions if at limit
      }
      newSelection.add(version);
      // If no baseline is set, set this as baseline
      if (!baselineVersion) {
        setBaselineVersion(version);
      }
    }
    setSelectedVersions(newSelection);
  };

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);

        const [
          commitsData,
          binariesData,
          environmentsData,
        ] = await Promise.all([
          api.getCommits(0, 100),
          api.getBinaries(),
          api.getEnvironments(),
        ]);

        setCommits(commitsData);
        setBinaries(binariesData);
        setEnvironments(environmentsData);

        // Set defaults
        if (binariesData.length > 0) {
          setSelectedBinaryId(binariesData[0].id);
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load data';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    }

    if (mounted) {
      loadData();
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

        if (filteredEnvironments.length > 0 && !selectedEnvironmentId) {
          setSelectedEnvironmentId(filteredEnvironments[0].id);
        }
      } catch (err) {
        console.error('Failed to load environments for binary:', err);
        setAvailableEnvironments([]);
        toast({
          title: 'Error',
          description: 'Failed to load environments for selected binary',
          variant: 'destructive',
        });
      }
    }

    updateAvailableEnvironments();
  }, [selectedBinaryId, environments, selectedEnvironmentId]);

  // Find latest commit for each Python version when binary and environment are selected
  useEffect(() => {
    async function findLatestCommitsPerVersion() {
      if (!selectedBinaryId || !selectedEnvironmentId) {
        setAvailablePythonVersions([]);
        setLatestCommitPerVersion(new Map());
        return;
      }

      try {
        const commitsForBinaryAndEnv = await api.getCommitsForBinaryAndEnvironment(
          selectedBinaryId,
          selectedEnvironmentId
        );

        // Filter commits that exist in our data
        const filteredCommits = commits.filter((commit) =>
          commitsForBinaryAndEnv.some(
            (commitData) => commitData.sha === commit.sha
          )
        );

        // Group by Python version and find latest for each
        const versionMap = new Map<string, Commit>();
        const versions = new Set<string>();

        filteredCommits.forEach((commit) => {
          const version = `${commit.python_version.major}.${commit.python_version.minor}`;
          versions.add(version);

          const existing = versionMap.get(version);
          if (
            !existing ||
            new Date(commit.timestamp) > new Date(existing.timestamp)
          ) {
            versionMap.set(version, commit);
          }
        });

        const sortedVersions = Array.from(versions).sort((a, b) => {
          // Sort versions numerically (e.g., 3.13 > 3.12 > 3.11)
          const [aMajor, aMinor] = a.split('.').map(Number);
          const [bMajor, bMinor] = b.split('.').map(Number);
          if (aMajor !== bMajor) return bMajor - aMajor;
          return bMinor - aMinor;
        });

        setAvailablePythonVersions(sortedVersions);
        setLatestCommitPerVersion(versionMap);

        // Auto-select up to 5 versions by default (latest ones)
        const defaultSelections = sortedVersions.slice(0, 5);
        setSelectedVersions(new Set(defaultSelections));

        // Set the highest version as default baseline
        if (sortedVersions.length > 0 && !baselineVersion) {
          setBaselineVersion(sortedVersions[0]);
        }
      } catch (err) {
        console.error(
          'Failed to load commits for binary and environment:',
          err
        );
        setAvailablePythonVersions([]);
        toast({
          title: 'Error',
          description: 'Failed to load commits for binary and environment',
          variant: 'destructive',
        });
        setLatestCommitPerVersion(new Map());
      }
    }

    findLatestCommitsPerVersion();
  }, [selectedBinaryId, selectedEnvironmentId, commits]);

  // Load comparison data when selections change
  useEffect(() => {
    async function loadComparisonData() {
      if (
        !selectedBinaryId ||
        !selectedEnvironmentId ||
        latestCommitPerVersion.size === 0 ||
        selectedVersions.size === 0
      ) {
        setComparisonData([]);
        return;
      }

      try {
        setDataProcessing(true);

        // Get the selected commits (latest commit for each selected Python version)
        const selectedCommits = Array.from(selectedVersions)
          .map((version) => latestCommitPerVersion.get(version))
          .filter((commit): commit is Commit => commit !== undefined);

        if (selectedCommits.length === 0) {
          setComparisonData([]);
          return;
        }

        // Get all benchmark names first
        const benchmarkNamesQuery: BenchmarkNamesQueryParams = {
          environment_id: selectedEnvironmentId,
          binary_id: selectedBinaryId,
          python_major: selectedCommits[0].python_version.major,
          python_minor: selectedCommits[0].python_version.minor,
        };
        const benchmarkNames = await api.getBenchmarkNames(benchmarkNamesQuery);

        // Create trend queries for each benchmark and each selected version
        const allTrendQueries: TrendQueryParams[] = benchmarkNames.flatMap(
          (benchmarkName) =>
            selectedCommits.map((commit) => ({
              benchmark_name: benchmarkName,
              binary_id: selectedBinaryId,
              environment_id: selectedEnvironmentId,
              python_major: commit.python_version.major,
              python_minor: commit.python_version.minor,
              limit: 50, // Get recent trends to find the exact commit
            }))
        );

        // Get trend data for all benchmark/commit combinations
        const batchResults: BatchTrendsResponse = await api.getBatchBenchmarkTrends(
          allTrendQueries
        );

        // Process the results into comparison matrix
        const matrixMap = new Map<string, ComparisonMatrix>();

        Object.entries(batchResults.results).forEach(
          ([queryKey, trends]: [string, TrendDataPoint[]]) => {
            if (trends.length === 0) return;

            // Extract benchmark name from query key and remove any binary prefix
            let benchmarkName = queryKey.split('|')[0];
            // Check if the benchmark name has a binary prefix (pattern: binaryId:benchmarkName)
            if (benchmarkName.includes(':')) {
              benchmarkName = benchmarkName.split(':')[1]; // Take the part after the colon
            }

            // Find the trend data for each selected commit
            selectedCommits.forEach((commit) => {
              const commitTrend: TrendDataPoint | undefined = trends.find(
                (trend) => trend.sha === commit.sha
              );
              if (!commitTrend) return;

              const version = `${commit.python_version.major}.${commit.python_version.minor}`;

              if (!matrixMap.has(benchmarkName)) {
                matrixMap.set(benchmarkName, {
                  benchmark_name: benchmarkName,
                  versions: new Map(),
                });
              }

              const matrix = matrixMap.get(benchmarkName)!;
              matrix.versions.set(version, {
                benchmark_name: benchmarkName,
                commit_details: commit,
                python_version_str: commitTrend.python_version,
                high_watermark_bytes: commitTrend.high_watermark_bytes,
                total_allocated_bytes: commitTrend.total_allocated_bytes,
              });
            });
          }
        );

        setComparisonData(Array.from(matrixMap.values()));
      } catch (err) {
        console.error('Error loading comparison data:', err);
        setComparisonData([]);
        toast({
          title: 'Error',
          description: 'Failed to load comparison data',
          variant: 'destructive',
        });
      } finally {
        setDataProcessing(false);
      }
    }

    loadComparisonData();
  }, [
    selectedBinaryId,
    selectedEnvironmentId,
    latestCommitPerVersion,
    selectedVersions,
  ]);

  const filteredAndSortedData = useMemo(() => {
    let data = [...comparisonData];

    if (filterBenchmarkName) {
      data = data.filter((row) =>
        row.benchmark_name
          .toLowerCase()
          .includes(filterBenchmarkName.toLowerCase())
      );
    }

    data.sort((a, b) => {
      let compareA: any;
      let compareB: any;

      switch (sortField) {
        case 'benchmark_name':
          compareA = a.benchmark_name;
          compareB = b.benchmark_name;
          break;
        default:
          return 0;
      }

      if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [comparisonData, filterBenchmarkName, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'dsc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIndicator = (field: SortField) => {
    if (sortField === field) {
      return sortDirection === 'asc' ? (
        <ArrowUpDown className="ml-1 h-3 w-3 inline" />
      ) : (
        <ArrowUpDown className="ml-1 h-3 w-3 inline transform rotate-180" />
      );
    }
    return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-30" />;
  };

  const formatBytes = (bytes: number) => {
    return bytes.toLocaleString();
  };

  const getPercentageChange = (current: number, baseline: number) => {
    if (baseline === 0) return 'N/A';
    const change = ((current - baseline) / baseline) * 100;
    return `${change > 0 ? '+' : ''}${change.toFixed(1)}%`;
  };

  const getChangeColor = (current: number, baseline: number) => {
    if (baseline === 0) return 'text-muted-foreground';
    const change = ((current - baseline) / baseline) * 100;
    if (change > 5) return 'text-red-600 dark:text-red-400';
    if (change > 0) return 'text-orange-500 dark:text-orange-400';
    if (change < -5) return 'text-green-600 dark:text-green-400';
    if (change < 0) return 'text-emerald-500 dark:text-emerald-400';
    return 'text-foreground';
  };

  if (!mounted || loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Version Comparison</h1>
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 animate-pulse bg-muted rounded-md"></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Comparison Matrix</CardTitle>
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
        <h1 className="text-3xl font-bold font-headline">Version Comparison</h1>
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
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">Version Comparison</h1>
        <p className="text-muted-foreground">
          Compare memory usage across different commit versions for the same
          binary configuration and environment. See how performance changes over
          time with detailed metrics for each version.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" /> Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 items-start">
              {/* Binary Selection */}
              <div className="space-y-3">
                <Label htmlFor="filter-binary">Binary Flags</Label>
                <Select
                  value={selectedBinaryId}
                  onValueChange={setSelectedBinaryId}
                >
                  <SelectTrigger id="filter-binary">
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

              {/* Environment Selection */}
              <div className="space-y-3">
                <Label htmlFor="filter-environment">Environment</Label>
                <Select
                  value={selectedEnvironmentId}
                  onValueChange={setSelectedEnvironmentId}
                  disabled={
                    !selectedBinaryId || availableEnvironments.length === 0
                  }
                >
                  <SelectTrigger
                    id="filter-environment"
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
                          ? 'No environments available'
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

              {/* Benchmark Filter */}
              <div className="space-y-3">
                <Label htmlFor="filter-benchmark-name">Benchmark Name</Label>
                <Input
                  id="filter-benchmark-name"
                  placeholder="e.g., pyperformance_go"
                  value={filterBenchmarkName}
                  onChange={(e) => setFilterBenchmarkName(e.target.value)}
                />
              </div>
            </div>

            {/* Python Version Selection */}
            {availablePythonVersions.length > 0 && (
              <div className="border-t pt-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-4">
                  <div>
                    <Label className="text-base font-semibold">
                      Select Python Versions to Compare
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Choose which Python versions to include in the comparison
                      (maximum 5). We'll use the latest commit for each version.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-3 lg:mt-0">
                    <Label
                      htmlFor="baseline-select"
                      className="text-sm font-medium whitespace-nowrap"
                    >
                      Baseline Version:
                    </Label>
                    <Select
                      value={baselineVersion || ''}
                      onValueChange={setBaselineVersion}
                    >
                      <SelectTrigger id="baseline-select" className="w-[120px]">
                        <SelectValue placeholder="Select baseline" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(selectedVersions)
                          .sort((a, b) => {
                            const [aMajor, aMinor] = a.split('.').map(Number);
                            const [bMajor, bMinor] = b.split('.').map(Number);
                            if (aMajor !== bMajor) return bMajor - aMajor;
                            return bMinor - aMinor;
                          })
                          .map((version) => (
                            <SelectItem key={version} value={version}>
                              Python {version}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {availablePythonVersions.map((version) => {
                    const commit = latestCommitPerVersion.get(version);
                    return (
                      <div key={version} className="flex flex-col gap-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id={`version-${version}`}
                            checked={selectedVersions.has(version)}
                            onCheckedChange={() =>
                              toggleVersionSelection(version)
                            }
                            disabled={
                              !selectedVersions.has(version) &&
                              selectedVersions.size >= 5
                            }
                          />
                          <Label
                            htmlFor={`version-${version}`}
                            className={`font-medium ${
                              !selectedVersions.has(version) &&
                              selectedVersions.size >= 5
                                ? 'opacity-50'
                                : ''
                            }`}
                          >
                            Python {version}
                          </Label>
                        </div>
                        {commit && (
                          <div className="text-xs text-muted-foreground pl-6">
                            Latest: {commit.sha.substring(0, 7)}
                            <br />
                            {new Date(commit.timestamp).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-6 w-6 text-primary" />
                Version Comparison Matrix
              </CardTitle>
              <CardDescription className="mt-2">
                Showing {filteredAndSortedData.length} benchmarks across{' '}
                {selectedVersions.size} Python versions. Each cell shows high
                watermark (top) and total allocated (bottom) bytes with
                percentage change from Python {baselineVersion || 'N/A'}{' '}
                (baseline).
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export (CSV)
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {dataProcessing ? (
              <div className="overflow-x-auto">
                <div className="h-96 animate-pulse bg-muted rounded-md flex items-center justify-center">
                  <p className="text-muted-foreground">
                    Loading comparison data...
                  </p>
                </div>
              </div>
            ) : filteredAndSortedData.length > 0 &&
              selectedVersions.size > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap sticky left-0 bg-background"
                        onClick={() => handleSort('benchmark_name')}
                      >
                        Benchmark {getSortIndicator('benchmark_name')}
                      </TableHead>
                      {Array.from(selectedVersions)
                        .sort((a, b) => {
                          // Sort versions numerically (descending: 3.13, 3.12, 3.11...)
                          const [aMajor, aMinor] = a.split('.').map(Number);
                          const [bMajor, bMinor] = b.split('.').map(Number);
                          if (aMajor !== bMajor) return bMajor - aMajor;
                          return bMinor - aMinor;
                        })
                        .map((version) => {
                          const commit = latestCommitPerVersion.get(version);
                          return (
                            <TableHead
                              key={version}
                              className="text-center min-w-[140px]"
                            >
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-semibold">
                                  Python {version}
                                </span>
                                {commit && (
                                  <div className="text-xs text-muted-foreground">
                                    <code>{commit.sha.substring(0, 7)}</code>
                                    <br />
                                    {new Date(
                                      commit.timestamp
                                    ).toLocaleDateString()}
                                  </div>
                                )}
                              </div>
                            </TableHead>
                          );
                        })}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedData.map((row) => {
                      // Get sorted versions and baseline data
                      const sortedVersions = Array.from(selectedVersions).sort(
                        (a, b) => {
                          const [aMajor, aMinor] = a.split('.').map(Number);
                          const [bMajor, bMinor] = b.split('.').map(Number);
                          if (aMajor !== bMajor) return bMajor - aMajor;
                          return bMinor - aMinor;
                        }
                      );
                      const baselineData = baselineVersion
                        ? row.versions.get(baselineVersion)
                        : null;

                      return (
                        <TableRow key={row.benchmark_name}>
                          <TableCell className="font-medium sticky left-0 bg-background">
                            {row.benchmark_name}
                          </TableCell>
                          {sortedVersions.map((version) => {
                            const data = row.versions.get(version);
                            const isBaseline = version === baselineVersion;

                            return (
                              <TableCell key={version} className="text-center">
                                {data ? (
                                  <div className="flex flex-col gap-1">
                                    <div className="text-xs font-mono">
                                      {formatBytes(data.high_watermark_bytes)}
                                    </div>
                                    <div className="text-xs font-mono text-muted-foreground">
                                      {formatBytes(data.total_allocated_bytes)}
                                    </div>
                                    {!isBaseline && baselineData && (
                                      <div className="flex flex-col gap-0.5">
                                        <div
                                          className={`text-xs ${getChangeColor(
                                            data.high_watermark_bytes,
                                            baselineData.high_watermark_bytes
                                          )}`}
                                        >
                                          {getPercentageChange(
                                            data.high_watermark_bytes,
                                            baselineData.high_watermark_bytes
                                          )}
                                        </div>
                                        <div
                                          className={`text-xs ${getChangeColor(
                                            data.total_allocated_bytes,
                                            baselineData.total_allocated_bytes
                                          )}`}
                                        >
                                          {getPercentageChange(
                                            data.total_allocated_bytes,
                                            baselineData.total_allocated_bytes
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {isBaseline && (
                                      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                        (baseline)
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-xs">
                                    N/A
                                  </span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p className="text-lg">No comparison data available</p>
                <p className="text-sm mt-2">
                  Select a binary and environment to see version comparisons.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

export default function VersionComparisonPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <h1 className="text-3xl font-bold font-headline">
            Version Comparison
          </h1>
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 animate-pulse bg-muted rounded-md"></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Comparison Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 animate-pulse bg-muted rounded-md"></div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <VersionComparisonContent />
    </Suspense>
  );
}
