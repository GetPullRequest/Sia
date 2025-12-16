'use client';

import Link from 'next/link';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api, type Repo } from '@/lib/api';
import type { RepoConfig } from '@sia/models/api-client';
import {
  ExternalLink,
  Settings,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useAuthInfo } from '@propelauth/react';
import { RepoConfigDialog } from '@/components/repos/repo-config-dialog';

export default function Repositories() {
  const authInfo = useAuthInfo();
  const { isLoggedIn } = authInfo;
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);

  const { data: repos = [], isLoading } = useQuery<Repo[]>({
    queryKey: ['repos'],
    queryFn: api.getAllRepos,
    enabled: isLoggedIn === true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Helper function to get config for a repo
  const getRepoConfig = (repo: Repo): RepoConfig | undefined => {
    return repo.config as RepoConfig | undefined;
  };

  const handleConfigureClick = (repo: Repo) => {
    setSelectedRepo(repo);
    setConfigDialogOpen(true);
  };

  if (!isLoggedIn) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">
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
        <h1 className="text-base font-bold text-foreground">Repositories</h1>
        <p className="text-sm text-muted-foreground mt-2">
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
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground mb-4">
                No repositories found. Connect a git hosting platform to get
                started.
              </p>
              <Link href="/integrations">
                <Button variant="outline" size="sm">
                  Go to Integrations
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {repos.map(repo => {
            const config = getRepoConfig(repo);
            return (
              <Card key={repo.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-sm">{repo.name}</CardTitle>
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

                  {/* Configuration status badges */}
                  <div className="flex gap-2 mt-3 flex-wrap items-center">
                    {config?.isConfirmed ? (
                      <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="h-3 w-3" />
                        <span>Confirmed</span>
                      </div>
                    ) : config ? (
                      <div className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                        <AlertCircle className="h-3 w-3" />
                        <span>Needs Review (Auto detected)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-orange-600 text-xs font-medium">
                        <AlertCircle className="h-3 w-3" />
                        <span>Needs configuration</span>
                      </div>
                    )}

                    {config?.detectedFrom && (
                      <Badge variant="outline" className="text-xs">
                        <Info className="h-3 w-3 mr-1" />
                        {config.detectedFrom}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col gap-2">
                  {/* Repository Description */}
                  <div className="mb-2">
                    {repo.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {repo.description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        No description provided
                      </p>
                    )}
                  </div>

                  {/* Display commands if available */}
                  {config &&
                    (config.setupCommands?.length ||
                      config.buildCommands?.length ||
                      config.testCommands?.length) && (
                      <div className="flex-1 mb-2 space-y-1">
                        {config.setupCommands &&
                          config.setupCommands.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                Setup:
                              </p>
                              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                                {config.setupCommands.join(' && ')}
                              </code>
                            </div>
                          )}
                        {config.buildCommands &&
                          config.buildCommands.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                Build:
                              </p>
                              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                                {config.buildCommands.join(' && ')}
                              </code>
                            </div>
                          )}
                        {config.testCommands &&
                          config.testCommands.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                Test:
                              </p>
                              <code className="text-xs bg-muted px-2 py-1 rounded block truncate">
                                {config.testCommands.join(' && ')}
                              </code>
                            </div>
                          )}
                      </div>
                    )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleConfigureClick(repo)}
                    className="w-full"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Configure
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Repository Configuration Dialog */}
      {selectedRepo && (
        <RepoConfigDialog
          open={configDialogOpen}
          onOpenChange={setConfigDialogOpen}
          repo={selectedRepo}
          config={selectedRepo ? getRepoConfig(selectedRepo) : undefined}
        />
      )}
    </div>
  );
}
