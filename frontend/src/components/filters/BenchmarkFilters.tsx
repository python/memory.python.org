'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useDebounce } from '@/hooks/useDebounce';

interface BenchmarkFiltersProps {
  // Binary selection
  selectedBinaryId: string | null;
  onBinaryChange: (binaryId: string) => void;
  binaries: Array<{ id: string; name: string; description?: string }>;

  // Environment selection
  selectedEnvironmentId: string | null;
  onEnvironmentChange: (environmentId: string) => void;
  environments: Array<{ id: string; name: string; description?: string }>;

  // Python version filter
  selectedPythonVersion: string | null;
  onPythonVersionChange: (version: string | null) => void;
  pythonVersions: Array<{ label: string; major: number; minor: number }>;

  // Benchmark selection
  selectedBenchmarks: string[];
  onBenchmarkToggle: (benchmark: string) => void;
  onSelectAllBenchmarks: () => void;
  onClearAllBenchmarks: () => void;
  availableBenchmarks: string[];

  // Search and pagination
  benchmarkSearch: string;
  onBenchmarkSearchChange: (search: string) => void;

  // Loading states
  isLoadingBinaries?: boolean;
  isLoadingEnvironments?: boolean;
  isLoadingBenchmarks?: boolean;
}

export function BenchmarkFilters({
  selectedBinaryId,
  onBinaryChange,
  binaries,
  selectedEnvironmentId,
  onEnvironmentChange,
  environments,
  selectedPythonVersion,
  onPythonVersionChange,
  pythonVersions,
  selectedBenchmarks,
  onBenchmarkToggle,
  onSelectAllBenchmarks,
  onClearAllBenchmarks,
  availableBenchmarks,
  benchmarkSearch,
  onBenchmarkSearchChange,
  isLoadingBinaries = false,
  isLoadingEnvironments = false,
  isLoadingBenchmarks = false,
}: BenchmarkFiltersProps) {
  const debouncedSearch = useDebounce(benchmarkSearch, 300);

  const filteredBenchmarks = useMemo(() => {
    if (!debouncedSearch) return availableBenchmarks;
    return availableBenchmarks.filter((benchmark) =>
      benchmark.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [availableBenchmarks, debouncedSearch]);

  return (
    <div className="space-y-6 p-6 bg-card rounded-lg border">
      <h3 className="text-lg font-semibold">Filters</h3>

      {/* Binary Selection */}
      <div className="space-y-2">
        <Label htmlFor="binary-select">Binary Configuration</Label>
        <Select
          value={selectedBinaryId || ''}
          onValueChange={onBinaryChange}
          disabled={isLoadingBinaries}
        >
          <SelectTrigger id="binary-select">
            <SelectValue
              placeholder={isLoadingBinaries ? 'Loading...' : 'Select binary'}
            />
          </SelectTrigger>
          <SelectContent>
            {binaries.map((binary) => (
              <SelectItem key={binary.id} value={binary.id}>
                <div>
                  <div className="font-medium">{binary.name}</div>
                  {binary.description && (
                    <div className="text-sm text-muted-foreground">
                      {binary.description}
                    </div>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Environment Selection */}
      <div className="space-y-2">
        <Label htmlFor="environment-select">Environment</Label>
        <Select
          value={selectedEnvironmentId || ''}
          onValueChange={onEnvironmentChange}
          disabled={isLoadingEnvironments || !selectedBinaryId}
        >
          <SelectTrigger id="environment-select">
            <SelectValue
              placeholder={
                isLoadingEnvironments
                  ? 'Loading...'
                  : !selectedBinaryId
                  ? 'Select binary first'
                  : 'Select environment'
              }
            />
          </SelectTrigger>
          <SelectContent>
            {environments.map((env) => (
              <SelectItem key={env.id} value={env.id}>
                <div>
                  <div className="font-medium">{env.name}</div>
                  {env.description && (
                    <div className="text-sm text-muted-foreground">
                      {env.description}
                    </div>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Python Version Filter */}
      <div className="space-y-2">
        <Label htmlFor="python-version-select">Python Version (Optional)</Label>
        <Select
          value={selectedPythonVersion || 'all'}
          onValueChange={(value) =>
            onPythonVersionChange(value === 'all' ? null : value)
          }
        >
          <SelectTrigger id="python-version-select">
            <SelectValue placeholder="All versions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Versions</SelectItem>
            {pythonVersions.map((version) => (
              <SelectItem key={version.label} value={version.label}>
                Python {version.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Benchmark Selection */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Benchmarks ({selectedBenchmarks.length} selected)</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAllBenchmarks}
              disabled={filteredBenchmarks.length === 0}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearAllBenchmarks}
              disabled={selectedBenchmarks.length === 0}
            >
              Clear All
            </Button>
          </div>
        </div>

        <Input
          placeholder="Search benchmarks..."
          value={benchmarkSearch}
          onChange={(e) => onBenchmarkSearchChange(e.target.value)}
          disabled={isLoadingBenchmarks}
        />

        {isLoadingBenchmarks ? (
          <div className="text-sm text-muted-foreground">
            Loading benchmarks...
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {filteredBenchmarks.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {availableBenchmarks.length === 0
                  ? 'No benchmarks available'
                  : 'No benchmarks match your search'}
              </div>
            ) : (
              filteredBenchmarks.map((benchmark) => (
                <div key={benchmark} className="flex items-center space-x-2">
                  <Checkbox
                    id={`benchmark-${benchmark}`}
                    checked={selectedBenchmarks.includes(benchmark)}
                    onCheckedChange={() => onBenchmarkToggle(benchmark)}
                  />
                  <Label
                    htmlFor={`benchmark-${benchmark}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {benchmark}
                  </Label>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
