'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ArrowLeft,
  Settings,
  Code2,
  AlertCircle,
  Zap,
  Bug,
  Gauge,
  Shield,
  Search,
  ChevronDown,
  ChevronRight,
  Server,
  GitCommit,
  Calendar,
  User,
  Hash,
  ExternalLink,
} from 'lucide-react';
import type { Binary } from '@/lib/types';
import { api } from '@/lib/api';
import { format } from 'date-fns';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type EnvironmentData = {
  id: string;
  name: string;
  description?: string;
  run_count: number;
  commit_count: number;
};

type CommitData = {
  sha: string;
  timestamp: string;
  message: string;
  author: string;
  python_version: { major: number; minor: number; patch: number };
  run_timestamp: string;
};

interface EnvironmentCardProps {
  binary: Binary;
  binaryId: string;
  environment: EnvironmentData;
  commits: CommitData[];
  isLoadingCommits: boolean;
  onLoadCommits: () => void;
}

function EnvironmentCard({
  binary,
  binaryId,
  environment,
  commits,
  isLoadingCommits,
  onLoadCommits,
}: EnvironmentCardProps) {
  const [showCommits, setShowCommits] = useState(false);

  const handleToggleCommits = () => {
    if (!showCommits && commits.length === 0) {
      onLoadCommits();
    }
    setShowCommits(!showCommits);
  };

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="h-6 w-6 text-blue-600" />
            <div>
              <CardTitle className="text-lg">{environment.name}</CardTitle>
              {environment.description && (
                <CardDescription className="text-sm mt-1">
                  {environment.description}
                </CardDescription>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {environment.commit_count} commits
            </Badge>
            <Badge variant="outline">{environment.run_count} runs</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Collapsible open={showCommits} onOpenChange={setShowCommits}>
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              onClick={handleToggleCommits}
              disabled={isLoadingCommits}
            >
              <span className="flex items-center gap-2">
                <GitCommit className="h-4 w-4" />
                {showCommits ? 'Hide' : 'Show'} Commit History
              </span>
              {showCommits ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="mt-4">
              {isLoadingCommits ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="h-16 bg-muted animate-pulse rounded-lg"
                    ></div>
                  ))}
                </div>
              ) : commits.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {commits.slice(0, 20).map((commit) => (
                    <Card key={commit.sha} className="bg-muted/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <Hash className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <code className="font-mono text-sm font-semibold">
                                  {commit.sha.slice(0, 7)}
                                </code>
                                <Badge variant="outline" className="text-xs">
                                  py {commit.python_version.major}.
                                  {commit.python_version.minor}.
                                  {commit.python_version.patch}
                                </Badge>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed">
                                {commit.message}
                              </p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {commit.author}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {format(
                                    new Date(commit.run_timestamp),
                                    'MMM d, yyyy HH:mm'
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Link
                              href={`/diff?commit_sha=${commit.sha}&binary_id=${binaryId}&environment_id=${environment.id}`}
                            >
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Results
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  {commits.length > 20 && (
                    <div className="text-center py-3">
                      <Badge variant="outline" className="text-sm">
                        +{commits.length - 20} more commits available
                      </Badge>
                    </div>
                  )}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex items-center justify-center h-24 text-muted-foreground">
                    <p className="text-sm">
                      No commits found for this binary + environment combination
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

export default function BinaryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const [binary, setBinary] = useState<Binary | null>(null);
  const [environments, setEnvironments] = useState<EnvironmentData[]>([]);
  const [commitsData, setCommitsData] = useState<Record<string, CommitData[]>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [loadingCommits, setLoadingCommits] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBinaryAndEnvironments() {
      try {
        setLoading(true);
        setError(null);

        // Load binary details and environments in parallel
        const [binariesData, environmentsData] = await Promise.all([
          api.getBinaries(),
          api.getEnvironmentsForBinary(resolvedParams.id),
        ]);

        const binaryData = binariesData.find((b) => b.id === resolvedParams.id);
        if (!binaryData) {
          setError('Binary not found');
          return;
        }

        setBinary(binaryData);
        setEnvironments(environmentsData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load binary details'
        );
      } finally {
        setLoading(false);
      }
    }

    loadBinaryAndEnvironments();
  }, [resolvedParams.id]);

  const loadCommitsForEnvironment = async (environmentId: string) => {
    const key = environmentId;
    if (commitsData[key]) return; // Already loaded

    try {
      setLoadingCommits((prev) => ({ ...prev, [key]: true }));
      const commits = await api.getCommitsForBinaryAndEnvironment(
        resolvedParams.id,
        environmentId
      );
      setCommitsData((prev) => ({ ...prev, [key]: commits }));
    } catch (err) {
      console.error('Failed to load commits:', err);
    } finally {
      setLoadingCommits((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Helper function to get icon and colors based on configure flags
  const getBinaryInfo = (binary: Binary) => {
    const flags = binary.flags || [];

    // Determine type based on configure flags
    const hasDebug = flags.includes('--with-debug');
    const hasNoGil = flags.includes('--disable-gil');
    const hasLTO = flags.includes('--with-lto');
    const hasPGO = flags.includes('--enable-optimizations');
    const hasTrace = flags.includes('--with-trace-refs');
    const hasValgrind = flags.includes('--with-valgrind');
    const isDefault = flags.length === 0;

    // Determine primary characteristic (priority order)
    if (hasDebug && hasNoGil) {
      return {
        icon: Shield,
        description:
          binary.description || 'Debug build combined with no-GIL features',
        color: 'text-purple-600 dark:text-purple-400',
      };
    } else if (hasValgrind) {
      return {
        icon: Shield,
        description:
          binary.description ||
          'Build optimized for Valgrind memory debugging tool',
        color: 'text-orange-600 dark:text-orange-400',
      };
    } else if (hasTrace) {
      return {
        icon: Search,
        description:
          binary.description || 'Build with trace reference counting enabled',
        color: 'text-teal-600 dark:text-teal-400',
      };
    } else if (hasPGO) {
      return {
        icon: Zap,
        description: binary.description || 'Profile Guided Optimization build',
        color: 'text-indigo-600 dark:text-indigo-400',
      };
    } else if (hasLTO) {
      return {
        icon: Gauge,
        description: binary.description || 'Link Time Optimization enabled',
        color: 'text-green-600 dark:text-green-400',
      };
    } else if (hasNoGil) {
      return {
        icon: Zap,
        description:
          binary.description ||
          'Experimental build without the Global Interpreter Lock',
        color: 'text-yellow-600 dark:text-yellow-400',
      };
    } else if (hasDebug) {
      return {
        icon: Bug,
        description:
          binary.description || 'Debug build with additional runtime checks',
        color: 'text-destructive',
      };
    } else if (isDefault) {
      return {
        icon: Settings,
        description:
          binary.description || 'Standard CPython build with default settings',
        color: 'text-primary',
      };
    } else {
      // Fallback for unknown combinations
      return {
        icon: Settings,
        description: binary.description || 'Custom build configuration',
        color: 'text-muted-foreground',
      };
    }
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
        </div>

        <Card>
          <CardContent className="p-8">
            <div className="space-y-6">
              <div className="h-16 bg-muted animate-pulse rounded"></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="h-32 bg-muted animate-pulse rounded"></div>
                </div>
                <div className="space-y-4">
                  <div className="h-64 bg-muted animate-pulse rounded"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !binary) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <AlertCircle className="w-16 h-16 mb-4 text-red-500" />
            <p className="text-lg">{error || 'Binary not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const info = getBinaryInfo(binary);
  const IconComponent = info.icon;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Binaries
        </Button>
        <div className="flex items-center gap-3">
          <IconComponent className={`h-8 w-8 ${info.color}`} />
          <div>
            <h1 className="text-3xl font-bold font-headline">{binary.name}</h1>
            <p className="text-muted-foreground">
              Binary Configuration Details
            </p>
          </div>
        </div>
      </div>

      {/* Binary Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            Configuration Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Binary Info */}
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                  DESCRIPTION
                </h4>
                <p className="text-sm leading-relaxed">{info.description}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                  IDENTIFIER
                </h4>
                <Badge variant="outline" className="font-mono">
                  {binary.id}
                </Badge>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                  COMPILATION FLAGS
                </h4>
                {binary.flags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {binary.flags.map((flag, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="font-mono"
                      >
                        {flag}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <Badge variant="outline">
                    No additional flags (default build)
                  </Badge>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3 text-muted-foreground">
                  TESTING OVERVIEW
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <Card className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {environments.length}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Environments
                    </div>
                  </Card>
                  <Card className="p-4 text-center">
                    <div className="text-2xl font-bold text-primary">
                      {environments.reduce(
                        (sum, env) => sum + env.commit_count,
                        0
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Total Commits
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Environments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Tested Environments
          </CardTitle>
          <CardDescription>
            Explore commits and benchmark results for this binary configuration
            across different environments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {environments.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {environments.map((env) => (
                <EnvironmentCard
                  key={env.id}
                  binary={binary}
                  binaryId={resolvedParams.id}
                  environment={env}
                  commits={commitsData[env.id] || []}
                  isLoadingCommits={loadingCommits[env.id] || false}
                  onLoadCommits={() => loadCommitsForEnvironment(env.id)}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex items-center justify-center h-32 text-muted-foreground">
                <div className="text-center">
                  <Server className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No environments tested with this binary configuration</p>
                  <p className="text-xs mt-1">
                    Run some benchmarks to see data here
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
