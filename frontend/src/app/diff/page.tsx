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
  GitCompareArrows,
  Download,
  ArrowUpDown,
  Filter,
  AlertCircle,
  Info,
  Code2,
  BarChart3,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import type {
  DiffTableRow,
  MetricKey,
  Commit,
  Binary,
  Environment,
} from '@/lib/types';
import { METRIC_OPTIONS } from '@/lib/types';
import { api } from '@/lib/api';
import { useSearchParams } from 'next/navigation';

interface EnhancedDiffTableRow {
  benchmark_name: string;
  curr_commit_details: Commit;
  prev_commit_details?: Commit;
  curr_python_version_str: string;
  prev_python_version_str?: string;

  // High watermark data
  high_watermark_curr: number;
  high_watermark_prev?: number;
  high_watermark_delta_percent?: number;

  // Total allocated data
  total_allocated_curr: number;
  total_allocated_prev?: number;
  total_allocated_delta_percent?: number;

  // Result ID for flamegraph
  curr_result_id?: string;
}
import CommitTooltipContent from '@/components/diff/CommitTooltipContent';

type SortField =
  | 'benchmark_name'
  | 'high_watermark_delta_percent'
  | 'total_allocated_delta_percent';
type SortDirection = 'asc' | 'dsc';

function DiffTableContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [commits, setCommits] = useState<Commit[]>([]);
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [availableEnvironments, setAvailableEnvironments] = useState<
    Environment[]
  >([]);
  const [availableCommits, setAvailableCommits] = useState<Commit[]>([]);
  const [diffData, setDiffData] = useState<EnhancedDiffTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataProcessing, setDataProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPythonVersion, setSelectedPythonVersion] = useState<
    string | undefined
  >();

  const [filterBenchmarkName, setFilterBenchmarkName] = useState('');
  const [selectedCommitSha, setSelectedCommitSha] = useState<
    string | undefined
  >();
  const [selectedBinaryId, setSelectedBinaryId] = useState<
    string | undefined
  >();
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<
    string | undefined
  >();
  const [filterThreshold, setFilterThreshold] = useState(0);
  const [showOnlyRegressions, setShowOnlyRegressions] = useState(false);
  const [showOnlyImprovements, setShowOnlyImprovements] = useState(false);

  const [sortField, setSortField] = useState<SortField>(
    'high_watermark_delta_percent'
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>('dsc');

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const selectedCommitDetails = useMemo(
    () => commits.find((c) => c.sha === selectedCommitSha),
    [selectedCommitSha, commits]
  );
  const selectedCommitPythonVersion = useMemo(
    () => selectedCommitDetails?.python_version,
    [selectedCommitDetails]
  );
  const previousCommitDetails = useMemo(() => {
    if (!diffData.length) return undefined;
    return diffData[0].prev_commit_details;
  }, [diffData]);

  // Get unique Python versions from commits
  const availablePythonVersions = useMemo(() => {
    const versions = new Set<string>();
    commits.forEach((commit) => {
      const version = `${commit.python_version.major}.${commit.python_version.minor}`;
      versions.add(version);
    });
    return Array.from(versions).sort((a, b) => b.localeCompare(a)); // Sort descending
  }, [commits]);

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

        // Set initial selections from URL params or defaults
        const urlCommitSha = searchParams.get('commit_sha');
        const urlBinaryId = searchParams.get('binary_id');
        const urlEnvironmentId = searchParams.get('environment_id');

        if (urlCommitSha && commitsData.find((c) => c.sha === urlCommitSha)) {
          setSelectedCommitSha(urlCommitSha);
        } else if (commitsData.length > 0) {
          setSelectedCommitSha(commitsData[0].sha);
        }

        if (urlBinaryId && binariesData.find((b) => b.id === urlBinaryId)) {
          setSelectedBinaryId(urlBinaryId);
        } else if (binariesData.length > 0) {
          setSelectedBinaryId(binariesData[0].id);
        }

        if (
          urlEnvironmentId &&
          environmentsData.find((e) => e.id === urlEnvironmentId)
        ) {
          setSelectedEnvironmentId(urlEnvironmentId);
        } else if (environmentsData.length > 0) {
          setSelectedEnvironmentId(environmentsData[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    if (mounted) {
      loadData();
    }
  }, [mounted, searchParams]);

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

  // Update available commits when binary, environment, and Python version are selected
  useEffect(() => {
    async function updateAvailableCommits() {
      if (!selectedBinaryId || !selectedEnvironmentId) {
        setAvailableCommits([]);
        return;
      }

      try {
        const commitsForBinaryAndEnv = await api.getCommitsForBinaryAndEnvironment(
          selectedBinaryId,
          selectedEnvironmentId
        );
        let filteredCommits = commits.filter((commit) =>
          commitsForBinaryAndEnv.some(
            (commitData) => commitData.sha === commit.sha
          )
        );

        // Further filter by Python version if selected
        if (selectedPythonVersion) {
          filteredCommits = filteredCommits.filter((commit) => {
            const version = `${commit.python_version.major}.${commit.python_version.minor}`;
            return version === selectedPythonVersion;
          });
        }

        setAvailableCommits(filteredCommits);

        // Reset commit selection if current one is not available
        if (
          selectedCommitSha &&
          !filteredCommits.find((c) => c.sha === selectedCommitSha)
        ) {
          setSelectedCommitSha(
            filteredCommits.length > 0 ? filteredCommits[0].sha : undefined
          );
        }
      } catch (err) {
        console.error(
          'Failed to load commits for binary and environment:',
          err
        );
        setAvailableCommits([]);
      }
    }

    updateAvailableCommits();
  }, [
    selectedBinaryId,
    selectedEnvironmentId,
    selectedPythonVersion,
    commits,
    selectedCommitSha,
  ]);

  // Load diff data when selections change
  useEffect(() => {
    async function loadDiffData() {
      if (!selectedCommitSha || !selectedBinaryId || !selectedEnvironmentId) {
        setDiffData([]);
        return;
      }

      try {
        setDataProcessing(true);
        // Fetch diff data for both metrics
        const [highWatermarkData, totalAllocatedData] = await Promise.all([
          api.getDiffTable({
            commit_sha: selectedCommitSha,
            binary_id: selectedBinaryId,
            environment_id: selectedEnvironmentId,
            metric_key: 'high_watermark_bytes',
          }),
          api.getDiffTable({
            commit_sha: selectedCommitSha,
            binary_id: selectedBinaryId,
            environment_id: selectedEnvironmentId,
            metric_key: 'total_allocated_bytes',
          }),
        ]);

        // Combine the data into enhanced rows
        const enhancedData: EnhancedDiffTableRow[] = [];
        const benchmarkNames = new Set([
          ...highWatermarkData.map((r) => r.benchmark_name),
          ...totalAllocatedData.map((r) => r.benchmark_name),
        ]);

        benchmarkNames.forEach((benchmarkName) => {
          const hwRow = highWatermarkData.find(
            (r) => r.benchmark_name === benchmarkName
          );
          const taRow = totalAllocatedData.find(
            (r) => r.benchmark_name === benchmarkName
          );

          if (hwRow || taRow) {
            const baseRow = hwRow || taRow!;
            enhancedData.push({
              benchmark_name: benchmarkName,
              curr_commit_details: baseRow.curr_commit_details,
              prev_commit_details: baseRow.prev_commit_details,
              curr_python_version_str: baseRow.curr_python_version_str,
              prev_python_version_str: baseRow.prev_python_version_str,
              curr_result_id: baseRow.curr_result_id,

              // High watermark data
              high_watermark_curr: hwRow?.curr_metric_value || 0,
              high_watermark_prev: hwRow?.prev_metric_value,
              high_watermark_delta_percent: hwRow?.metric_delta_percent,

              // Total allocated data
              total_allocated_curr: taRow?.curr_metric_value || 0,
              total_allocated_prev: taRow?.prev_metric_value,
              total_allocated_delta_percent: taRow?.metric_delta_percent,
            });
          }
        });

        setDiffData(enhancedData);
      } catch (err) {
        console.error('Error loading diff data:', err);
        setDiffData([]);
      } finally {
        setDataProcessing(false);
      }
    }

    loadDiffData();
  }, [selectedCommitSha, selectedBinaryId, selectedEnvironmentId]);

  const filteredAndSortedData = useMemo(() => {
    let data = [...diffData];

    if (filterBenchmarkName) {
      data = data.filter((row) =>
        row.benchmark_name
          .toLowerCase()
          .includes(filterBenchmarkName.toLowerCase())
      );
    }

    if (filterThreshold > 0) {
      data = data.filter(
        (row) =>
          (row.high_watermark_delta_percent !== undefined &&
            Math.abs(row.high_watermark_delta_percent) >= filterThreshold) ||
          (row.total_allocated_delta_percent !== undefined &&
            Math.abs(row.total_allocated_delta_percent) >= filterThreshold)
      );
    }
    if (showOnlyRegressions) {
      data = data.filter(
        (row) =>
          (row.high_watermark_delta_percent !== undefined &&
            row.high_watermark_delta_percent > 0) ||
          (row.total_allocated_delta_percent !== undefined &&
            row.total_allocated_delta_percent > 0)
      );
    }
    if (showOnlyImprovements) {
      data = data.filter(
        (row) =>
          (row.high_watermark_delta_percent !== undefined &&
            row.high_watermark_delta_percent < 0) ||
          (row.total_allocated_delta_percent !== undefined &&
            row.total_allocated_delta_percent < 0)
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
        case 'high_watermark_delta_percent':
          compareA =
            a.high_watermark_delta_percent === undefined
              ? sortDirection === 'dsc'
                ? -Infinity
                : Infinity
              : a.high_watermark_delta_percent;
          compareB =
            b.high_watermark_delta_percent === undefined
              ? sortDirection === 'dsc'
                ? -Infinity
                : Infinity
              : b.high_watermark_delta_percent;
          break;
        case 'total_allocated_delta_percent':
          compareA =
            a.total_allocated_delta_percent === undefined
              ? sortDirection === 'dsc'
                ? -Infinity
                : Infinity
              : a.total_allocated_delta_percent;
          compareB =
            b.total_allocated_delta_percent === undefined
              ? sortDirection === 'dsc'
                ? -Infinity
                : Infinity
              : b.total_allocated_delta_percent;
          break;
        default:
          return 0;
      }

      if (compareA < compareB) return sortDirection === 'asc' ? -1 : 1;
      if (compareA > compareB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return data;
  }, [
    diffData,
    filterBenchmarkName,
    filterThreshold,
    showOnlyRegressions,
    showOnlyImprovements,
    sortField,
    sortDirection,
  ]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'dsc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('dsc');
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

  const formatDelta = (delta: number | undefined | null) => {
    if (delta === undefined || delta === null)
      return <span className="text-muted-foreground">N/A</span>;
    if (delta === Infinity)
      return (
        <span className="text-red-600 dark:text-red-400 font-semibold">
          New (Prev N/A or Zero)
        </span>
      );
    const sign = delta > 0 ? '+' : '';
    return `${sign}${delta.toFixed(2)}%`;
  };

  const getDeltaColor = (delta: number | undefined | null) => {
    if (delta === undefined || delta === null) return 'text-muted-foreground';
    if (delta === Infinity)
      return 'text-red-600 dark:text-red-400 font-semibold';
    if (delta > 5) return 'text-red-600 dark:text-red-400 font-semibold';
    if (delta > 0) return 'text-orange-500 dark:text-orange-400';
    if (delta < -5) return 'text-green-600 dark:text-green-400 font-semibold';
    if (delta < 0) return 'text-emerald-500 dark:text-emerald-400';
    return 'text-foreground';
  };

  const getPythonVersionDisplay = (versionStr?: string) => {
    return versionStr ? `(py ${versionStr})` : '';
  };

  if (!mounted || loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold font-headline">
          Inspect Run Results
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
            <CardTitle>Results Table</CardTitle>
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
        <h1 className="text-3xl font-bold font-headline">
          Inspect Run Results
        </h1>
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
        <h1 className="text-3xl font-bold font-headline">
          Inspect Run Results
        </h1>
        <p className="text-muted-foreground">
          Select a run to inspect its memory metrics and compare with the
          previous run under the same Python version, binary configuration, and
          environment.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" /> Filters
            </CardTitle>
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
                <span>Filter Version</span>
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
                  4
                </div>
                <span>Select Run</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
              {/* Step 1: Binary Selection */}
              <div className="space-y-3">
                <Label
                  htmlFor="filter-binary"
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

              {/* Step 2: Environment Selection */}
              <div className="space-y-3">
                <Label
                  htmlFor="filter-environment"
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

              {/* Step 3: Python Version Filter */}
              <div className="space-y-3">
                <Label
                  htmlFor="filter-python-version"
                  className="flex items-center gap-2"
                >
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
                  Python Version (Optional)
                </Label>
                <Select
                  value={selectedPythonVersion || 'all'}
                  onValueChange={(value) =>
                    setSelectedPythonVersion(
                      value === 'all' ? undefined : value
                    )
                  }
                  disabled={
                    !selectedBinaryId ||
                    availableEnvironments.length === 0 ||
                    !selectedEnvironmentId
                  }
                >
                  <SelectTrigger
                    id="filter-python-version"
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
                          : 'All Versions'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Versions</SelectItem>
                    {availablePythonVersions.map((version) => (
                      <SelectItem key={version} value={version}>
                        Python {version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Step 4: Run Selection */}
              <div className="space-y-3">
                <Label
                  htmlFor="filter-commit"
                  className="flex items-center gap-2"
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                      selectedBinaryId &&
                      availableEnvironments.length > 0 &&
                      selectedEnvironmentId
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    4
                  </div>
                  Run
                </Label>
                <Select
                  value={selectedCommitSha}
                  onValueChange={setSelectedCommitSha}
                  disabled={
                    !selectedBinaryId ||
                    availableEnvironments.length === 0 ||
                    !selectedEnvironmentId
                  }
                >
                  <SelectTrigger
                    id="filter-commit"
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
                          : 'Select Run'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCommits.map((commit) => (
                      <SelectItem key={commit.sha} value={commit.sha}>
                        <div className="flex items-center gap-2">
                          {commit.sha.substring(0, 7)}
                          <span className="text-xs text-muted-foreground truncate">
                            (py {commit.python_version.major}.
                            {commit.python_version.minor}.
                            {commit.python_version.patch},{' '}
                            {commit.message.substring(0, 30)}
                            {commit.message.length > 30 ? '...' : ''})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCommitDetails && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs px-2 py-1 h-auto text-muted-foreground"
                          >
                            <Info className="h-3 w-3 mr-1" /> View Run Details
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start">
                          <CommitTooltipContent
                            commit={selectedCommitDetails}
                          />
                        </TooltipContent>
                      </Tooltip>
                      {selectedCommitPythonVersion && (
                        <span className="text-xs text-muted-foreground flex items-center">
                          <Code2 className="h-3 w-3 mr-1 text-primary" /> Python{' '}
                          {selectedCommitPythonVersion.major}.
                          {selectedCommitPythonVersion.minor}.
                          {selectedCommitPythonVersion.patch}
                        </span>
                      )}
                    </div>
                    {previousCommitDetails && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                          Previous run:
                        </span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="font-mono cursor-help">
                              {previousCommitDetails.sha.substring(0, 7)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" align="start">
                            <CommitTooltipContent
                              commit={previousCommitDetails}
                            />
                          </TooltipContent>
                        </Tooltip>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs px-2 py-1 h-auto"
                          onClick={() =>
                            setSelectedCommitSha(previousCommitDetails.sha)
                          }
                        >
                          Inspect Previous
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Additional Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start border-t pt-6">
              <div className="space-y-3">
                <Label htmlFor="filter-benchmark-name">Benchmark Name</Label>
                <Input
                  id="filter-benchmark-name"
                  placeholder="e.g., pyperformance_go"
                  value={filterBenchmarkName}
                  onChange={(e) => setFilterBenchmarkName(e.target.value)}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="filter-threshold">
                  Min. Change Threshold (%)
                </Label>
                <Input
                  id="filter-threshold"
                  type="number"
                  placeholder="e.g., 5"
                  value={filterThreshold}
                  onChange={(e) => setFilterThreshold(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="show-regressions"
                  checked={showOnlyRegressions}
                  onCheckedChange={(c) => setShowOnlyRegressions(c as boolean)}
                />
                <Label htmlFor="show-regressions">Only Regressions</Label>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="show-improvements"
                  checked={showOnlyImprovements}
                  onCheckedChange={(c) => setShowOnlyImprovements(c as boolean)}
                />
                <Label htmlFor="show-improvements">Only Improvements</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <GitCompareArrows className="h-6 w-6 text-primary" />
                Run Results Table
              </CardTitle>
              {selectedCommitDetails && selectedCommitPythonVersion && (
                <CardDescription className="mt-2 space-y-2">
                  <div>
                    Showing {filteredAndSortedData.length} benchmark results for
                    run{' '}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="font-mono cursor-help">
                          {selectedCommitSha?.substring(0, 7)}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <CommitTooltipContent commit={selectedCommitDetails} />
                      </TooltipContent>
                    </Tooltip>
                    (Python {selectedCommitPythonVersion.major}.
                    {selectedCommitPythonVersion.minor}.
                    {selectedCommitPythonVersion.patch})
                  </div>
                  <div>
                    Binary Configuration:{' '}
                    {binaries.find((b) => b.id === selectedBinaryId)?.name}
                  </div>
                  <div>
                    Environment:{' '}
                    {
                      environments.find((e) => e.id === selectedEnvironmentId)
                        ?.name
                    }
                  </div>
                  <div className="text-muted-foreground">
                    Displaying both high watermark and total allocated bytes
                    with percentage changes.
                  </div>
                </CardDescription>
              )}
            </div>
            <Button variant="outline" size="sm" disabled>
              <Download className="mr-2 h-4 w-4" />
              Export (CSV)
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {dataProcessing ? (
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">
                        Benchmark Name
                      </TableHead>
                      <TableHead className="text-center" colSpan={3}>
                        High Watermark (Bytes)
                      </TableHead>
                      <TableHead className="text-center" colSpan={3}>
                        Total Allocated (Bytes)
                      </TableHead>
                      <TableHead className="text-center">Flamegraph</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Delta
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Previous
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Current
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Delta
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Previous
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Current
                      </TableHead>
                      <TableHead className="text-center">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...Array(8)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                        <TableCell>
                          <div className="h-4 bg-muted rounded animate-pulse"></div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="w-16 h-8 bg-muted rounded animate-pulse mx-auto"></div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : filteredAndSortedData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer whitespace-nowrap"
                        onClick={() => handleSort('benchmark_name')}
                      >
                        Benchmark Name {getSortIndicator('benchmark_name')}
                      </TableHead>
                      <TableHead className="text-center" colSpan={3}>
                        High Watermark (Bytes)
                      </TableHead>
                      <TableHead className="text-center" colSpan={3}>
                        Total Allocated (Bytes)
                      </TableHead>
                      <TableHead className="text-center">Flamegraph</TableHead>
                    </TableRow>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead
                        className="text-right cursor-pointer whitespace-nowrap"
                        onClick={() =>
                          handleSort('high_watermark_delta_percent')
                        }
                      >
                        Delta {getSortIndicator('high_watermark_delta_percent')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Previous
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Current
                      </TableHead>
                      <TableHead
                        className="text-right cursor-pointer whitespace-nowrap"
                        onClick={() =>
                          handleSort('total_allocated_delta_percent')
                        }
                      >
                        Delta{' '}
                        {getSortIndicator('total_allocated_delta_percent')}
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Previous
                      </TableHead>
                      <TableHead className="text-right whitespace-nowrap">
                        Current
                      </TableHead>
                      <TableHead className="text-center">View</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAndSortedData.map((row, index) => (
                      <TableRow
                        key={`${row.benchmark_name}-${row.curr_commit_details.sha}-${index}`}
                      >
                        <TableCell className="font-medium">
                          {row.benchmark_name}
                        </TableCell>

                        {/* High Watermark columns */}
                        <TableCell
                          className={`text-right ${getDeltaColor(
                            row.high_watermark_delta_percent
                          )}`}
                        >
                          {formatDelta(row.high_watermark_delta_percent)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.high_watermark_prev !== undefined &&
                          row.high_watermark_prev !== null ? (
                            row.high_watermark_prev.toLocaleString()
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.high_watermark_curr.toLocaleString()}
                        </TableCell>

                        {/* Total Allocated columns */}
                        <TableCell
                          className={`text-right ${getDeltaColor(
                            row.total_allocated_delta_percent
                          )}`}
                        >
                          {formatDelta(row.total_allocated_delta_percent)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.total_allocated_prev !== undefined &&
                          row.total_allocated_prev !== null ? (
                            row.total_allocated_prev.toLocaleString()
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {row.total_allocated_curr.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.curr_result_id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                router.push(`/flamegraph/${row.curr_result_id}`)
                              }
                            >
                              <BarChart3 className="h-4 w-4" />
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-sm">
                              N/A
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <AlertCircle className="w-12 h-12 mb-4" />
                <p className="text-lg">
                  No comparisons match your current filters or data is
                  unavailable.
                </p>
                <p className="text-sm mt-2">
                  Ensure the selected commit has a predecessor with comparable
                  data for the same Python major.minor version, chosen binary,
                  environment, and metric.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}

export default function DiffTablePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <h1 className="text-3xl font-bold font-headline">
            Inspect Run Results
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
              <CardTitle>Results Table</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 animate-pulse bg-muted rounded-md"></div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <DiffTableContent />
    </Suspense>
  );
}
