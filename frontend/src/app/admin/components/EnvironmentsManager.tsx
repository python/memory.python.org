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
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Monitor } from 'lucide-react';

interface Environment {
  id: string;
  name: string;
  description?: string;
}

export default function EnvironmentsManager() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [
    editingEnvironment,
    setEditingEnvironment,
  ] = useState<Environment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
  });

  useEffect(() => {
    loadEnvironments();
  }, []);

  const loadEnvironments = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/environments`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setEnvironments(data);
      } else {
        throw new Error('Failed to load environments');
      }
    } catch (error) {
      console.error('Error loading environments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load environments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const environmentData = {
      id: formData.id,
      name: formData.name,
      description: formData.description || null,
    };

    try {
      const url = editingEnvironment
        ? `${API_BASE}/admin/environments/${editingEnvironment.id}`
        : `${API_BASE}/admin/environments`;

      const method = editingEnvironment ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(environmentData),
      });

      if (response.ok) {
        await loadEnvironments();
        setIsDialogOpen(false);
        resetForm();
        toast({
          title: 'Success',
          description: `Environment ${
            editingEnvironment ? 'updated' : 'created'
          } successfully`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving environment:', error);
      toast({
        title: 'Error',
        description: `Failed to ${
          editingEnvironment ? 'update' : 'create'
        } environment: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (environment: Environment) => {
    setEditingEnvironment(environment);
    setFormData({
      id: environment.id,
      name: environment.name,
      description: environment.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (environment: Environment) => {
    if (!confirm(`Are you sure you want to delete "${environment.name}"?`))
      return;

    try {
      const response = await fetch(
        `${API_BASE}/admin/environments/${environment.id}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      if (response.ok) {
        await loadEnvironments();
        toast({
          title: 'Success',
          description: 'Environment deleted successfully',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting environment:', error);
      toast({
        title: 'Error',
        description: `Failed to delete environment: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      description: '',
    });
    setEditingEnvironment(null);
  };

  const handleNewEnvironment = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Test Environments</h2>
          <p className="text-gray-600">
            Manage benchmark execution environments
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewEnvironment}>
              <Plus className="w-4 h-4 mr-2" />
              Add Environment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingEnvironment
                  ? 'Edit Environment'
                  : 'Create New Environment'}
              </DialogTitle>
              <DialogDescription>
                {editingEnvironment
                  ? 'Update the environment details'
                  : 'Add a new test environment configuration'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="id">ID</Label>
                <Input
                  id="id"
                  value={formData.id}
                  onChange={(e) =>
                    setFormData({ ...formData, id: e.target.value })
                  }
                  placeholder="e.g., linux-x86_64"
                  required
                  disabled={!!editingEnvironment}
                />
              </div>

              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Linux x86_64"
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description of this environment..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {editingEnvironment ? 'Update' : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {environments.map((environment) => (
            <Card
              key={environment.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Monitor className="w-5 h-5 text-green-600" />
                    <CardTitle className="text-lg">
                      {environment.name}
                    </CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(environment)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(environment)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>ID: {environment.id}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {environment.description ? (
                    <p className="text-sm text-gray-600">
                      {environment.description}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">
                      No description provided
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && environments.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No environments found
            </h3>
            <p className="text-gray-500">
              Get started by creating your first test environment.
            </p>
            <Button className="mt-4" onClick={handleNewEnvironment}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Environment
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
