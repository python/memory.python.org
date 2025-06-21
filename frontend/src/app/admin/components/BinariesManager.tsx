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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Server } from 'lucide-react';

interface Binary {
  id: string;
  name: string;
  flags: string[];
  description?: string;
  color?: string;
  icon?: string;
  display_order?: number;
}

export default function BinariesManager() {
  const [binaries, setBinaries] = useState<Binary[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBinary, setEditingBinary] = useState<Binary | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    flags: '',
    description: '',
    color: '#8b5cf6',
    icon: 'server',
    display_order: 0,
  });

  useEffect(() => {
    loadBinaries();
  }, []);

  const loadBinaries = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/binaries`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setBinaries(data);
      } else {
        throw new Error('Failed to load binaries');
      }
    } catch (error) {
      console.error('Error loading binaries:', error);
      toast({
        title: 'Error',
        description: 'Failed to load binaries',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const binaryData = {
      id: formData.id,
      name: formData.name,
      flags: formData.flags
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f),
      description: formData.description || null,
      color: formData.color,
      icon: formData.icon,
      display_order: parseInt(formData.display_order.toString()) || 0,
    };

    try {
      const url = editingBinary
        ? `${API_BASE}/admin/binaries/${editingBinary.id}`
        : `${API_BASE}/admin/binaries`;

      const method = editingBinary ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(binaryData),
      });

      if (response.ok) {
        await loadBinaries();
        setIsDialogOpen(false);
        resetForm();
        toast({
          title: 'Success',
          description: `Binary ${
            editingBinary ? 'updated' : 'created'
          } successfully`,
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Operation failed');
      }
    } catch (error) {
      console.error('Error saving binary:', error);
      toast({
        title: 'Error',
        description: `Failed to ${
          editingBinary ? 'update' : 'create'
        } binary: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (binary: Binary) => {
    setEditingBinary(binary);
    setFormData({
      id: binary.id,
      name: binary.name,
      flags: binary.flags.join(', '),
      description: binary.description || '',
      color: binary.color || '#8b5cf6',
      icon: binary.icon || 'server',
      display_order: binary.display_order || 0,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (binary: Binary) => {
    if (!confirm(`Are you sure you want to delete "${binary.name}"?`)) return;

    try {
      const response = await fetch(`${API_BASE}/admin/binaries/${binary.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await loadBinaries();
        toast({
          title: 'Success',
          description: 'Binary deleted successfully',
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Delete failed');
      }
    } catch (error) {
      console.error('Error deleting binary:', error);
      toast({
        title: 'Error',
        description: `Failed to delete binary: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      flags: '',
      description: '',
      color: '#8b5cf6',
      icon: 'server',
      display_order: 0,
    });
    setEditingBinary(null);
  };

  const handleNewBinary = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Binary Configurations</h2>
          <p className="text-gray-600">Manage Python build configurations</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleNewBinary}>
              <Plus className="w-4 h-4 mr-2" />
              Add Binary
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBinary ? 'Edit Binary' : 'Create New Binary'}
              </DialogTitle>
              <DialogDescription>
                {editingBinary
                  ? 'Update the binary configuration details'
                  : 'Add a new Python binary configuration'}
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
                  placeholder="e.g., optimized-python"
                  required
                  disabled={!!editingBinary}
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
                  placeholder="e.g., Optimized Python Build"
                  required
                />
              </div>

              <div>
                <Label htmlFor="flags">Build Flags</Label>
                <Input
                  id="flags"
                  value={formData.flags}
                  onChange={(e) =>
                    setFormData({ ...formData, flags: e.target.value })
                  }
                  placeholder="e.g., --enable-optimizations, --with-computed-gotos"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Comma-separated list of build flags
                </p>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Description of this binary configuration..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="color">Color</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="color"
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="w-12 h-10 p-1 border rounded"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      placeholder="#8b5cf6"
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="icon">Icon</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) =>
                      setFormData({ ...formData, icon: e.target.value })
                    }
                    placeholder="server"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lucide React icon name
                  </p>
                </div>
              </div>

              <div>
                <Label htmlFor="display_order">Display Order</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={formData.display_order}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      display_order: parseInt(e.target.value) || 0,
                    })
                  }
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Lower numbers appear first
                </p>
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
                  {editingBinary ? 'Update' : 'Create'}
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
          {binaries.map((binary) => (
            <Card key={binary.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center"
                      style={{ backgroundColor: binary.color || '#8b5cf6' }}
                    >
                      <Server className="w-3 h-3 text-white" />
                    </div>
                    <CardTitle className="text-lg">{binary.name}</CardTitle>
                  </div>
                  <div className="flex space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(binary)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(binary)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardDescription>ID: {binary.id}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {binary.description && (
                    <p className="text-sm text-gray-600">
                      {binary.description}
                    </p>
                  )}

                  <div>
                    <p className="text-sm font-medium mb-2">Build Flags:</p>
                    <div className="flex flex-wrap gap-1">
                      {binary.flags.length > 0 ? (
                        binary.flags.map((flag) => (
                          <Badge
                            key={flag}
                            variant="secondary"
                            className="text-xs"
                          >
                            {flag}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">
                          No flags specified
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && binaries.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              No binaries found
            </h3>
            <p className="text-gray-500">
              Get started by creating your first binary configuration.
            </p>
            <Button className="mt-4" onClick={handleNewBinary}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Binary
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
