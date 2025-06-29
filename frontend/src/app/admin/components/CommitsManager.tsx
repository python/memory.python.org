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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  GitCommit, 
  Edit, 
  Trash2, 
  Search, 
  Calendar, 
  User, 
  Hash,
  Play
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';

interface CommitDisplayData {
  sha: string;
  timestamp: string;
  message: string;
  author: string;
  python_major: number;
  python_minor: number;
  python_patch: number;
  run_count?: number;
}

interface CommitUpdate {
  message?: string;
  author?: string;
  python_major?: number;
  python_minor?: number;
  python_patch?: number;
}

export default function CommitsManager() {
  const [commits, setCommits] = useState<CommitDisplayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCommit, setEditingCommit] = useState<CommitDisplayData | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<CommitUpdate>({});
  const { toast } = useToast();


  const [filters, setFilters] = useState({
    sha: '',
    author: '',
    python_version: '',
  });

  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    loadCommits();
  }, [filters, currentPage]);

  const loadCommits = async () => {
    try {
      const params = {
        sha: filters.sha || undefined,
        author: filters.author || undefined,
        python_version: filters.python_version || undefined,
        skip: currentPage * pageSize,
        limit: pageSize,
      };

      const apiCommits = await api.getAdminCommits(params);
      
      // Map API response to component's expected format
      const mappedCommits: CommitDisplayData[] = apiCommits.map(commit => ({
        sha: commit.sha,
        timestamp: commit.timestamp,
        message: commit.message,
        author: commit.author,
        python_major: commit.python_major,
        python_minor: commit.python_minor,
        python_patch: commit.python_patch,
        run_count: commit.run_count,
      }));
      
      setCommits(mappedCommits);
    } catch (error) {
      console.error('Error loading commits:', error);
      toast({
        title: 'Error',
        description: 'Failed to load commits',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (commit: CommitDisplayData) => {
    setEditingCommit(commit);
    setEditForm({
      message: commit.message,
      author: commit.author,
      python_major: commit.python_major,
      python_minor: commit.python_minor,
      python_patch: commit.python_patch,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingCommit) return;

    try {
      // Map component's editForm to API's expected format
      const apiUpdateData = {
        message: editForm.message,
        author: editForm.author,
        python_version: editForm.python_major !== undefined && editForm.python_minor !== undefined && editForm.python_patch !== undefined ? {
          major: editForm.python_major,
          minor: editForm.python_minor,
          patch: editForm.python_patch,
        } : undefined,
      };
      await api.updateCommit(editingCommit.sha, apiUpdateData);
      await loadCommits();
      setEditingCommit(null);
      setEditForm({});
      toast({
        title: 'Success',
        description: 'Commit updated successfully',
      });
    } catch (error) {
      console.error('Error updating commit:', error);
      toast({
        title: 'Error',
        description: `Failed to update commit: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (commit: CommitDisplayData) => {
    if (
      !confirm(
        `Are you sure you want to delete commit "${commit.sha.substring(0, 8)}"? This will also delete all associated runs and benchmark results.`
      )
    )
      return;

    setDeleting(commit.sha);
    try {
      await api.deleteCommit(commit.sha);
      await loadCommits();
      toast({
        title: 'Success',
        description: 'Commit deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting commit:', error);
      toast({
        title: 'Error',
        description: `Failed to delete commit: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
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
      sha: '',
      author: '',
      python_version: '',
    });
    setCurrentPage(0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Commits</h2>
          <p className="text-gray-600">
            Manage Git commits and their metadata
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
              <Label htmlFor="sha-filter">Commit SHA</Label>
              <Input
                id="sha-filter"
                placeholder="Enter commit SHA..."
                value={filters.sha}
                onChange={(e) => handleFilterChange('sha', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="author-filter">Author</Label>
              <Input
                id="author-filter"
                placeholder="Enter author name..."
                value={filters.author}
                onChange={(e) => handleFilterChange('author', e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="version-filter">Python Version</Label>
              <Input
                id="version-filter"
                placeholder="e.g., 3.12"
                value={filters.python_version}
                onChange={(e) =>
                  handleFilterChange('python_version', e.target.value)
                }
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

      {/* Commits List */}
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
        <div className="space-y-4">
          {commits.map((commit) => (
            <Card
              key={commit.sha}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <GitCommit className="w-5 h-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg font-mono">
                        {commit.sha.substring(0, 8)}...
                      </CardTitle>
                      <CardDescription>
                        by {commit.author} •{' '}
                        {format(new Date(commit.timestamp), 'MMM dd, yyyy HH:mm')}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      Python {commit.python_major}.{commit.python_minor}.{commit.python_patch}
                    </Badge>
                    {commit.run_count !== undefined && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Play className="w-3 h-3" />
                        {commit.run_count} runs
                      </Badge>
                    )}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(commit)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Edit Commit</DialogTitle>
                          <DialogDescription>
                            Update commit metadata including message, author, and Python version information.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="edit-sha">SHA (Read-only)</Label>
                            <Input
                              id="edit-sha"
                              value={editingCommit?.sha || ''}
                              disabled
                              className="font-mono"
                            />
                          </div>
                          
                          <div>
                            <Label htmlFor="edit-message">Commit Message</Label>
                            <Textarea
                              id="edit-message"
                              value={editForm.message || ''}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  message: e.target.value,
                                }))
                              }
                              rows={3}
                            />
                          </div>

                          <div>
                            <Label htmlFor="edit-author">Author</Label>
                            <Input
                              id="edit-author"
                              value={editForm.author || ''}
                              onChange={(e) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  author: e.target.value,
                                }))
                              }
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label htmlFor="edit-major">Python Major</Label>
                              <Input
                                id="edit-major"
                                type="number"
                                value={editForm.python_major || ''}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    python_major: parseInt(e.target.value) || 0,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-minor">Python Minor</Label>
                              <Input
                                id="edit-minor"
                                type="number"
                                value={editForm.python_minor || ''}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    python_minor: parseInt(e.target.value) || 0,
                                  }))
                                }
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-patch">Python Patch</Label>
                              <Input
                                id="edit-patch"
                                type="number"
                                value={editForm.python_patch || ''}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    python_patch: parseInt(e.target.value) || 0,
                                  }))
                                }
                              />
                            </div>
                          </div>

                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => setEditingCommit(null)}
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
                      onClick={() => handleDelete(commit)}
                      disabled={deleting === commit.sha}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Commit Message */}
                  <div>
                    <p className="text-sm leading-relaxed">
                      {commit.message.length > 300
                        ? `${commit.message.substring(0, 300)}...`
                        : commit.message}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Hash className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Full SHA
                        </p>
                        <p className="font-mono">{commit.sha}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Author
                        </p>
                        <p>{commit.author}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Timestamp
                        </p>
                        <p>{format(new Date(commit.timestamp), 'PPpp')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && commits.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <GitCommit className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No commits found</h3>
            <p className="text-muted-foreground">
              {Object.values(filters).some((f) => f !== '')
                ? 'No commits match your current filters.'
                : 'No commits have been recorded yet.'}
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
      {commits.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {currentPage * pageSize + 1} to{' '}
            {Math.min((currentPage + 1) * pageSize, commits.length)} commits
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
              disabled={commits.length < pageSize}
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