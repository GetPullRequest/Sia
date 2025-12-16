'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, Info, RefreshCw, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  postReposByRepoIdConfigConfirm,
  postReposByRepoIdConfigReInfer,
} from '@sia/models/api-client';
import type { RepoConfig, Repo } from '@sia/models/api-client';
import { api, getAuthHeaders } from '@/lib/api';
import { handleApiError, handleSdkResponse } from '@/lib/api-error-handler';

interface RepoConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: Repo;
  config?: RepoConfig | null;
}

export function RepoConfigDialog({
  open,
  onOpenChange,
  repo,
  config,
}: RepoConfigDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [description, setDescription] = useState('');
  const [setupCommands, setSetupCommands] = useState('');
  const [buildCommands, setBuildCommands] = useState('');
  const [testCommands, setTestCommands] = useState('');

  // Update form values when config/repo changes
  useEffect(() => {
    setDescription(repo.description || '');
    if (config) {
      setSetupCommands(config.setupCommands?.join('\n') || '');
      setBuildCommands(config.buildCommands?.join('\n') || '');
      setTestCommands(config.testCommands?.join('\n') || '');
    } else {
      setSetupCommands('');
      setBuildCommands('');
      setTestCommands('');
    }
  }, [config, repo]);

  const confirmMutation = useMutation({
    mutationFn: async () => {
      // Save description first
      if (description !== repo.description) {
        await api.updateRepoDescription(repo.id, description);
      }

      // Get auth headers
      const headers = await getAuthHeaders();

      // Parse commands from textareas (newline-separated) and filter out empty lines
      const parseCommands = (text: string): string[] =>
        text
          .split('\n')
          .map(cmd => cmd.trim())
          .filter(cmd => cmd.length > 0);

      // Then confirm configuration - wrap with handleSdkResponse to properly throw errors
      const response = await postReposByRepoIdConfigConfirm({
        path: { repoId: repo.id },
        headers,
        body: {
          setupCommands: parseCommands(setupCommands),
          buildCommands: parseCommands(buildCommands),
          testCommands: parseCommands(testCommands),
        },
      });
      return handleSdkResponse(response);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['repoConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      onOpenChange(false);
      toast({
        title: 'Configuration saved',
        description: `Configuration for ${repo.name} has been saved successfully`,
      });
    },
    onError: (error: unknown) => {
      handleApiError(error, 'Failed to save configuration');
    },
  });

  const reInferMutation = useMutation({
    mutationFn: async () => {
      // Get auth headers
      const headers = await getAuthHeaders();

      const response = await postReposByRepoIdConfigReInfer({
        path: { repoId: repo.id },
        headers,
      });
      return handleSdkResponse(response);
    },
    onSuccess: (data: any) => {
      // Update local state with new inferred commands
      const newConfig = data as RepoConfig | undefined;
      if (newConfig) {
        setSetupCommands(newConfig.setupCommands?.join('\n') || '');
        setBuildCommands(newConfig.buildCommands?.join('\n') || '');
        setTestCommands(newConfig.testCommands?.join('\n') || '');
      }
      queryClient.invalidateQueries({ queryKey: ['repoConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      toast({
        title: 'Configuration re-inferred',
        description: `Commands have been detected from ${repo.name}`,
      });
    },
    onError: (error: unknown) => {
      handleApiError(error, 'Failed to re-infer configuration');
    },
  });

  const handleConfirm = () => {
    confirmMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure {repo.name}</DialogTitle>
          <DialogDescription>
            Review and confirm the detected commands for repository setup,
            build, and validation
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status banner */}
          {config && (
            <Alert
              variant={config.isConfirmed ? 'default' : 'default'}
              className={
                config.isConfirmed ? 'bg-green-50 border-green-200' : ''
              }
            >
              {config.isConfirmed ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    User confirmed configuration on{' '}
                    {config.confirmedAt
                      ? new Date(config.confirmedAt).toLocaleDateString()
                      : 'N/A'}
                  </AlertDescription>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Commands detected from{' '}
                    {config.detectedFrom || config.inferenceSource}. Review and
                    edit if needed.
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}

          {/* Detection metadata */}
          {config && (
            <div className="flex gap-2 flex-wrap">
              {config.detectedLanguage && (
                <Badge variant="outline">{config.detectedLanguage}</Badge>
              )}
              {config.inferenceConfidence && (
                <Badge variant="outline">
                  Confidence: {config.inferenceConfidence}
                </Badge>
              )}
              {config.inferenceSource && (
                <Badge variant="outline">
                  Source: {config.inferenceSource}
                </Badge>
              )}
            </div>
          )}

          {/* Repository Description */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Repository Description
              <span className="text-muted-foreground ml-2">
                (helps with repository selection)
              </span>
            </label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe this repository's purpose, tech stack, and key features..."
              rows={3}
              className="text-xs"
            />
          </div>

          {/* Setup commands */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Setup Commands
              <span className="text-muted-foreground ml-2">(one per line)</span>
            </label>
            <Textarea
              value={setupCommands}
              onChange={e => setSetupCommands(e.target.value)}
              placeholder="npm install"
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          {/* Build commands */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Build Commands
              <span className="text-muted-foreground ml-2">(optional)</span>
            </label>
            <Textarea
              value={buildCommands}
              onChange={e => setBuildCommands(e.target.value)}
              placeholder="npm run build"
              rows={4}
              className="font-mono text-xs"
            />
          </div>

          {/* Test/Validation commands */}
          <div>
            <label className="text-sm font-medium block mb-2">
              Validation Commands
              <span className="text-muted-foreground ml-2">(optional)</span>
            </label>
            <Textarea
              value={testCommands}
              onChange={e => setTestCommands(e.target.value)}
              placeholder="npm test"
              rows={4}
              className="font-mono text-xs"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => reInferMutation.mutate()}
            disabled={reInferMutation.isPending || confirmMutation.isPending}
            className="w-full sm:w-auto"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                reInferMutation.isPending ? 'animate-spin' : ''
              }`}
            />
            Re-infer from Repository
          </Button>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={confirmMutation.isPending}
              className="flex-1 sm:flex-initial"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmMutation.isPending}
              className="flex-1 sm:flex-initial"
            >
              <Save className="h-4 w-4 mr-2" />
              {confirmMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
