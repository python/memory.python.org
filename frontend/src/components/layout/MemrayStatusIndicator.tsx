'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMemrayStatus } from '@/hooks/use-memray-status';
import FailureCard from '@/components/memray/FailureCard';

export default function MemrayStatusIndicator() {
  const [mounted, setMounted] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const { status: memrayStatus, loading: memrayLoading } = useMemrayStatus();

  useEffect(() => setMounted(true), []);

  if (!mounted || memrayLoading) {
    return null;
  }

  const hasFailures = memrayStatus?.has_failures;
  const failureCount = memrayStatus?.failure_count || 0;

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button 
                className="flex items-center justify-center w-12 h-12 bg-background border-2 border-border rounded-full shadow-lg hover:shadow-xl transition-shadow cursor-pointer hover:scale-105"
                onClick={() => setShowDialog(true)}
              >
                {hasFailures ? (
                  <AlertTriangle 
                    className="h-6 w-6 text-amber-500" 
                    aria-label={`Memray failures detected`}
                  />
                ) : (
                  <CheckCircle 
                    className="h-6 w-6 text-green-500" 
                    aria-label="All environments healthy"
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>
                {hasFailures 
                  ? `Click to see ${failureCount} environment${failureCount !== 1 ? 's' : ''} affected by memray build failures`
                  : 'All environments are healthy - no memray build failures'
                }
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Memray Status Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {hasFailures ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
              Memray Build Status
            </DialogTitle>
            <DialogDescription>
              {hasFailures 
                ? `${failureCount} environment${failureCount !== 1 ? 's' : ''} currently affected by memray build failures`
                : 'All environments are healthy - no memray build failures detected'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-4">
            {hasFailures && memrayStatus?.affected_environments ? (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Affected Environments:</h4>
                {memrayStatus.affected_environments.map((env, index) => (
                  <FailureCard
                    key={index}
                    binary_name={env.binary_name}
                    environment_name={env.environment_name}
                    commit_sha={env.commit_sha}
                    error_message={env.error_message}
                    failure_timestamp={env.failure_timestamp}
                    commit_timestamp={env.latest_failure}
                    compact={true}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-green-800 text-center">
                  🎉 All memray builds are currently successful across all environments!
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}