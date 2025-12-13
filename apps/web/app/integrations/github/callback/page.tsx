'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { getReposGithubConnectCallback } from '@sia/models/api-client';
import { getAuthHeaders } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { useAuthInfo } from '@propelauth/react';

export default function GitHubCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const authInfo = useAuthInfo();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>(
    'processing'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) {
      return;
    }

    const processCallback = async () => {
      // Wait for auth to be ready and user to be logged in
      if (!authInfo || authInfo.loading || !authInfo.isLoggedIn) {
        return;
      }

      const installationId = searchParams.get('installation_id');
      const state = searchParams.get('state');
      const setupAction = searchParams.get('setup_action');

      if (!installationId) {
        hasProcessed.current = true;
        setStatus('error');
        setErrorMessage('Missing installation_id parameter');
        toast({
          title: 'Error',
          description: 'Missing installation_id parameter',
          variant: 'destructive',
        });
        setTimeout(() => router.push('/integrations'), 3000);
        return;
      }

      hasProcessed.current = true;

      try {
        // Wait a bit for tokenGetter to be set up (if needed)
        // Try to get auth headers with retries
        let authHeaders: Record<string, string> = {};
        let retries = 3;
        while (retries > 0 && !authHeaders['Authorization']) {
          authHeaders = await getAuthHeaders();
          if (!authHeaders['Authorization'] && retries > 1) {
            // Wait 100ms before retrying
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          retries--;
        }

        // Verify we have auth headers
        if (!authHeaders['Authorization']) {
          throw new Error(
            'Authentication required. Please ensure you are logged in.'
          );
        }

        const response = await getReposGithubConnectCallback({
          query: {
            installation_id: installationId,
            ...(state && { state }),
            ...(setupAction && { setup_action: setupAction }),
          },
          headers: {
            ...authHeaders,
          },
        });

        if (!response.data) {
          throw new Error('No data returned from callback');
        }

        // Invalidate queries to refresh the providers list
        await queryClient.invalidateQueries({ queryKey: ['githubProviders'] });

        setStatus('success');
        toast({
          title: 'Success',
          description: 'GitHub integration connected successfully!',
        });

        // Redirect to integrations page after a short delay
        setTimeout(() => {
          router.push('/integrations?github=connected');
        }, 1500);
      } catch (error) {
        console.error('Failed to process GitHub callback:', error);
        setStatus('error');
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to process GitHub installation';
        setErrorMessage(message);
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        setTimeout(() => router.push('/integrations'), 3000);
      }
    };

    processCallback();
  }, [searchParams, router, queryClient, toast, authInfo]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-4">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
            <p className="text-lg">Processing GitHub installation...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <p className="text-lg text-green-600">
              GitHub integration connected successfully!
            </p>
            <p className="text-sm text-gray-500">
              Redirecting to integrations page...
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">✗</div>
            <p className="text-lg text-red-600">Failed to connect GitHub</p>
            {errorMessage && (
              <p className="text-sm text-gray-500">{errorMessage}</p>
            )}
            <p className="text-sm text-gray-400">
              Redirecting to integrations page...
            </p>
          </>
        )}
      </div>
    </div>
  );
}
