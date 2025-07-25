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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, LogOut, User } from 'lucide-react';
import api from '@/lib/api';
import BinariesManager from './components/BinariesManager';
import EnvironmentsManager from './components/EnvironmentsManager';
import AdminUsersManager from './components/AdminUsersManager';
import TokensManager from './components/TokensManager';
import CommitsManager from './components/CommitsManager';
import BenchmarkResultsManager from './components/BenchmarkResultsManager';
import QueryConsole from './components/QueryConsole';
import MemrayFailuresManager from './components/MemrayFailuresManager';

interface AdminUser {
  username: string;
  name?: string;
  avatar_url: string;
}

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';

export default function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);
  const { toast } = useToast();

  const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api';

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Uncomment to bypass auth for testing
    // setUser({
    //   username: 'test_admin',
    //   name: 'Test Admin',
    //   avatar_url: 'https://github.com/identicons/test.png'
    // });
    // setLoading(false);
    // return;
    try {
      const userData = await api.getAdminMe();
      setUser({
        username: userData.username,
        name: userData.name || userData.username,
        avatar_url: userData.avatar_url || 'https://github.com/identicons/default.png'
      });
    } catch (error) {
      // Silent fail for auth check - user will see login screen
    } finally {
      setLoading(false);
    }
  };

  const initiateGitHubAuth = async () => {
    setAuthenticating(true);
    try {
      const data = await api.getGitHubAuthUrl();

      // Redirect to GitHub OAuth
      window.location.href = data.auth_url;
    } catch (error) {
      toast({
        title: 'Authentication Failed',
        description: 'Failed to initiate GitHub authentication',
        variant: 'destructive',
      });
    } finally {
      setAuthenticating(false);
    }
  };

  const logout = async () => {
    try {
      await api.adminLogout();
      setUser(null);
      toast({
        title: 'Logged Out',
        description: 'You have been successfully logged out',
      });
    } catch (error) {
      toast({
        title: 'Logout Failed',
        description: 'Failed to logout properly',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-2xl">Admin Panel</CardTitle>
              <CardDescription className="mt-2">
                Sign in with GitHub to access the admin panel
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={initiateGitHubAuth}
              disabled={authenticating}
              className="w-full"
            >
              {authenticating ? 'Redirecting...' : 'Sign in with GitHub'}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Memory Tracker Administration
                </h1>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <img
                  src={user.avatar_url}
                  alt={user.username}
                  className="w-8 h-8 rounded-full"
                />
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    {user.name || user.username}
                  </p>
                  <p className="text-muted-foreground">@{user.username}</p>
                </div>
              </div>
              <Button variant="outline" onClick={logout}>
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="binaries" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="binaries">Binaries</TabsTrigger>
            <TabsTrigger value="environments">Environments</TabsTrigger>
            <TabsTrigger value="commits">Commits</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="memray">Memray</TabsTrigger>
            <TabsTrigger value="query">Query</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="tokens">Tokens</TabsTrigger>
          </TabsList>

          <TabsContent value="binaries">
            <BinariesManager />
          </TabsContent>

          <TabsContent value="environments">
            <EnvironmentsManager />
          </TabsContent>

          <TabsContent value="commits">
            <CommitsManager />
          </TabsContent>

          <TabsContent value="results">
            <BenchmarkResultsManager />
          </TabsContent>

          <TabsContent value="memray">
            <MemrayFailuresManager />
          </TabsContent>

          <TabsContent value="query">
            <QueryConsole />
          </TabsContent>

          <TabsContent value="users">
            <AdminUsersManager />
          </TabsContent>

          <TabsContent value="tokens">
            <TokensManager />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
