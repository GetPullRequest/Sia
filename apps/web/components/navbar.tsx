'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Bell, Search, Plus, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from './ui/button';
import { ProfileAvatar } from './profileavatar';
import { Badge } from './ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group';
import { Kbd } from './ui/kbd';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from './ui/textarea';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { api, type Repo } from '@/lib/api';
import { useAuthInfo } from '@propelauth/react';
import { ThemeToggle } from './theme-toggle';
import type { Agent } from '@/types';

interface NavbarProps {
  onSearchClick?: () => void;
}

export function Navbar({ onSearchClick }: NavbarProps = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const authInfo = useAuthInfo();
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn } = authInfo;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedRepoId, setSelectedRepoId] = useState<string>('');
  const [availableRepos, setAvailableRepos] = useState<Repo[]>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isAgentPopoverOpen, setIsAgentPopoverOpen] = useState(false);
  const [isVibePlatformsPopoverOpen, setIsVibePlatformsPopoverOpen] =
    useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch agents
  const { data: agents = [] } = useQuery({
    queryKey: ['agents'],
    queryFn: api.getAgents,
    refetchInterval: 10000,
  });

  // Fetch integration secrets for vibe platforms
  interface IntegrationSecret {
    id: string;
    providerType: string;
    name: string;
    storageType: 'gcp' | 'encrypted_local';
    hasApiKey?: boolean;
    createdAt: string;
    updatedAt: string;
  }
  const { data: integrationSecrets = [] } = useQuery<IntegrationSecret[]>({
    queryKey: ['integrationSecrets'],
    queryFn: () => api.getIntegrationSecrets(),
    enabled: isLoggedIn === true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Find active agent
  const activeAgent = useMemo(
    () => agents.find((agent: Agent) => agent.status === 'active') ?? null,
    [agents]
  );

  // Count active agents
  const activeAgentCount = useMemo(
    () => agents.filter((agent: Agent) => agent.status === 'active').length,
    [agents]
  );

  // Vibe coding platforms
  const vibePlatforms = ['cursor', 'claude-code', 'kiro-cli'];
  const vibePlatformNames: Record<string, string> = {
    cursor: 'Cursor',
    'claude-code': 'Claude Code',
    'kiro-cli': 'Kiro CLI',
  };

  // Count connected vibe platforms
  const connectedVibePlatformsCount = useMemo(() => {
    return integrationSecrets.filter((secret: IntegrationSecret) =>
      vibePlatforms.includes(secret.providerType)
    ).length;
  }, [integrationSecrets, vibePlatforms]);

  // Get connected vibe platforms
  const connectedVibePlatforms = useMemo(() => {
    return integrationSecrets.filter((secret: IntegrationSecret) =>
      vibePlatforms.includes(secret.providerType)
    );
  }, [integrationSecrets, vibePlatforms]);

  // Get dynamic heading based on route
  const getNavbarTitle = () => {
    if (pathname === '/') {
      return 'Jobs Overview';
    }
    if (pathname === '/recents') {
      return 'Recents Overview';
    }
    if (pathname === '/agents') {
      return 'Agents Overview';
    }
    if (pathname === '/repositories') {
      return 'Repositories Overview';
    }
    if (pathname === '/integrations') {
      return 'Integrations Overview';
    }
    if (pathname?.startsWith('/jobs/')) {
      return 'Job Details';
    }
    // Default fallback
    return 'Jobs Overview';
  };

  // Detect OS for keyboard shortcut display
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const platform = window.navigator.platform.toLowerCase();
      const userAgent = window.navigator.userAgent.toLowerCase();
      setIsMac(
        platform.includes('mac') ||
          platform.includes('iphone') ||
          platform.includes('ipad') ||
          userAgent.includes('mac')
      );
    }
  }, []);

  // Keyboard shortcut handler for search (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if Ctrl+K (Windows/Linux) or Cmd+K (Mac) is pressed
      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === 'k' &&
        !event.shiftKey &&
        !event.altKey
      ) {
        // Prevent default browser behavior (like opening browser search)
        event.preventDefault();

        // Don't focus if user is typing in an input, textarea, or contenteditable
        const target = event.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return;
        }

        // Focus the search input
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          // Select all text if there's any
          searchInputRef.current.select();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleAddTaskClick = () => {
    setIsModalOpen(true);
  };

  const createJobMutation = useMutation({
    mutationFn: async (userPrompt: string) => {
      return await api.createJob({
        user_input: {
          source: 'mobile',
          prompt: userPrompt,
          sourceMetadata: null,
        },
        repo: selectedRepoId || undefined,
        created_by: authInfo.user?.userId || 'unknown',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast({
        title: 'Task added',
        description: 'Your task has been submitted to the Sia agent',
      });
      setPrompt('');
      setSelectedRepoId('');
      setIsModalOpen(false);
    },
    onError: error => {
      const errorMessage = error
        ? (error as Error).message
        : 'An error occurred';
      toast({
        title: 'Failed to add task',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (isModalOpen) {
      setIsLoadingRepos(true);
      api
        .getAllRepos()
        .then(repos => setAvailableRepos(repos))
        .catch(() => {
          toast({
            title: 'Failed to load repos',
            description:
              'Unable to load repositories. You can still create a job without selecting a repo.',
            variant: 'destructive',
          });
        })
        .finally(() => setIsLoadingRepos(false));
    }
  }, [isModalOpen, toast]);

  const handleAddTask = () => {
    if (prompt.trim()) {
      createJobMutation.mutate(prompt.trim());
    }
  };

  const handleCancel = () => {
    setPrompt('');
    setSelectedRepoId('');
    setIsModalOpen(false);
  };

  return (
    <header className="sticky rounded-full m-4 top-0 z-30 bg-sidebar border border-border">
      <div className="flex h-20 w-full justify-between items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center justify-start gap-10 w-1/2">
          <div className="flex flex-col gap-1 ">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                {getNavbarTitle()}
              </h2>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {/* <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex items-center gap-2  bg-secondary text-muted-foreground text-xs"
              >
                {jobCount} total jobs
              </Badge>
              {activeAgent && (
                <Badge
                  variant="secondary"
                  className="hidden sm:inline-flex items-center gap-2  bg-secondary text-muted-foreground text-xs"
                >
                  Active agent:{' '}
                  <span className="font-medium text-foreground">
                    {activeAgent.name}
                  </span>
                </Badge>
              )}
            </div> */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="secondary"
                className="hidden sm:inline-flex items-center gap-1.5 bg-secondary text-muted-foreground text-xs"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                System healthy
              </Badge>
              <Popover
                open={isAgentPopoverOpen}
                onOpenChange={setIsAgentPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="hidden sm:inline-flex items-center gap-1.5 bg-secondary text-muted-foreground text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                    onMouseEnter={() => setIsAgentPopoverOpen(true)}
                    onMouseLeave={() => setIsAgentPopoverOpen(false)}
                  >
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {activeAgentCount}{' '}
                    {activeAgentCount === 1 ? 'agent' : 'agents'}
                  </Badge>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64"
                  side="bottom"
                  align="start"
                  onMouseEnter={() => setIsAgentPopoverOpen(true)}
                  onMouseLeave={() => setIsAgentPopoverOpen(false)}
                >
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Active Agent
                    </div>
                    {activeAgent ? (
                      <div className="space-y-1">
                        <Link
                          href="/agents"
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors underline decoration-muted-foreground/40 hover:decoration-primary"
                        >
                          {activeAgent.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          Status: {activeAgent.status}
                        </div>
                        {activeAgent.config.host && (
                          <div className="text-xs text-muted-foreground">
                            Host: {activeAgent.config.host}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No active agent
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              <Popover
                open={isVibePlatformsPopoverOpen}
                onOpenChange={setIsVibePlatformsPopoverOpen}
              >
                <PopoverTrigger asChild>
                  <Badge
                    variant="secondary"
                    className="hidden sm:inline-flex items-center gap-1.5 bg-secondary text-muted-foreground text-xs cursor-pointer hover:bg-secondary/80 transition-colors"
                    onMouseEnter={() => setIsVibePlatformsPopoverOpen(true)}
                    onMouseLeave={() => setIsVibePlatformsPopoverOpen(false)}
                    onClick={() => router.push('/integrations')}
                  >
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {connectedVibePlatformsCount}{' '}
                    {connectedVibePlatformsCount === 1
                      ? 'vibe coding platform'
                      : 'vibe coding platforms'}{' '}
                    connected
                  </Badge>
                </PopoverTrigger>
                <PopoverContent
                  className="w-64"
                  side="bottom"
                  align="start"
                  onMouseEnter={() => setIsVibePlatformsPopoverOpen(true)}
                  onMouseLeave={() => setIsVibePlatformsPopoverOpen(false)}
                >
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">
                      Connected Vibe Platforms
                    </div>
                    {connectedVibePlatforms.length > 0 ? (
                      <div className="space-y-2">
                        {connectedVibePlatforms.map(
                          (secret: IntegrationSecret) => (
                            <div key={secret.id} className="space-y-1">
                              <div className="text-sm font-medium text-foreground">
                                {
                                  vibePlatformNames[
                                    secret.providerType as keyof typeof vibePlatformNames
                                  ]
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {secret.name}
                              </div>
                            </div>
                          )
                        )}
                        <Link
                          href="/integrations"
                          className="text-xs text-primary hover:underline flex items-center gap-1 mt-2"
                        >
                          View all integrations
                        </Link>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-sm text-muted-foreground">
                          No vibe platforms connected
                        </div>
                        <Link
                          href="/integrations"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Connect a platform
                        </Link>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <div className="flex items-center w-1/2s justify-end gap-2">
          <div className="flex flex-1  items-center gap-3">
            <InputGroup
              className="w-96 h-12  border border-border rounded-full cursor-pointer"
              onClick={onSearchClick}
            >
              <InputGroupAddon>
                <Search className="h-4 w-4 text-muted-foreground" />
              </InputGroupAddon>
              <InputGroupInput
                placeholder="Search jobs"
                className="cursor-pointer"
                readOnly
              />
              <InputGroupAddon align="inline-end">
                {isMac ? (
                  <>
                    <Kbd>⌘</Kbd>
                    <Kbd>K</Kbd>
                  </>
                ) : (
                  <>
                    <Kbd>Ctrl</Kbd>
                    <Kbd>K</Kbd>
                  </>
                )}
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Notifications">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </Button>
            {/* <Button variant="outline" size="icon" aria-label="Theme"> */}
            <ThemeToggle />
            {/* </Button> */}
            <Button onClick={handleAddTaskClick} className="gap-2 h-9 px-3">
              <Plus className="h-5 w-5 text-white" />
              Add Task
            </Button>
            <ProfileAvatar />
          </div>
        </div>
      </div>

      {/* Add Task Modal (shared with homepage) */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
            <DialogDescription>
              Enter a prompt for the Sia agent to execute
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="prompt-input" className="text-xs font-medium">
                Prompt
              </label>
              <Textarea
                id="prompt-input"
                placeholder="Enter your prompt here..."
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="repo-select" className="text-xs font-medium">
                Repository (Optional)
              </label>
              <select
                id="repo-select"
                value={selectedRepoId}
                onChange={e => setSelectedRepoId(e.target.value)}
                disabled={isLoadingRepos}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingRepos ? (
                  <option value="">Loading repositories...</option>
                ) : availableRepos.length === 0 ? (
                  <option value="">No repositories available</option>
                ) : (
                  <>
                    <option value="">No repository (use default)</option>
                    {availableRepos.map(repo => (
                      <option key={repo.id} value={repo.id}>
                        {repo.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
              {availableRepos.length === 0 && !isLoadingRepos && (
                <p className="text-xs text-muted-foreground">
                  No repositories configured. Connect a GitHub provider to add
                  repositories.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={createJobMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddTask}
              disabled={!prompt.trim() || createJobMutation.isPending}
            >
              {createJobMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Add
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
