'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api, type Repo } from '@/lib/api';
import { ExternalLink, Edit2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useAuthInfo } from '@propelauth/react';

export default function Repositories() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authInfo = useAuthInfo();
  const { isLoggedIn } = authInfo;
  const [editingRepoId, setEditingRepoId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState<string>('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const { data: repos = [], isLoading } = useQuery<Repo[]>({
    queryKey: ['repos'],
    queryFn: api.getAllRepos,
    enabled: isLoggedIn === true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const updateRepoMutation = useMutation({
    mutationFn: ({
      repoId,
      description,
    }: {
      repoId: string;
      description: string;
    }) => api.updateRepoDescription(repoId, description),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      setEditDialogOpen(false);
      setEditingRepoId(null);
      setEditDescription('');
      toast({
        title: 'Repository updated',
        description: 'Repository description has been updated successfully',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update repository',
        description:
          error.message ||
          'Unable to update repository description. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleEditClick = (repo: Repo) => {
    setEditingRepoId(repo.id);
    setEditDescription(repo.description || '');
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (editingRepoId) {
      updateRepoMutation.mutate({
        repoId: editingRepoId,
        description: editDescription,
      });
    }
  };

  const handleCancel = () => {
    setEditDialogOpen(false);
    setEditingRepoId(null);
    setEditDescription('');
  };

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">
              Please log in to view repositories.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Repositories</h1>
        <p className="text-muted-foreground mt-2">
          Manage repository descriptions to help decide which repository to use
          for tasks.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2 mt-2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-20 bg-muted rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : repos.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center py-8">
              No repositories found. Connect a GitHub provider in Integrations
              to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repos.map(repo => (
            <Card key={repo.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{repo.name}</CardTitle>
                    <CardDescription className="mt-1">
                      <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs hover:underline"
                      >
                        View on GitHub
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <div className="flex-1 mb-4">
                  {repo.description ? (
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {repo.description}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No description provided
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditClick(repo)}
                  className="w-full"
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit Description
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Repository Description</DialogTitle>
            <DialogDescription>
              Add or update a description for this repository. This information
              will help decide which repository to use for tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Enter repository description..."
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
              rows={6}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={updateRepoMutation.isPending}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateRepoMutation.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {updateRepoMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
