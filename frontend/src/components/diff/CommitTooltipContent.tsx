'use client';

import type { Commit } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CommitTooltipContentProps {
  commit?: Commit;
}

export default function CommitTooltipContent({
  commit,
}: CommitTooltipContentProps) {
  if (!commit) {
    return <p>Commit information not available.</p>;
  }

  return (
    <div className="p-2 text-sm max-w-xs bg-popover text-popover-foreground rounded-md shadow-lg border">
      <p className="font-bold">
        SHA:{' '}
        <span className="font-mono font-normal">
          {commit.sha.substring(0, 12)}...
        </span>
      </p>
      <p>
        <span className="font-semibold">Author:</span> {commit.author}
      </p>
      <p>
        <span className="font-semibold">Date:</span>{' '}
        {new Date(commit.timestamp).toLocaleString()}
      </p>
      <p className="mt-1">
        <span className="font-semibold">Message:</span>
      </p>
      <p className="whitespace-pre-wrap break-words">{commit.message}</p>
    </div>
  );
}
