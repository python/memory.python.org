'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Play, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';

interface Commit {
  sha: string;
  timestamp: string;
  message: string;
  author: string;
  python_major: number;
  python_minor: number;
  python_patch: number;
}

interface Run {
  run_id: string;
  commit_sha: string;
  binary_id: string;
  environment_id: string;
  python_major: number;
  python_minor: number;
  python_patch: number;
  timestamp: string;
  commit: Commit;
}

interface RunsResponse {
  runs: Run[];
  pagination: {
    skip: number;
    limit: number;
    total: number;
    has_more: boolean;
  };
}

interface Binary {
  id: string;
  name: string;
}

interface Environment {
  id: string;
  name: string;
}

export default function RunsManager() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 50,
    total: 0,
    has_more: false,
  });
  const { toast } = useToast();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

  const [filters, setFilters] = useState({
    commit_sha: '',
    binary_id: '',
    environment_id: '',
  });

  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadRuns();
  }, [filters, currentPage]);

  const loadInitialData = async () => {
    try {
      const [binaryResponse, environmentResponse] = await Promise.all([
        fetch(`${API_BASE}/admin/binaries`, { credentials: 'include' }),
        fetch(`${API_BASE}/admin/environments`, { credentials: 'include' }),
      ]);

      if (binaryResponse.ok && environmentResponse.ok) {
        const [binaryData, environmentData] = await Promise.all([
          binaryResponse.json(),
          environmentResponse.json(),
        ]);

        setBinaries(binaryData);
        setEnvironments(environmentData);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load filter options',
        variant: 'destructive',
      });
    }
  };

  const loadRuns = async () => {
    try {
      const params = new URLSearchParams();

      if (filters.commit_sha) params.append('commit_sha', filters.commit_sha);
      if (filters.binary_id) params.append('binary_id', filters.binary_id);
      if (filters.environment_id)
        params.append('environment_id', filters.environment_id);
      params.append('skip', (currentPage * pageSize).toString());
      params.append('limit', pageSize.toString());

      const response = await fetch(`${API_BASE}/admin/runs?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data: RunsResponse = await response.json();
        setRuns(data.runs);
        setPagination(data.pagination);
      } else {
        throw new Error('Failed to load runs');
      }
    } catch (error) {
      console.error('Error loading runs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load runs',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (run: Run) => {
    if (
      !confirm(
        `Are you sure you want to delete run "${run.run_id}"? This will also delete all associated benchmark results.`
      )
    )
      return;

    setDeleting(run.run_id);
    try {
      const response = await fetch(`${API_BASE}/admin/runs/${run.run_id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await loadRuns();
        toast({
          title: 'Success',
          description: 'Run deleted successfully',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting run:', error);
      toast({
        title: 'Error',
        description: `Failed to delete run: ${error.message}`,
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value === 'all' ? '' : value,
    }));
    setCurrentPage(0); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      commit_sha: '',
      binary_id: '',
      environment_id: '',
    });
    setCurrentPage(0);
  };

  const getBinaryName = (binaryId: string) => {
    const binary = binaries.find((b) => b.id === binaryId);
    return binary ? binary.name : binaryId;
  };

  const getEnvironmentName = (environmentId: string) => {
    const environment = environments.find((e) => e.id === environmentId);
    return environment ? environment.name : environmentId;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Benchmark Runs</h2>
          <p className="text-gray-600">
            View and manage benchmark execution runs
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="commit-filter">Commit SHA</Label>
              <Input
                id="commit-filter"
                placeholder="Enter commit SHA..."
                value={filters.commit_sha}
                onChange={(e) =>
                  handleFilterChange('commit_sha', e.target.value)
                }
              />
            </div>

            <div>
              <Label htmlFor="binary-filter">Binary</Label>
              <Select
                value={filters.binary_id || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('binary_id', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select binary..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Binaries</SelectItem>
                  {binaries.map((binary) => (
                    <SelectItem key={binary.id} value={binary.id}>
                      {binary.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="environment-filter">Environment</Label>
              <Select
                value={filters.environment_id || 'all'}
                onValueChange={(value) =>
                  handleFilterChange('environment_id', value)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select environment..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Environments</SelectItem>
                  {environments.map((environment) => (
                    <SelectItem key={environment.id} value={environment.id}>
                      {environment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={clearFilters}
                className="w-full"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Runs List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <Card
              key={run.run_id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Play className="w-5 h-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg">{run.run_id}</CardTitle>
                      <CardDescription>
                        Commit: {run.commit_sha.substring(0, 8)}... by{' '}
                        {run.commit.author}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      Python {run.python_major}.{run.python_minor}.
                      {run.python_patch}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(run)}
                      disabled={deleting === run.run_id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Commit Information */}
                <div className="mb-4 p-3 bg-muted rounded-lg border">
                  <h4 className="text-sm font-semibold mb-2">Commit Details</h4>
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Full SHA
                      </p>
                      <p className="text-sm font-mono">{run.commit.sha}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Message
                      </p>
                      <p className="text-sm leading-relaxed">
                        {run.commit.message.length > 200
                          ? `${run.commit.message.substring(0, 200)}...`
                          : run.commit.message}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Author
                        </p>
                        <p className="text-sm">{run.commit.author}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">
                          Commit Date
                        </p>
                        <div className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3 text-muted-foreground" />
                          <p className="text-sm">
                            {format(
                              new Date(run.commit.timestamp),
                              'MMM dd, yyyy HH:mm'
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Run Information */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Binary
                    </p>
                    <p className="text-sm">{getBinaryName(run.binary_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {run.binary_id}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Environment
                    </p>
                    <p className="text-sm">
                      {getEnvironmentName(run.environment_id)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {run.environment_id}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Run Date
                    </p>
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <p className="text-sm">
                        {format(new Date(run.timestamp), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && runs.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Play className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No runs found</h3>
            <p className="text-muted-foreground">
              {Object.values(filters).some((f) => f !== '')
                ? 'No runs match your current filters.'
                : 'No benchmark runs have been executed yet.'}
            </p>
            {Object.values(filters).some((f) => f !== '') && (
              <Button className="mt-4" variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {runs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} to{' '}
            {Math.min((currentPage + 1) * pageSize, pagination.total)} of{' '}
            {pagination.total} runs
          </p>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage === 0}
              onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
            >
              Previous
            </Button>

            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} of {Math.ceil(pagination.total / pageSize)}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={!pagination.has_more}
              onClick={() => setCurrentPage((prev) => prev + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
