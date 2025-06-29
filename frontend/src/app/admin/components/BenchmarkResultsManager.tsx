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
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { 
  BarChart3, 
  Edit, 
  Trash2, 
  Search, 
  Eye,
  Flame,
  Database,
  CheckSquare,
  Square
} from 'lucide-react';

interface BenchmarkResult {
  id: string;
  run_id: string;
  benchmark_name: string;
  high_watermark_bytes: number;
  total_allocated_bytes: number;
  allocation_histogram: number[][];
  top_allocating_functions: any[];
  has_flamegraph: boolean;
}

interface BenchmarkResultUpdate {
  high_watermark_bytes?: number;
  total_allocated_bytes?: number;
  allocation_histogram?: number[][];
  top_allocating_functions?: any[];
}

export default function BenchmarkResultsManager() {
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingResult, setEditingResult] = useState<BenchmarkResult | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BenchmarkResultUpdate>({});
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [flamegraphHtml, setFlamegraphHtml] = useState<string | null>(null);
  const { toast } = useToast();

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';

  const [filters, setFilters] = useState({
    run_id: '',
    benchmark_name: '',
    min_memory: '',
    max_memory: '',
  });

  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    loadResults();
  }, [filters, currentPage]);

  const loadResults = async () => {
    try {
      const params = new URLSearchParams();

      if (filters.run_id) params.append('run_id', filters.run_id);
      if (filters.benchmark_name) params.append('benchmark_name', filters.benchmark_name);
      if (filters.min_memory) params.append('min_memory', filters.min_memory);
      if (filters.max_memory) params.append('max_memory', filters.max_memory);
      params.append('skip', (currentPage * pageSize).toString());
      params.append('limit', pageSize.toString());

      const response = await fetch(`${API_BASE}/admin/benchmark-results?${params}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data);
      } else {
        throw new Error('Failed to load benchmark results');
      }
    } catch (error) {
      console.error('Error loading benchmark results:', error);
      toast({
        title: 'Error',
        description: 'Failed to load benchmark results',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (result: BenchmarkResult) => {
    setEditingResult(result);
    setEditForm({
      high_watermark_bytes: result.high_watermark_bytes,
      total_allocated_bytes: result.total_allocated_bytes,
      allocation_histogram: result.allocation_histogram,
      top_allocating_functions: result.top_allocating_functions,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingResult) return;

    try {
      const response = await fetch(
        `${API_BASE}/admin/benchmark-results/${editingResult.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(editForm),
        }
      );

      if (response.ok) {
        await loadResults();
        setEditingResult(null);
        setEditForm({});
        toast({
          title: 'Success',
          description: 'Benchmark result updated successfully',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Update failed');
      }
    } catch (error) {
      console.error('Error updating benchmark result:', error);
      toast({
        title: 'Error',
        description: `Failed to update benchmark result: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (result: BenchmarkResult) => {
    if (
      !confirm(
        `Are you sure you want to delete benchmark result "${result.id}"?`
      )
    )
      return;

    setDeleting(result.id);
    try {
      const response = await fetch(`${API_BASE}/admin/benchmark-results/${result.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await loadResults();
        toast({
          title: 'Success',
          description: 'Benchmark result deleted successfully',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting benchmark result:', error);
      toast({
        title: 'Error',
        description: `Failed to delete benchmark result: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedResults.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedResults.size} benchmark results?`
      )
    )
      return;

    setBulkDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/admin/benchmark-results/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(Array.from(selectedResults)),
      });

      if (response.ok) {
        const data = await response.json();
        await loadResults();
        setSelectedResults(new Set());
        toast({
          title: 'Success',
          description: `Deleted ${data.deleted_count} benchmark results`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Bulk delete failed');
      }
    } catch (error) {
      console.error('Error bulk deleting benchmark results:', error);
      toast({
        title: 'Error',
        description: `Failed to delete benchmark results: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        variant: 'destructive',
      });
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleViewFlamegraph = async (resultId: string) => {
    try {
      const response = await fetch(
        `${API_BASE}/admin/benchmark-results/${resultId}/flamegraph`,
        {
          credentials: 'include',
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFlamegraphHtml(data.flamegraph_html);
      } else {
        throw new Error('Failed to load flamegraph');
      }
    } catch (error) {
      console.error('Error loading flamegraph:', error);
      toast({
        title: 'Error',
        description: 'Failed to load flamegraph',
        variant: 'destructive',
      });
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setCurrentPage(0);
  };

  const clearFilters = () => {
    setFilters({
      run_id: '',
      benchmark_name: '',
      min_memory: '',
      max_memory: '',
    });
    setCurrentPage(0);
  };

  const handleSelectResult = (resultId: string, checked: boolean) => {
    const newSelected = new Set(selectedResults);
    if (checked) {
      newSelected.add(resultId);
    } else {
      newSelected.delete(resultId);
    }
    setSelectedResults(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedResults(new Set(results.map(r => r.id)));
    } else {
      setSelectedResults(new Set());
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Benchmark Results</h2>
          <p className="text-gray-600">
            Manage benchmark execution results and performance data
          </p>
        </div>
        {selectedResults.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected ({selectedResults.size})
          </Button>
        )}
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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="run-filter">Run ID</Label>
              <Input
                id="run-filter"
                placeholder="Enter run ID..."
                value={filters.run_id}
                onChange={(e) => handleFilterChange('run_id', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="benchmark-filter">Benchmark Name</Label>
              <Input
                id="benchmark-filter"
                placeholder="Enter benchmark name..."
                value={filters.benchmark_name}
                onChange={(e) => handleFilterChange('benchmark_name', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="min-memory-filter">Min Memory (bytes)</Label>
              <Input
                id="min-memory-filter"
                type="number"
                placeholder="Min memory..."
                value={filters.min_memory}
                onChange={(e) => handleFilterChange('min_memory', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="max-memory-filter">Max Memory (bytes)</Label>
              <Input
                id="max-memory-filter"
                type="number"
                placeholder="Max memory..."
                value={filters.max_memory}
                onChange={(e) => handleFilterChange('max_memory', e.target.value)}
              />
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

      {/* Results List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded"></div>
                  <div className="h-3 bg-muted rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {results.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    checked={selectedResults.size === results.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <Label>Select All</Label>
                </div>
              </CardHeader>
            </Card>
          )}
          
          <div className="space-y-4">
            {results.map((result) => (
              <Card
                key={result.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        checked={selectedResults.has(result.id)}
                        onCheckedChange={(checked) => 
                          handleSelectResult(result.id, checked as boolean)
                        }
                      />
                      <BarChart3 className="w-5 h-5 text-green-600" />
                      <div>
                        <CardTitle className="text-lg">
                          {result.benchmark_name}
                        </CardTitle>
                        <CardDescription>
                          Run: {result.run_id.substring(0, 16)}...
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">
                        {formatBytes(result.high_watermark_bytes)}
                      </Badge>
                      {result.has_flamegraph && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewFlamegraph(result.id)}
                            >
                              <Flame className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Flamegraph - {result.benchmark_name}</DialogTitle>
                            </DialogHeader>
                            <div className="overflow-auto">
                              {flamegraphHtml && (
                                <div 
                                  dangerouslySetInnerHTML={{ __html: flamegraphHtml }}
                                  className="w-full"
                                />
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(result)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Edit Benchmark Result</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="edit-id">ID (Read-only)</Label>
                              <Input
                                id="edit-id"
                                value={editingResult?.id || ''}
                                disabled
                                className="font-mono"
                              />
                            </div>
                            
                            <div>
                              <Label htmlFor="edit-high-watermark">High Watermark (bytes)</Label>
                              <Input
                                id="edit-high-watermark"
                                type="number"
                                value={editForm.high_watermark_bytes || ''}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    high_watermark_bytes: parseInt(e.target.value) || 0,
                                  }))
                                }
                              />
                            </div>

                            <div>
                              <Label htmlFor="edit-total-allocated">Total Allocated (bytes)</Label>
                              <Input
                                id="edit-total-allocated"
                                type="number"
                                value={editForm.total_allocated_bytes || ''}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    total_allocated_bytes: parseInt(e.target.value) || 0,
                                  }))
                                }
                              />
                            </div>

                            <div>
                              <Label htmlFor="edit-histogram">Allocation Histogram (JSON)</Label>
                              <Textarea
                                id="edit-histogram"
                                value={JSON.stringify(editForm.allocation_histogram, null, 2)}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(e.target.value);
                                    setEditForm((prev) => ({
                                      ...prev,
                                      allocation_histogram: parsed,
                                    }));
                                  } catch (error) {
                                    // Invalid JSON, ignore
                                  }
                                }}
                                rows={5}
                                className="font-mono text-sm"
                              />
                            </div>

                            <div>
                              <Label htmlFor="edit-functions">Top Allocating Functions (JSON)</Label>
                              <Textarea
                                id="edit-functions"
                                value={JSON.stringify(editForm.top_allocating_functions, null, 2)}
                                onChange={(e) => {
                                  try {
                                    const parsed = JSON.parse(e.target.value);
                                    setEditForm((prev) => ({
                                      ...prev,
                                      top_allocating_functions: parsed,
                                    }));
                                  } catch (error) {
                                    // Invalid JSON, ignore
                                  }
                                }}
                                rows={5}
                                className="font-mono text-sm"
                              />
                            </div>

                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="outline"
                                onClick={() => setEditingResult(null)}
                              >
                                Cancel
                              </Button>
                              <Button onClick={handleSaveEdit}>
                                Save Changes
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(result)}
                        disabled={deleting === result.id}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="font-medium text-muted-foreground">
                        High Watermark
                      </p>
                      <p className="font-mono">{formatBytes(result.high_watermark_bytes)}</p>
                    </div>

                    <div>
                      <p className="font-medium text-muted-foreground">
                        Total Allocated
                      </p>
                      <p className="font-mono">{formatBytes(result.total_allocated_bytes)}</p>
                    </div>

                    <div>
                      <p className="font-medium text-muted-foreground">
                        Allocation Points
                      </p>
                      <p>{result.allocation_histogram.length} data points</p>
                    </div>

                    <div>
                      <p className="font-medium text-muted-foreground">
                        Top Functions
                      </p>
                      <p>{result.top_allocating_functions.length} functions</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="font-medium text-muted-foreground text-sm mb-2">
                      Result ID
                    </p>
                    <p className="font-mono text-sm text-muted-foreground">{result.id}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {!loading && results.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Database className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No benchmark results found</h3>
            <p className="text-muted-foreground">
              {Object.values(filters).some((f) => f !== '')
                ? 'No results match your current filters.'
                : 'No benchmark results have been recorded yet.'}
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
      {results.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} to{' '}
            {Math.min((currentPage + 1) * pageSize, results.length)} results
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
              Page {currentPage + 1}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={results.length < pageSize}
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