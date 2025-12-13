'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { StatusBadge } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useActivities } from '@/hooks/use-activities';
import {
  Power,
  Server,
  Edit,
  Plus,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { Agent } from '@/types';

export default function AgentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    host: '',
    port: '',
    ip: '',
    vibe_connection_id: '',
  });
  const [createForm, setCreateForm] = useState({
    name: '',
    host: '',
    port: '',
    ip: '',
    vibe_connection_id: '',
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
    refetchInterval: 10000,
  });

  const { data: integrationSecrets = [] } = useQuery({
    queryKey: ['integrationSecrets'],
    queryFn: () => api.getIntegrationSecrets(),
  });

  const { data: activities = [], isLoading: isLoadingActivities } =
    useActivities();

  const toggleStatusMutation = useMutation({
    mutationFn: api.toggleAgentStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast({
        title: 'Agent status updated',
        description: 'The agent status has been changed',
      });
    },
  });

  const reconnectMutation = useMutation({
    mutationFn: api.reconnectAgent,
    onSuccess: data => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast({
        title: data.success ? 'Reconnected' : 'Reconnection failed',
        description: data.message,
        variant: data.success ? 'default' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reconnect agent',
        variant: 'destructive',
      });
    },
  });

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      api.updateAgent(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast({
        title: 'Agent updated',
        description: 'The agent has been updated successfully',
      });
      setEditingAgent(null);
      setEditForm({
        name: '',
        host: '',
        port: '',
        ip: '',
        vibe_connection_id: '',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update agent',
        variant: 'destructive',
      });
    },
  });

  const createAgentMutation = useMutation({
    mutationFn: (data: any) => api.createAgent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast({
        title: 'Agent created',
        description: 'The agent has been created successfully',
      });
      setCreateDialogOpen(false);
      setCreateForm({
        name: '',
        host: '',
        port: '',
        ip: '',
        vibe_connection_id: '',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create agent',
        variant: 'destructive',
      });
    },
  });

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const handleEditClick = (agent: Agent) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name,
      host: agent.config.host,
      port: agent.config.port.toString(),
      ip: agent.config.ip || '',
      vibe_connection_id: agent.vibeConnectionId || '',
    });
  };

  const handleEditSubmit = () => {
    if (!editingAgent) return;

    if (!editForm.name || !editForm.host || !editForm.port) {
      toast({
        title: 'Validation Error',
        description: 'Name, host, and port are required',
        variant: 'destructive',
      });
      return;
    }

    const portNumber = parseInt(editForm.port, 10);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      toast({
        title: 'Validation Error',
        description: 'Port must be a number between 1 and 65535',
        variant: 'destructive',
      });
      return;
    }

    updateAgentMutation.mutate({
      id: editingAgent.id,
      data: {
        name: editForm.name,
        host: editForm.host,
        port: portNumber,
        ip: editForm.ip || undefined,
        vibe_connection_id: editForm.vibe_connection_id || undefined,
      },
    });
  };

  const vibeConnections = (
    integrationSecrets as Array<{
      id: string;
      providerType: string;
      name: string;
      storageType: 'gcp' | 'encrypted_local';
      createdAt: string;
      updatedAt: string;
    }>
  ).filter(secret =>
    ['cursor', 'claude-code', 'kiro-cli'].includes(secret.providerType)
  );

  const getVibeProviderIcon = (providerType: string) => {
    switch (providerType) {
      case 'cursor':
        return '/icons/cursor.png';
      case 'claude-code':
        return '/icons/claude.png';
      case 'kiro-cli':
        return '/icons/kiro.svg';
      default:
        return null;
    }
  };

  const handleCreateAgent = () => {
    if (!createForm.name || !createForm.host || !createForm.port) {
      toast({
        title: 'Validation Error',
        description: 'Name, host, and port are required',
        variant: 'destructive',
      });
      return;
    }

    const portNumber = parseInt(createForm.port, 10);
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      toast({
        title: 'Validation Error',
        description: 'Port must be a number between 1 and 65535',
        variant: 'destructive',
      });
      return;
    }

    createAgentMutation.mutate({
      name: createForm.name,
      host: createForm.host,
      port: portNumber,
      ip: createForm.ip || undefined,
      status: 'offline',
      vibe_connection_id: createForm.vibe_connection_id || undefined,
    });
  };

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage your Sia execution agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-status-active" />
            {agents.filter(a => a.status === 'active').length} Active
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-status-idle" />
            {agents.filter(a => a.status === 'idle').length} Idle
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <div className="h-2 w-2 rounded-full bg-status-offline" />
            {agents.filter(a => a.status === 'offline').length} Offline
          </Badge>
          <Button onClick={() => setCreateDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Agent
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 my-4">
        {agents.map((agent, index) => (
          <Card
            key={agent.id}
            className="flex flex-col max-h-[calc(100vh-12rem)]"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    {agent.name}
                  </CardTitle>
                  <StatusBadge status={agent.status} />
                  {(!agent.vibeConnection ||
                    !agent.vibeConnection.id ||
                    !agent.vibeConnection.name) && (
                    <div className="flex items-center gap-2 text-xs text-destructive mt-1">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Not attached to a vibe coding agent</span>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reconnectMutation.mutate(agent.id)}
                    disabled={reconnectMutation.isPending}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditClick(agent)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleStatusMutation.mutate(agent.id)}
                    disabled={toggleStatusMutation.isPending}
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 overflow-y-hidden flex-1">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Machine Configuration
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IP:</span>
                    <span className="font-mono">
                      {agent.config.ip || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Host:</span>
                    <span className="font-mono">{agent.config.host}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Port:</span>
                    <span className="font-mono">{agent.config.port}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Vibe Coding Agent
                </p>
                {agent.vibeConnection &&
                agent.vibeConnection.id &&
                agent.vibeConnection.name ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {getVibeProviderIcon(
                        agent.vibeConnection.providerType
                      ) && (
                        <Image
                          src={
                            getVibeProviderIcon(
                              agent.vibeConnection.providerType
                            )!
                          }
                          alt={agent.vibeConnection.providerType}
                          width={20}
                          height={20}
                          className="h-5 w-5"
                        />
                      )}
                      <span className="text-xs font-medium">
                        {agent.vibeConnection.name}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {agent.vibeConnection.providerType}
                    </p>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-xs"
                      onClick={() => router.push('/integrations')}
                    >
                      Manage connection{' '}
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Not connected</p>
                )}
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Last Active
                </p>
                <p className="text-xs">{formatTime(agent.lastActive)}</p>
              </div>

              <Separator />

              {/* Show activities for the first agent */}
              {index === 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Recent Activity
                  </p>
                  {isLoadingActivities ? (
                    <p className="text-xs text-muted-foreground">
                      Loading activities...
                    </p>
                  ) : activities.length > 0 ? (
                    <div className="space-y-2">
                      {activities.slice(0, 3).map(activity => (
                        <div key={activity.id} className="text-xs">
                          <p>{activity.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTime(activity.created_at)}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No recent activity
                    </p>
                  )}
                </div>
              )}

              {/* Show simple recent activity for other agents */}
              {index !== 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Recent Activity
                  </p>
                  {agent.recentActivity.length > 0 ? (
                    <div className="space-y-2">
                      {agent.recentActivity.map(
                        (activity: {
                          id: string;
                          action: string;
                          timestamp: string;
                        }) => (
                          <div key={activity.id} className="text-xs">
                            <p>{activity.action}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatTime(activity.timestamp)}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No recent activity
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editingAgent} onOpenChange={() => setEditingAgent(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update the agent configuration details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-xs font-medium">
                Name
              </label>
              <Input
                id="name"
                value={editForm.name}
                onChange={e =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
                placeholder="Agent name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="host" className="text-xs font-medium">
                Host
              </label>
              <Input
                id="host"
                value={editForm.host}
                onChange={e =>
                  setEditForm({ ...editForm, host: e.target.value })
                }
                placeholder="hostname or IP"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="port" className="text-xs font-medium">
                Port
              </label>
              <Input
                id="port"
                type="number"
                value={editForm.port}
                onChange={e =>
                  setEditForm({ ...editForm, port: e.target.value })
                }
                placeholder="8080"
                min="1"
                max="65535"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ip" className="text-xs font-medium">
                IP Address (optional)
              </label>
              <Input
                id="ip"
                value={editForm.ip}
                onChange={e => setEditForm({ ...editForm, ip: e.target.value })}
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="vibe_connection" className="text-xs font-medium">
                Vibe Coding Platform Connection
              </label>
              <select
                id="vibe_connection"
                value={editForm.vibe_connection_id}
                onChange={e =>
                  setEditForm({
                    ...editForm,
                    vibe_connection_id: e.target.value,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">None</option>
                {vibeConnections.map(connection => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} ({connection.providerType})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingAgent(null)}
              disabled={updateAgentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={updateAgentMutation.isPending}
            >
              {updateAgentMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Add a new Sia execution agent to your organization
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="create-name" className="text-xs font-medium">
                Name
              </label>
              <Input
                id="create-name"
                value={createForm.name}
                onChange={e =>
                  setCreateForm({ ...createForm, name: e.target.value })
                }
                placeholder="Agent name"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="create-host" className="text-xs font-medium">
                Host
              </label>
              <Input
                id="create-host"
                value={createForm.host}
                onChange={e =>
                  setCreateForm({ ...createForm, host: e.target.value })
                }
                placeholder="hostname or IP"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="create-port" className="text-xs font-medium">
                Port
              </label>
              <Input
                id="create-port"
                type="number"
                value={createForm.port}
                onChange={e =>
                  setCreateForm({ ...createForm, port: e.target.value })
                }
                placeholder="8080"
                min="1"
                max="65535"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="create-ip" className="text-xs font-medium">
                IP Address (optional)
              </label>
              <Input
                id="create-ip"
                value={createForm.ip}
                onChange={e =>
                  setCreateForm({ ...createForm, ip: e.target.value })
                }
                placeholder="192.168.1.100"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="create-vibe-connection"
                className="text-xs font-medium"
              >
                Vibe Coding Platform Connection (optional)
              </label>
              <select
                id="create-vibe-connection"
                value={createForm.vibe_connection_id}
                onChange={e =>
                  setCreateForm({
                    ...createForm,
                    vibe_connection_id: e.target.value,
                  })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">None</option>
                {vibeConnections.map(connection => (
                  <option key={connection.id} value={connection.id}>
                    {connection.name} ({connection.providerType})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Select a vibe coding platform connection to use with this agent
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                setCreateForm({
                  name: '',
                  host: '',
                  port: '',
                  ip: '',
                  vibe_connection_id: '',
                });
              }}
              disabled={createAgentMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAgent}
              disabled={createAgentMutation.isPending}
            >
              {createAgentMutation.isPending ? 'Creating...' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
