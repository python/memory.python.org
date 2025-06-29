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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import type { MemrayFailure as ApiMemrayFailure, MemrayFailureSummary } from '@/lib/types';
import FailureCard from '@/components/memray/FailureCard';

interface MemrayFailure {
  id: number;
  commit_sha: string;
  binary_id: string;
  environment_id: string;
  binary_name: string;
  environment_name: string;
  error_message: string;
  failure_timestamp: string;
  commit_timestamp: string;
}

interface FailureSummary {
  binary_id: string;
  binary_name: string;
  environment_id: string;
  environment_name: string;
  commit_sha: string;
  failure_timestamp: string;
  commit_timestamp: string;
}

export default function MemrayFailuresManager() {
  const [failures, setFailures] = useState<MemrayFailure[]>([]);
  const [summary, setSummary] = useState<FailureSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { toast } = useToast();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [apiFailures, apiSummary] = await Promise.all([
        api.getMemrayFailures(),
        api.getMemrayFailuresSummary(),
      ]);

      // Map API response to component's expected format
      const mappedFailures: MemrayFailure[] = apiFailures.map((failure: ApiMemrayFailure) => ({
        id: failure.id,
        commit_sha: failure.commit_sha,
        binary_id: failure.binary_name, // Using name as ID
        environment_id: failure.environment_name, // Using name as ID
        binary_name: failure.binary_name,
        environment_name: failure.environment_name,
        error_message: failure.error_message,
        failure_timestamp: failure.failure_timestamp,
        commit_timestamp: failure.commit_timestamp,
      }));

      const mappedSummary: FailureSummary[] = apiSummary.map((summary: MemrayFailureSummary) => ({
        binary_id: summary.environment_name,
        binary_name: summary.environment_name,
        environment_id: summary.environment_name,
        environment_name: summary.environment_name,
        commit_sha: '',
        failure_timestamp: summary.latest_failure,
        commit_timestamp: summary.latest_failure,
      }));

      setFailures(mappedFailures);
      setSummary(mappedSummary);
    } catch (error) {
      console.error('Failed to load memray failures:', error);
      toast({
        title: 'Error',
        description: 'Failed to load memray failure data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteFailure = async (id: number) => {
    setDeleting(id);
    try {
      await api.deleteMemrayFailure(id);
      await loadData();
      toast({
        title: 'Success',
        description: 'Memray failure deleted successfully',
      });
    } catch (error) {
      console.error('Failed to delete failure:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete memray failure',
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Memray Build Failures</h2>
          <p className="text-muted-foreground">
            Monitor and manage memray build failures across environments
          </p>
        </div>
        <Button onClick={loadData} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {summary.length > 0 ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <CheckCircle className="w-5 h-5 text-green-500" />
            )}
            Current Status
          </CardTitle>
          <CardDescription>
            {summary.length > 0
              ? `${summary.length} environment(s) affected by memray build failures`
              : 'All environments are healthy - no memray build failures detected'}
          </CardDescription>
        </CardHeader>
        {summary.length > 0 && (
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {summary.map((item, index) => (
                <div
                  key={index}
                  className="p-4 border rounded-lg bg-amber-50 border-amber-200"
                >
                  <div className="font-medium text-amber-900">
                    {item.binary_name} on {item.environment_name}
                  </div>
                  <div className="text-sm text-amber-700 mt-1">
                    Latest failure: {item.commit_sha.substring(0, 8)}
                  </div>
                  <div className="text-xs text-amber-600 mt-1">
                    {new Date(item.commit_timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Detailed Failures Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Memray Failures</CardTitle>
          <CardDescription>
            Detailed view of all recorded memray build failures
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading failures...</div>
          ) : failures.length === 0 ? (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                No memray build failures recorded. All environments are healthy!
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {failures.map((failure) => (
                <FailureCard
                  key={failure.id}
                  id={failure.id}
                  binary_name={failure.binary_name}
                  environment_name={failure.environment_name}
                  commit_sha={failure.commit_sha}
                  error_message={failure.error_message}
                  failure_timestamp={failure.failure_timestamp}
                  commit_timestamp={failure.commit_timestamp}
                  showBadges={true}
                  compact={false}
                  onDelete={deleteFailure}
                  isDeleting={deleting === failure.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}