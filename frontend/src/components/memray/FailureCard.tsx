'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface FailureCardProps {
  id?: number;
  binary_name: string;
  environment_name: string;
  commit_sha: string;
  error_message: string;
  failure_timestamp: string;
  commit_timestamp?: string;
  showBadges?: boolean;
  compact?: boolean;
  onDelete?: (id: number) => Promise<void>;
  isDeleting?: boolean;
}

export default function FailureCard({
  id,
  binary_name,
  environment_name,
  commit_sha,
  error_message,
  failure_timestamp,
  commit_timestamp,
  showBadges = false,
  compact = false,
  onDelete,
  isDeleting = false,
}: FailureCardProps) {
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const truncateMessage = (message: string, maxLength: number = 100) => {
    return message.length > maxLength
      ? message.substring(0, maxLength) + '...'
      : message;
  };

  if (compact) {
    return (
      <>
        <div className="p-3 border rounded-lg bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="font-medium text-amber-900 dark:text-amber-200">
                {binary_name} on {environment_name}
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Commit: {commit_sha.substring(0, 8)} • {formatTimestamp(commit_timestamp || failure_timestamp)}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowErrorDialog(true)}
                className="gap-2"
              >
                <Eye className="w-4 h-4" />
                View Error
              </Button>
              {onDelete && id && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(id)}
                  disabled={isDeleting}
                  className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Error Details Dialog */}
        <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
          <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Error Details</DialogTitle>
              <DialogDescription>
                {binary_name} on {environment_name} • Commit {commit_sha.substring(0, 8)}
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 min-h-0 mt-4">
              <div className="h-full max-h-[70vh] overflow-auto border rounded-lg bg-muted">
                <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
                  {error_message}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between p-3 border rounded-lg">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <code className="text-sm">{commit_sha.substring(0, 8)}</code>
            {showBadges && (
              <>
                <Badge variant="outline">{binary_name}</Badge>
                <Badge variant="outline">{environment_name}</Badge>
              </>
            )}
          </div>
          {!showBadges && (
            <div className="text-sm text-muted-foreground mt-1">
              {binary_name} on {environment_name}
            </div>
          )}
          <div className="text-sm text-muted-foreground mt-1">
            {formatTimestamp(failure_timestamp)}
          </div>
          {showBadges && (
            <div className="text-sm text-muted-foreground mt-1">
              {truncateMessage(error_message)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 ml-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowErrorDialog(true)}
            className="gap-2"
          >
            <Eye className="w-4 h-4" />
            View Error
          </Button>
          {onDelete && id && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(id)}
              disabled={isDeleting}
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
        </div>
      </div>

      {/* Error Details Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Error Details</DialogTitle>
            <DialogDescription>
              {binary_name} on {environment_name} • Commit {commit_sha.substring(0, 8)}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 mt-4">
            <div className="h-full max-h-[70vh] overflow-auto border rounded-lg bg-muted">
              <pre className="p-4 text-sm font-mono whitespace-pre-wrap break-words leading-relaxed">
                {error_message}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}