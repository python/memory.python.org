'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface FlamegraphPageProps {
  params: Promise<{ id: string }>;
}

export default function FlamegraphPage({ params }: FlamegraphPageProps) {
  const resolvedParams = React.use(params);
  const router = useRouter();
  const [flamegraphHtml, setFlamegraphHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchFlamegraph = async () => {
      try {
        setLoading(true);
        const data = await api.getFlamegraph(resolvedParams.id);
        setFlamegraphHtml(data.flamegraph_html || '');
      } catch (err) {
        console.error('Error fetching flamegraph:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load flamegraph'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchFlamegraph();
  }, [resolvedParams.id]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading flamegraph...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Error Loading Flamegraph</CardTitle>
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
            <p className="text-sm text-gray-600 mt-2">
              The flamegraph could not be loaded. Please check if the benchmark
              result exists and contains flamegraph data.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!flamegraphHtml) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>No Flamegraph Data</CardTitle>
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              No flamegraph data is available for this benchmark result.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Results
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Memory Flamegraph</CardTitle>
          <p className="text-sm text-gray-600">
            Interactive flamegraph showing memory allocation patterns. Click on
            sections to zoom in.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="w-full h-[800px] border rounded-b-lg">
            <iframe
              srcDoc={flamegraphHtml}
              title="Flamegraph"
              className="w-full h-full border-0 rounded-b-lg"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
