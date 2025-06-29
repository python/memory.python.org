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
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Trash2,
  User,
  Calendar,
  UserCheck,
  AlertTriangle,
  Shield,
  Crown,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { AdminUserResponse, AdminUserCreate } from '@/lib/types';

export default function AdminUsersManager() {
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    github_username: '',
    notes: '',
  });
  const { toast } = useToast();


  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const data = await api.getAdminUsersList();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch admin users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const createUser = async () => {
    if (!newUser.github_username.trim()) {
      toast({
        title: 'Validation Error',
        description: 'GitHub username is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      const createdUser = await api.createAdminUser({
        github_username: newUser.github_username.trim(),
        notes: newUser.notes.trim() || undefined,
      });
      
      setUsers((prev) => [...prev, createdUser]);
      setNewUser({ github_username: '', notes: '' });
      setDialogOpen(false);
      toast({
        title: 'Success',
        description: `Admin user @${createdUser.github_username} created successfully`,
      });
    } catch (error) {
      console.error('Error creating admin user:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to create admin user',
        variant: 'destructive',
      });
    }
  };

  const removeUser = async (username: string) => {
    const isConfirmed = confirm(
      `Remove admin access for @${username}?\n\n` +
        `This user will lose access to the administration panel and all admin features.\n\n` +
        `Are you sure you want to continue?`
    );

    if (!isConfirmed) {
      return;
    }

    try {
      await api.deleteAdminUser(username);
      setUsers((prev) =>
        prev.filter((user) => user.github_username !== username)
      );
      toast({
        title: 'Success',
        description: `Admin user @${username} removed successfully`,
      });
    } catch (error) {
      console.error('Error removing admin user:', error);
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to remove admin user',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              Admin Users
              <Badge variant="secondary" className="ml-2 text-xs">
                Administrative Access
              </Badge>
            </CardTitle>
            <CardDescription>
              Manage users with administrative privileges. Admin users can
              access this panel and manage system configurations.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Admin User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Admin User</DialogTitle>
                <DialogDescription>
                  Grant administrative access to a GitHub user. They will be
                  able to access this admin panel and manage system settings.
                </DialogDescription>
                <div className="p-3 bg-muted/50 border rounded-md">
                  <div className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium">
                        Administrative privileges include:
                      </div>
                      <div className="text-muted-foreground text-xs mt-1">
                        Binary configurations • Environment settings • Run
                        management • User administration
                      </div>
                    </div>
                  </div>
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">GitHub Username</Label>
                  <Input
                    id="username"
                    placeholder="e.g., octocat"
                    value={newUser.github_username}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        github_username: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="e.g., Core team member, temporary access, etc."
                    value={newUser.notes}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, notes: e.target.value }))
                    }
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button onClick={createUser} className="flex-1">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Admin User
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No admin users found</p>
            <p className="text-sm">Add your first admin user to get started</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>GitHub User</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Added Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">
                          @{user.github_username}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      @{user.added_by}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        {formatDate(user.added_at)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? 'default' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {user.notes ? (
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {user.notes}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          No notes
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeUser(user.github_username)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {users.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            <p>
              💡 <strong>Tip:</strong> Admin users can log in with their GitHub
              account and access this administration panel.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
