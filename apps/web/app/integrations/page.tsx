"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { StatusBadge } from '@/components/status-badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { ExternalLink, Eye, EyeOff } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { useAuthInfo } from '@propelauth/react'
import type { RepoProvider } from '@sia/models'


const supportedIntegrations = ['slack', 'github', 'cursor', 'claude-code', 'kiro-cli']
const comingSoonIntegrations = ['discord', 'linear', 'gitlab']

export default function Integrations() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const authInfo = useAuthInfo()
  const { isLoggedIn } = authInfo
  const [connectingId, setConnectingId] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [apiKeyDialogOpen, setApiKeyDialogOpen] = useState(false)
  const [apiKeyIntegrationId, setApiKeyIntegrationId] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [apiKeyName, setApiKeyName] = useState('')
  const [savingApiKey, setSavingApiKey] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations'],
    queryFn: api.getIntegrations,
  })

  const { data: githubProviders = [] } = useQuery<RepoProvider[]>({
    queryKey: ['githubProviders'],
    queryFn: api.getGitHubProviders,
    enabled: isLoggedIn === true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  interface SlackProvider {
    id: string;
    name: string;
    provider_team_id?: string;
    management_url?: string;
    [key: string]: unknown;
  }
  const { data: slackProviders = [] } = useQuery<SlackProvider[]>({
    queryKey: ['slackProviders'],
    queryFn: api.getSlackProviders,
    enabled: isLoggedIn === true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  interface IntegrationSecret {
    id: string;
    providerType: string;
    name: string;
    storageType: 'gcp' | 'encrypted_local';
    createdAt: string;
    updatedAt: string;
  }
  const { data: integrationSecrets = [] } = useQuery<IntegrationSecret[]>({
    queryKey: ['integrationSecrets'],
    queryFn: () => api.getIntegrationSecrets(),
    enabled: isLoggedIn === true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  const toggleMutation = useMutation({
    mutationFn: api.toggleIntegration,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      setConnectingId(null)
      setProgress(0)
      toast({
        title: data?.status === 'connected' ? 'Integration connected' : 'Integration disconnected',
        description: `${data?.name} has been ${data?.status === 'connected' ? 'connected' : 'disconnected'} successfully`,
      })
    },
  })

  const disconnectGitHubMutation = useMutation({
    mutationFn: api.disconnectGitHubProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['githubProviders'] })
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      toast({
        title: 'GitHub disconnected',
        description: 'GitHub integration has been disconnected successfully',
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect GitHub',
        variant: 'destructive',
      })
    },
  })

  const disconnectSlackMutation = useMutation({
    mutationFn: api.disconnectSlackProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slackProviders'] })
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      toast({
        title: 'Slack disconnected',
        description: 'Slack integration has been disconnected successfully',
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect Slack',
        variant: 'destructive',
      })
    },
  })

  const handleSaveApiKey = async () => {
    if (!apiKeyIntegrationId || !apiKey.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a valid API key',
        variant: 'destructive',
      })
      return
    }

    if (!apiKeyName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name/label for this API key',
        variant: 'destructive',
      })
      return
    }

    setSavingApiKey(true)
    try {
      await api.storeIntegrationSecret({
        providerType: apiKeyIntegrationId,
        name: apiKeyName.trim(),
        apiKey: apiKey.trim(),
      })
      
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['integrationSecrets'] })
      
      setApiKeyDialogOpen(false)
      setApiKey('')
      setApiKeyName('')
      setApiKeyIntegrationId(null)
      
      toast({
        title: 'API key saved',
        description: 'Your API key has been saved successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save API key',
        variant: 'destructive',
      })
    } finally {
      setSavingApiKey(false)
    }
  }

  const handleConnect = async (id: string) => {
    const integration = integrations.find(i => i.id === id)
    if (!integration) return

    const isConnected = isIntegrationConnected(id)

    // Check if this is a vibe coding platform that requires API key
    const vibePlatforms = ['cursor', 'claude-code', 'kiro-cli']
    if (vibePlatforms.includes(id)) {
      // If already connected, disconnect by deleting the stored secret
      if (isConnected) {
        const secret = integrationSecrets.find((s: IntegrationSecret) => s.providerType === id)
        if (!secret) {
          toast({
            title: 'Error',
            description: 'No API key found to disconnect for this integration.',
            variant: 'destructive',
          })
          return
        }

        try {
          await api.deleteIntegrationSecret(secret.id)
          queryClient.invalidateQueries({ queryKey: ['integrationSecrets'] })
          queryClient.invalidateQueries({ queryKey: ['integrations'] })
          toast({
            title: 'Integration disconnected',
            description: `${integration.name} has been disconnected successfully`,
          })
        } catch (error) {
          toast({
            title: 'Error',
            description: error instanceof Error ? error.message : 'Failed to disconnect integration',
            variant: 'destructive',
          })
        }
        return
      }
      
      // Show API key dialog to connect
      setApiKeyIntegrationId(id)
      setApiKeyDialogOpen(true)
      return
    }

    // Handle GitHub disconnect
    if (id === 'github' && githubProviders.length > 0) {
      const provider = githubProviders[0]
      disconnectGitHubMutation.mutate(provider.id)
      return
    }

    // Handle Slack disconnect
    if (id === 'slack' && slackProviders.length > 0) {
      const provider = slackProviders[0]
      disconnectSlackMutation.mutate(provider.id)
      return
    }

    if (integration.status === 'connected') {
      toggleMutation.mutate(id)
      return
    }

    // Handle GitHub integration
    if (id === 'github') {
      setConnectingId(id)
      setProgress(20)

      try {
        setProgress(50)
        const redirectUrl = await api.connectGitHub()
        setProgress(80)

        if (process.env.NODE_ENV === 'development') {
          console.log('[Integrations] Redirect URL received:', redirectUrl);
        }

        if (!redirectUrl) {
          throw new Error('No redirect URL received from server');
        }

        setProgress(100)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[Integrations] Redirecting to:', redirectUrl);
        }
        
        window.location.replace(redirectUrl);
      } catch (error) {
        console.error('Failed to connect GitHub:', error)
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to initiate GitHub connection',
          variant: 'destructive',
        })
        setConnectingId(null)
      }
      return
    }

    // Handle Slack integration
    if (id === 'slack') {
      setConnectingId(id)
      setProgress(20)

      try {
        setProgress(50)
        const redirectUrl = await api.connectSlack()
        setProgress(80)

        if (process.env.NODE_ENV === 'development') {
          console.log('[Integrations] Slack redirect URL received:', redirectUrl);
        }

        if (!redirectUrl) {
          throw new Error('No redirect URL received from server');
        }

        setProgress(100)
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[Integrations] Redirecting to Slack:', redirectUrl);
        }
        
        window.location.replace(redirectUrl);
      } catch (error) {
        console.error('Failed to connect Slack:', error)
        toast({
          title: 'Error',
          description: error instanceof Error ? error.message : 'Failed to initiate Slack connection',
          variant: 'destructive',
        })
        setConnectingId(null)
      }
      return
    }

    // Simulate OAuth flow for other integrations
    setConnectingId(id)
    setProgress(0)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval)
          return prev
        }
        return prev + 10
      })
    }, 100)

    setTimeout(() => {
      clearInterval(interval)
      setProgress(100)
      setTimeout(() => {
        toggleMutation.mutate(id)
      }, 500)
    }, 1500)
  }

  const getIntegrationById = (id: string) => {
    return integrations.find(i => i.id === id)
  }

  const isIntegrationConnected = (id: string) => {
    if (id === 'github') {
      return githubProviders.length > 0
    }
    if (id === 'slack') {
      return slackProviders.length > 0
    }
    // Check if there's an integration secret for API key-based integrations
    const vibePlatforms = ['cursor', 'claude-code', 'kiro-cli']
    if (vibePlatforms.includes(id)) {
      return integrationSecrets.length > 0 && integrationSecrets.some((secret: IntegrationSecret) => secret.providerType === id)
    }
    const integration = getIntegrationById(id)
    return integration?.status === 'connected'
  }

  const supportedIntegrationsList = supportedIntegrations
    .map(id => getIntegrationById(id))
    .filter(Boolean)

  const comingSoonIntegrationsList = comingSoonIntegrations
    .map(id => getIntegrationById(id))
    .filter(Boolean)

  const renderIntegrationCard = (integration: NonNullable<ReturnType<typeof getIntegrationById>>) => {
    const isGitHub = integration.id === 'github'
    const isSlack = integration.id === 'slack'
    const isCursor = integration.id === 'cursor'
    const isClaudeCode = integration.id === 'claude-code'
    const isKiroCli = integration.id === 'kiro-cli'
    const isLinear = integration.id === 'linear'
    const isDiscord = integration.id === 'discord'
    const isGitLab = integration.id === 'gitlab'
    const vibePlatforms = ['cursor', 'claude-code', 'kiro-cli']
    const isVibePlatform = vibePlatforms.includes(integration.id)
    const githubProvider = isGitHub ? githubProviders[0] : null
    const slackProvider = isSlack ? slackProviders[0] : null
    const isConnected = isIntegrationConnected(integration.id)
    const isComingSoon = comingSoonIntegrations.includes(integration.id)
    const integrationSecret = isVibePlatform
      ? integrationSecrets.find((secret: IntegrationSecret) => secret.providerType === integration.id)
      : null

    const renderIcon = () => {
      if (isGitHub) {
        return (
          <Image
            src="/icons/github.png"
            alt="GitHub"
            width={24}
            height={24}
            className="h-6 w-6"
          />
        )
      }
      if (isSlack) {
        return (
          <Image
            src="/icons/slack.jpeg"
            alt="Slack"
            width={24}
            height={24}
            className="h-6 w-6"
          />
        )
      }
      if (isCursor) {
        return (
          <Image
            src="/icons/cursor.png"
            alt="Cursor"
            width={24}
            height={24}
            className="h-6 w-6"
          />
        )
      }
      if (isClaudeCode) {
        return (
          <Image
            src="/icons/claude.png"
            alt="Claude Code"
            width={24}
            height={24}
            className="h-6 w-6"
          />
        )
      }
      if (isKiroCli) {
        return (
          <Image
            src="/icons/kiro.svg"
            alt="Kiro CLI"
            width={24}
            height={24}
            className="h-6 w-6"
          />
        )
      }
      if (isLinear) {
        return (
          <Image
            src="/icons/linear.png"
            alt="Linear"
            width={24}
            height={24}
            className="h-6 w-6"
          />
        )
      }
      if (isDiscord) {
        return (
          <Image
            src="/icons/discord.svg"
            alt="Discord"
            width={24}
            height={24}
            className="h-6 w-6"
          />
        )
      }
      if (isGitLab) {
        return (
          <Image
            src="/icons/gitlab.png"
            alt="GitLab"
            width={24}
            height={24}
            className="h-6 w-6"
          />
        )
      }
      return null
    }

    return (
      <Card key={integration.id}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                {renderIcon()}
                {integration.name}
              </CardTitle>
              <StatusBadge status={isConnected ? 'connected' : integration.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CardDescription className="text-sm">
            {integration.description}
          </CardDescription>
          {isVibePlatform && isConnected && integrationSecret && (
            <div className="text-sm space-y-1 pt-2 border-t">
              <p className="text-muted-foreground">
                Connected key:{' '}
                <span className="font-medium">
                  {integrationSecret.name}
                </span>
              </p>
            </div>
          )}
          {isGitHub && isConnected && githubProvider && (
            <div className="text-sm space-y-1 pt-2 border-t">
              <p className="text-muted-foreground">
                Connected to: <span className="font-medium">{githubProvider.description || githubProvider.name}</span>
              </p>
              {(() => {
                const installationId = githubProvider.metadata && typeof githubProvider.metadata === 'object' && 'installation_id' in githubProvider.metadata 
                  ? String(githubProvider.metadata.installation_id) 
                  : null;
                return installationId ? (
                  <a
                    href={`https://github.com/settings/installations/${installationId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs flex items-center gap-1"
                  >
                    View installation <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null;
              })()}
            </div>
          )}
          {isSlack && isConnected && slackProvider && (
            <div className="text-sm space-y-1 pt-2 border-t">
              <p className="text-muted-foreground">
                Connected to: <span className="font-medium">{slackProvider.name || 'Slack Workspace'}</span>
              </p>
              {slackProvider.management_url && (
                <a
                  href={slackProvider.management_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline text-xs flex items-center gap-1"
                >
                  Manage app <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          )}
          {isComingSoon ? (
            <Button
              onClick={() => {
                window.location.href = 'mailto:hi@getpullrequest.com';
              }}
              variant="default"
              className="w-full"
            >
              Contact Support
            </Button>
          ) : (
            <Button
              onClick={() => handleConnect(integration.id)}
              disabled={
                toggleMutation.isPending || 
                connectingId === integration.id ||
                (isGitHub && disconnectGitHubMutation.isPending) ||
                (isSlack && disconnectSlackMutation.isPending)
              }
              variant={isConnected ? 'outline' : 'default'}
              className="w-full"
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect external services to enhance your workflow
        </p>
      </div>

      {supportedIntegrationsList.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {supportedIntegrationsList.map(integration => integration && renderIntegrationCard(integration))}
          </div>
        </div>
      )}

      {comingSoonIntegrationsList.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold">Coming Soon</h2>
            <p className="text-sm text-muted-foreground">
              Integrations we&apos;re working on
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {comingSoonIntegrationsList.map(integration => integration && renderIntegrationCard(integration))}
          </div>
        </div>
      )}

      {/* API Key Dialog */}
      <Dialog open={apiKeyDialogOpen} onOpenChange={setApiKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {apiKeyIntegrationId && getIntegrationById(apiKeyIntegrationId)?.name}</DialogTitle>
            <DialogDescription>
              Enter your API key to connect this integration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="api-key-name" className="text-sm font-medium">
                Name / Label
              </label>
              <Input
                id="api-key-name"
                type="text"
                placeholder="e.g., Production API Key, Personal Key"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                disabled={savingApiKey}
              />
              <p className="text-xs text-muted-foreground">
                A short description to help you identify this key in the future
              </p>
            </div>
            <div className="space-y-2">
              <label htmlFor="api-key" className="text-sm font-medium">
                API Key
              </label>
              <div className="relative">
                <Input
                  id="api-key"
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="Enter your API key"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  disabled={savingApiKey}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={savingApiKey}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                >
                  {showApiKey ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setApiKeyDialogOpen(false)
                setApiKey('')
                setApiKeyName('')
                setApiKeyIntegrationId(null)
              }}
              disabled={savingApiKey}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveApiKey}
              disabled={savingApiKey || !apiKey.trim() || !apiKeyName.trim()}
            >
              {savingApiKey ? 'Saving...' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OAuth Flow Dialog */}
      <Dialog open={connectingId !== null} onOpenChange={() => setConnectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connecting Integration</DialogTitle>
            <DialogDescription>
              Please wait while we establish the connection...
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Progress value={progress} />
            <p className="text-sm text-center text-muted-foreground">
              {progress < 30 && 'Redirecting to OAuth provider...'}
              {progress >= 30 && progress < 60 && 'Authenticating...'}
              {progress >= 60 && progress < 90 && 'Authorizing access...'}
              {progress >= 90 && 'Finalizing connection...'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
