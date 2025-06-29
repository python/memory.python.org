'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Key, Power, PowerOff, Trash2, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import type { TokenResponse, TokenAnalytics } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export default function TokensManager() {
  const [tokens, setTokens] = useState<TokenResponse[]>([]);
  const [analytics, setAnalytics] = useState<TokenAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState({ name: '', description: '' });
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tokensData, analyticsData] = await Promise.all([
        api.getTokens(),
        api.getTokenAnalytics(),
      ]);
      setTokens(tokensData);
      setAnalytics(analyticsData);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load token data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleToggleTokenActive = async (token: TokenResponse) => {
    try {
      if (token.is_active) {
        await api.deactivateToken(token.id);
      } else {
        await api.activateToken(token.id);
      }
      setTokens((prev) =>
        prev.map((t) =>
          t.id === token.id ? { ...t, is_active: !t.is_active } : t
        )
      );
      loadData(); // Refresh analytics
      toast({
        title: 'Success',
        description: `Token ${
          token.is_active ? 'deactivated' : 'activated'
        } successfully`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update token status',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteToken = async (token: TokenResponse) => {
    if (
      !confirm(
        `Are you sure you want to delete the token "${token.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await api.deleteToken(token.id);
      setTokens((prev) => prev.filter((t) => t.id !== token.id));
      loadData(); // Refresh analytics
      toast({
        title: 'Success',
        description: 'Token deleted successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete token',
        variant: 'destructive',
      });
    }
  };

  const handleCreateToken = async () => {
    if (!newToken.name.trim()) return;

    setIsCreating(true);
    try {
      const response = await api.createToken({
        name: newToken.name.trim(),
        description: newToken.description.trim() || undefined,
      });
      setCreatedToken(response.token);
      await loadData(); // Refresh the tokens list and analytics
      toast({
        title: 'Success',
        description: 'Token created successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create token',
        variant: 'destructive',
      });
      // Close dialog on error
      setIsCreateOpen(false);
      setCreatedToken(null);
      setNewToken({ name: '', description: '' });
      setCopied(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyToken = async () => {
    if (!createdToken) return;

    try {
      // Only try Clipboard API if available (HTTPS environments)
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(createdToken);
        setCopied(true);
        toast({
          title: 'Copied',
          description: 'Token copied to clipboard',
        });
        setTimeout(() => setCopied(false), 2000);
      } else {
        // Select the text and explain to the user
        const tokenInput = document.getElementById('token') as HTMLInputElement;
        if (tokenInput) {
          tokenInput.select();
          tokenInput.setSelectionRange(0, 99999); // For mobile devices
        }

        toast({
          title: 'Manual Copy Required',
          description:
            'Token selected. Press Ctrl+C (or Cmd+C) to copy. Automatic copying requires HTTPS.',
          duration: 6000,
        });
      }
    } catch (error) {
      // Select the text and explain
      try {
        const tokenInput = document.getElementById('token') as HTMLInputElement;
        if (tokenInput) {
          tokenInput.select();
          tokenInput.setSelectionRange(0, 99999);
        }
      } catch (selectError) {
        // Ignore selection errors
      }

      toast({
        title: 'Manual Copy Required',
        description:
          'Please select the token and press Ctrl+C (or Cmd+C) to copy. Automatic copying requires HTTPS.',
        duration: 6000,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Authentication Tokens</h2>
          <p className="text-muted-foreground">
            Manage API authentication tokens for worker processes
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>Create Token</Button>
      </div>

      <div className="grid gap-4">
        {tokens.map((token) => (
          <Card key={token.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Key className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-lg">{token.name}</CardTitle>
                    {token.description && (
                      <p className="text-sm text-muted-foreground">
                        {token.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      token.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {token.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex space-x-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleTokenActive(token)}
                      title={
                        token.is_active ? 'Deactivate token' : 'Activate token'
                      }
                    >
                      {token.is_active ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteToken(token)}
                      title="Delete token"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Token Preview</p>
                  <code className="font-mono">{token.token_preview}</code>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p>{formatDate(token.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Last Used</p>
                  <p>
                    {token.last_used ? formatDate(token.last_used) : 'Never'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {tokens.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <Key className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                No authentication tokens found
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first token to enable worker authentication
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {analytics && (
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4">Token Analytics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tokens
                </CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.total_tokens}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Tokens
                </CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {analytics.active_tokens}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Inactive Tokens
                </CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {analytics.inactive_tokens}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ever Used</CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {analytics.used_tokens}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Never Used
                </CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {analytics.never_used_tokens}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Used Recently
                </CardTitle>
                <Key className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {analytics.recent_active_tokens}
                </div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Create Authentication Token</DialogTitle>
            <DialogDescription>
              {createdToken
                ? "Your new token has been created. Copy it now as it won't be shown again."
                : 'Create a new authentication token for worker processes.'}
            </DialogDescription>
          </DialogHeader>
          {!createdToken ? (
            <>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={newToken.name}
                    onChange={(e) =>
                      setNewToken({ ...newToken, name: e.target.value })
                    }
                    placeholder="e.g., Production Worker"
                    disabled={isCreating}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    value={newToken.description}
                    onChange={(e) =>
                      setNewToken({ ...newToken, description: e.target.value })
                    }
                    placeholder="e.g., Used for automated benchmarking in CI/CD"
                    disabled={isCreating}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!newToken.name.trim() || isCreating}
                  onClick={handleCreateToken}
                >
                  {isCreating ? 'Creating...' : 'Create Token'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <div className="py-4">
                <div className="flex items-center space-x-2 mb-4">
                  <div className="grid flex-1 gap-2">
                    <Label htmlFor="token">Your Token</Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="token"
                        value={createdToken}
                        readOnly
                        className="font-mono text-sm select-all"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCopyToken}
                        className="shrink-0"
                        title="Copy token"
                      >
                        {copied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Store this token securely. It won't be displayed again.
                  </p>
                  {!navigator.clipboard && (
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
                      <p className="text-xs text-blue-800">
                        <strong>Note:</strong> Automatic copying requires HTTPS.
                        Click the token field and use Ctrl+C (or Cmd+C) to copy.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setCreatedToken(null);
                    setNewToken({ name: '', description: '' });
                    setCopied(false);
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
