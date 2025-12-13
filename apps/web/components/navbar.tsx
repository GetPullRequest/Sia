'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { Bell, Search, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from './ui/button';
import { ProfileAvatar } from './profileavatar';
import { Badge } from './ui/badge';
import { InputGroup, InputGroupAddon, InputGroupInput } from './ui/input-group';
import { Kbd } from './ui/kbd';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { AddTaskDialog } from './add-task-dialog';
import { api } from '@/lib/api';
import { useAuthInfo } from '@propelauth/react';
import { ThemeToggle } from './theme-toggle';
import type { Agent } from '@/types';

interface NavbarProps {
  onSearchClick?: () => void;
}

export function Navbar({ onSearchClick }: NavbarProps = {}) {
  const authInfo = useAuthInfo();
  const pathname = usePathname();
  const router = useRouter();
  const { isLoggedIn } = authInfo;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const [isAgentPopoverOpen, setIsAgentPopoverOpen] = useState(false);
  const [isVibePlatformsPopoverOpen, setIsVibePlatformsPopoverOpen] =
    useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch agents
  const { data: agents = [] } = useQuery<Agent[]>({
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

      {/* Add Task Modal */}
      <AddTaskDialog open={isModalOpen} onOpenChange={setIsModalOpen} />
    </header>
  );
}
