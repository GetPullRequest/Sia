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
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react';
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

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function DeveloperSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authInfo = useAuthInfo();
  const { isLoggedIn } = authInfo;
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);

  const { data: apiKeys = [], isLoading } = useQuery<ApiKey[]>({
    queryKey: ['apiKeys'],
    queryFn: api.getApiKeys,
    enabled: isLoggedIn === true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => api.createApiKey(name),
    onSuccess: data => {
      if (!data || !data.apiKey) {
        toast({
          title: 'Error',
          description:
            'API key was created but the response format was unexpected',
          variant: 'destructive',
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      setNewApiKey(data.apiKey);
      setApiKeyName('');
      setCreateDialogOpen(false);
      toast({
        title: 'API key created',
        description:
          "Your API key has been created successfully. Make sure to copy it now - you won't be able to see it again!",
      });
    },
    onError: error => {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to create API key',
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      toast({
        title: 'API key deleted',
        description: 'Your API key has been deleted successfully',
      });
    },
    onError: error => {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to delete API key',
        variant: 'destructive',
      });
    },
  });

  const handleCreate = async () => {
    if (!apiKeyName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for the API key',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    try {
      await createMutation.mutateAsync(apiKeyName.trim());
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the API key "${name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    deleteMutation.mutate(id);
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKeyId(keyId);
      setTimeout(() => setCopiedKeyId(null), 2000);
      toast({
        title: 'Copied',
        description: 'API key copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 text-foreground">
          Developer Settings
        </h1>
        <p className="text-muted-foreground">
          Manage your API keys for programmatic access to Sia
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-heading">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription className="mt-2 text-sm">
                API keys allow you to authenticate requests to the Sia API. Keep
                your keys secure and never share them publicly.
              </CardDescription>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
              className="text-sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading API keys...
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <Key className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">No API keys yet</p>
              <Button
                onClick={() => setCreateDialogOpen(true)}
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create your first API key
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map(key => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{key.name}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                        {key.keyPrefix}...
                      </code>
                      <span>•</span>
                      <span>Created {formatDate(key.createdAt)}</span>
                      {key.lastUsedAt && (
                        <>
                          <span>•</span>
                          <span>Last used {formatDate(key.lastUsedAt)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(key.id, key.name)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API Key</DialogTitle>
            <DialogDescription>
              Enter a name to identify this API key. You&apos;ll be able to copy
              the key after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label
                htmlFor="api-key-name"
                className="text-sm font-medium mb-2 block"
              >
                Name
              </label>
              <Input
                id="api-key-name"
                placeholder="e.g., Production API Key"
                value={apiKeyName}
                onChange={e => setApiKeyName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && apiKeyName.trim()) {
                    handleCreate();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !apiKeyName.trim()}
            >
              {creating ? 'Creating...' : 'Create API Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {newApiKey && (
        <Dialog open={!!newApiKey} onOpenChange={() => setNewApiKey(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>API Key Created</DialogTitle>
              <DialogDescription>
                Make sure to copy your API key now. You won&apos;t be able to
                see it again!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg">
                <code className="text-sm font-mono break-all">{newApiKey}</code>
              </div>
              <Button
                onClick={() => copyToClipboard(newApiKey, 'new-key')}
                className="w-full"
                variant="outline"
              >
                {copiedKeyId === 'new-key' ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy API Key
                  </>
                )}
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => setNewApiKey(null)} className="w-full">
                I&apos;ve copied the key
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
