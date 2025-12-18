import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  getGitCredentials,
  getVibeCoderCredentials,
  sendCommandToAgent,
  updateJobStatus,
  getJobDetails,
  getRepoConfigs,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 minutes',
  heartbeatTimeout: '5 minutes', // Detect if agent becomes unresponsive
  retry: {
    initialInterval: '1s',
    maximumInterval: '30s',
    maximumAttempts: 3,
  },
});

export interface RepoConfig {
  repoId: string;
  name: string;
  url?: string;
  branch?: string;
  // Optional: configuration from database
  setupCommands?: string[];
  buildCommands?: string[];
  testCommands?: string[];
  isConfirmed?: boolean;
  detectedFrom?: string;
}

export async function jobExecutionWorkflow(params: {
  jobId: string;
  jobVersion: number;
  orgId: string;
  queueType: 'rework' | 'backlog';
  agentId?: string;
  repos?: RepoConfig[];
}): Promise<{ prLink?: string; status: string }> {
  const { jobId, jobVersion, orgId, agentId, repos } = params;

  let finalStatus: 'completed' | 'failed' = 'completed';
  let finalError: string | undefined;
  const prLinks: string[] = [];
  const verificationErrors: string[] = [];

  try {
    // Get job details
    const job = await getJobDetails({ jobId, jobVersion, orgId });

    if (!job) {
      throw new Error('Job not found');
    }

    // Note: Job has already been removed from queue and marked as in-progress
    // by the claimNextJobFromQueue activity in queueMonitorWorkflow
    // This ensures atomicity and prevents race conditions

    // Prepare repos array from job.repos
    // If only one repo exists, use it automatically
    let reposToUse: RepoConfig[] = [];
    if (repos && repos.length > 0) {
      reposToUse = repos;
    } else if (job.repos && job.repos.length > 0) {
      if (job.repos.length === 1) {
        // Single repo - use it automatically (name will be fetched from configs)
        reposToUse = [
          {
            repoId: job.repos[0],
            name: 'repo', // Placeholder, will be replaced by getRepoConfigs
          },
        ];
      } else {
        // Multiple repos - map them (names will be fetched from configs)
        reposToUse = job.repos.map(
          (repoId: string): RepoConfig => ({
            repoId,
            name: 'repo', // Placeholder, will be replaced by getRepoConfigs
          })
        );
      }
    }

    // Fetch repository configurations if repos exist
    let enrichedRepos: RepoConfig[] = reposToUse;
    if (reposToUse.length > 0) {
      const repoIds = reposToUse.map(r => r.repoId);
      const configsMap = await getRepoConfigs({
        repoIds,
        orgId,
        jobId,
        jobVersion,
      });

      // Merge configs with repos
      enrichedRepos = [];
      for (const repo of reposToUse) {
        const config = configsMap[repo.repoId];
        if (config) {
          enrichedRepos.push({
            ...repo,
            name: config.name || repo.name,
            url: config.url || repo.url,
            setupCommands: config.setupCommands,
            buildCommands: config.buildCommands,
            testCommands: config.testCommands,
            isConfirmed: config.isConfirmed,
            detectedFrom: config.detectedFrom,
          });
        } else {
          enrichedRepos.push(repo);
        }
      }
    }

    // Step 1: Get git credentials from API (Backend)
    const gitCredentials = await getGitCredentials({
      jobId,
      orgId,
      repoId: enrichedRepos[0]?.repoId, // Use first repo for credentials (assumes same creds for all repos in org)
    });

    // Step 2: Get vibe coder credentials (Backend) - pass agentId to read from agent record
    let vibeCoderCredentials;
    try {
      vibeCoderCredentials = await getVibeCoderCredentials({ orgId, agentId });
    } catch (error) {
      finalStatus = 'failed';
      finalError =
        error instanceof Error
          ? error.message
          : 'Failed to get vibe-agent credentials';
      throw error;
    }

    // Step 3: Checkout - Clone repositories
    try {
      await sendCommandToAgent({
        jobId,
        jobVersion,
        orgId,
        command: 'checkout',
        payload: {
          gitCredentials,
          vibeCoderCredentials,
          prompt: job.prompt,
          repos: enrichedRepos,
          agentId,
        },
      });
    } catch (error) {
      finalStatus = 'failed';
      finalError = `Checkout failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;
      throw error; // Not proceeding with further steps if checkout fails.
    }

    // Step 4: Setup - Run setup commands
    const setupSuccess = true;
    try {
      await sendCommandToAgent({
        jobId,
        jobVersion,
        orgId,
        command: 'setup',
        payload: {
          gitCredentials,
          vibeCoderCredentials,
          prompt: job.prompt,
          repos: enrichedRepos,
          agentId,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      verificationErrors.push(`Setup failed: ${errorMsg}`);
    }

    // Step 5: Execute - Run code generation
    try {
      await sendCommandToAgent({
        jobId,
        jobVersion,
        orgId,
        command: 'execute',
        payload: {
          gitCredentials,
          vibeCoderCredentials,
          prompt: job.prompt,
          repos: enrichedRepos,
          agentId,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      finalStatus = 'failed';
      finalError = `Execute failed: ${errorMsg}`;
      throw error; // Not proceeding with further steps if execute fails.
    }

    // Step 6: Build - Run build commands
    const buildSuccess = true;
    try {
      await sendCommandToAgent({
        jobId,
        jobVersion,
        orgId,
        command: 'build',
        payload: {
          gitCredentials,
          vibeCoderCredentials,
          prompt: job.prompt,
          repos: enrichedRepos,
          agentId,
        },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      finalStatus = 'failed';
      finalError = `Build failed: ${errorMsg}`;
    }

    // Step 7: Verify - Run verification (tests, lint, etc.)
    let verifySuccess = true;
    try {
      const verificationResult = await sendCommandToAgent({
        jobId,
        jobVersion,
        orgId,
        command: 'runVerification',
        payload: { agentId },
      });

      if (!verificationResult.success) {
        verifySuccess = false;
        if (verificationResult.errors && verificationResult.errors.length > 0) {
          verificationErrors.push(...verificationResult.errors);
        } else {
          verificationErrors.push(
            verificationResult.message || 'Verification failed'
          );
        }
      }
    } catch (error) {
      verifySuccess = false;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      finalStatus = 'failed';
      finalError = `Verification failed: ${errorMsg}`;
    }

    // Step 8: Create PRs (even if Build/Verify failed) - include failure content in PR
    if (enrichedRepos.length > 0) {
      // Prepare PR body with failure information if any
      const failureSummary: string[] = [];
      if (!setupSuccess) {
        failureSummary.push('⚠️ Setup step failed');
      }
      if (!buildSuccess) {
        failureSummary.push('⚠️ Build step failed');
      }
      if (!verifySuccess) {
        failureSummary.push('⚠️ Verify step failed');
      }

      const prBody =
        failureSummary.length > 0
          ? `This PR was automatically generated by Sia for job ${jobId}.\n\n**Note:** Some steps failed:\n${failureSummary
              .map(f => `- ${f}`)
              .join('\n')}\n\n${
              verificationErrors.length > 0
                ? `\n**Errors:**\n${verificationErrors
                    .map(e => `- ${e}`)
                    .join('\n')}`
                : ''
            }`
          : `This PR was automatically generated by Sia for job ${jobId}.`;

      // Create PR for each repo
      for (const repo of enrichedRepos) {
        try {
          const repoPrResult = await sendCommandToAgent({
            jobId,
            jobVersion,
            orgId,
            command: 'createPR',
            payload: {
              repoId: repo.repoId,
              branchName: `${jobId}-${repo.name}`,
              title: `Auto-generated PR for job ${jobId}`,
              body: prBody,
              agentId,
            },
          });

          if (repoPrResult.prLink) {
            prLinks.push(repoPrResult.prLink);
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          finalStatus = 'failed';
          finalError = `Unable to create PR for ${repo.repoId}: ${errorMsg}`;
        }
      }
    }

    // Step 9: Cleanup
    try {
      await sendCommandToAgent({
        jobId,
        jobVersion,
        orgId,
        command: 'cleanup',
        payload: { agentId },
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      finalStatus = 'failed';
      finalError = `Unable to cleanup workspace: ${errorMsg}`;
      throw error;
    }

    // Determine final status
    if (!setupSuccess || !buildSuccess || !verifySuccess) {
      finalStatus = 'failed';
      finalError = `Some steps failed: ${[
        !setupSuccess && 'Setup',
        !buildSuccess && 'Build',
        !verifySuccess && 'Verify',
      ]
        .filter(Boolean)
        .join(', ')}`;
    }

    return {
      prLink: prLinks.length > 0 ? prLinks[0] : undefined,
      status: finalStatus,
    };
  } catch (error) {
    // Extract meaningful error message from Temporal errors
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;

      // If it's a Temporal ActivityFailure, extract the underlying cause
      if (
        errorMessage.includes('Activity task failed') ||
        errorMessage.includes('ActivityFailure')
      ) {
        // Check for cause property (Temporal wraps errors)
        const cause = (error as { cause?: unknown }).cause;
        if (cause instanceof Error) {
          errorMessage = cause.message;
        } else if (cause && typeof cause === 'string') {
          errorMessage = cause;
        } else if (error.stack) {
          // Parse stack trace to find the actual error
          // Look for lines with "Error:" that contain the actual error message
          const stackLines = error.stack.split('\n');
          for (const line of stackLines) {
            // Look for error messages that aren't Temporal wrapper messages
            if (
              line.includes('Error:') &&
              !line.includes('Activity task failed') &&
              !line.includes('ActivityFailure') &&
              !line.includes('WorkflowExecutionFailedError')
            ) {
              const match = line.match(/Error:\s*(.+)/);
              if (match && match[1]) {
                const extracted = match[1].trim();
                // Only use if it's a meaningful error (not just "Error")
                if (extracted.length > 5 && extracted !== 'Error') {
                  errorMessage = extracted;
                  break;
                }
              }
            }
            // Also check for "at" lines that might contain the error location
            // The actual error is usually right before the "at" line
            if (line.trim().startsWith('at ') && stackLines.indexOf(line) > 0) {
              const prevLine = stackLines[stackLines.indexOf(line) - 1];
              if (
                prevLine &&
                prevLine.includes('Error:') &&
                !prevLine.includes('Activity task failed')
              ) {
                const match = prevLine.match(/Error:\s*(.+)/);
                if (match && match[1]) {
                  errorMessage = match[1].trim();
                  break;
                }
              }
            }
          }
        }
      }
    }

    // Set final status for finally block to handle
    finalStatus = 'failed';
    finalError = errorMessage;

    throw error;
  } finally {
    // Update job status at the end (both success and failure cases)
    try {
      const status = finalStatus === 'completed' ? 'completed' : 'failed';
      const prLink = prLinks.length > 0 ? prLinks[0] : undefined;

      await updateJobStatus({
        jobId,
        jobVersion,
        orgId,
        status,
        prLink,
        error: finalError,
      });
    } catch (updateError) {
      // Update failed - workflow is ending anyway, nothing more to do
      console.error('Failed to update job status:', updateError);
    }
  }
}
