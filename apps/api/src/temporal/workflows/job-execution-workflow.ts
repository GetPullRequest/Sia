import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  getGitCredentials,
  getVibeCoderCredentials,
  sendCommandToAgent,
  updateJobStatus,
  getJobDetails,
  logToJobActivity,
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
  orgId: string;
  queueType: 'rework' | 'backlog';
  agentId?: string;
  repos?: RepoConfig[];
}): Promise<{ prLink?: string; status: string }> {
  const { jobId, orgId, agentId, repos } = params;

  // Helper function for logging - only requires level and message
  const log = async (
    level: 'info' | 'error' | 'warn' | 'debug',
    message: string
  ) => {
    await logToJobActivity({
      jobId,
      orgId,
      level,
      message,
      stage: 'workflow',
    });
  };

  let finalStatus: 'completed' | 'failed' = 'completed';
  let finalError: string | undefined;
  const prLinks: string[] = [];
  const verificationErrors: string[] = [];

  try {
    // Get job details
    const job = await getJobDetails({ jobId, orgId });

    if (!job) {
      throw new Error('Job not found');
    }

    // Note: Job has already been removed from queue and marked as in-progress
    // by the claimNextJobFromQueue activity in queueMonitorWorkflow
    // This ensures atomicity and prevents race conditions

    await log(
      'info',
      `Workflow execution started for job ${jobId} in org ${orgId}`
    );

    // Prepare repos array from job.repos
    // If only one repo exists, use it automatically
    let reposToUse: RepoConfig[] = [];
    if (repos && repos.length > 0) {
      reposToUse = repos;
    } else if (job.repos && job.repos.length > 0) {
      if (job.repos.length === 1) {
        // Single repo - use it automatically
        reposToUse = [
          {
            repoId: job.repos[0],
            name: job.repos[0].split('/')[1] || job.repos[0],
          },
        ];
      } else {
        // Multiple repos - map them
        reposToUse = job.repos.map(
          (repoId: string): RepoConfig => ({
            repoId,
            name: repoId.split('/')[1] || repoId,
          })
        );
      }
    }

    // Fetch repository configurations if repos exist
    let enrichedRepos: RepoConfig[] = reposToUse;
    if (reposToUse.length > 0) {
      await log(
        'info',
        `Fetching configurations for ${reposToUse.length} repository(ies)`
      );

      const repoIds = reposToUse.map(r => r.repoId);
      const configsMap = await getRepoConfigs({ repoIds, orgId });

      // Merge configs with repos and log status
      enrichedRepos = [];
      for (const repo of reposToUse) {
        const config = configsMap.get(repo.repoId);
        if (config) {
          await log(
            'info',
            `${
              config.isConfirmed ? '✓ Confirmed' : '⚠ Unconfirmed'
            } config for ${repo.repoId}${
              config.detectedFrom ? ` (from ${config.detectedFrom})` : ''
            }`
          );

          enrichedRepos.push({
            ...repo,
            url: config.url || repo.url,
            setupCommands: config.setupCommands,
            buildCommands: config.buildCommands,
            testCommands: config.testCommands,
            isConfirmed: config.isConfirmed,
            detectedFrom: config.detectedFrom,
          });
        } else {
          await log(
            'warn',
            `No configuration found for ${repo.repoId} - will attempt runtime detection`
          );
          enrichedRepos.push(repo);
        }
      }
    }

    await log(
      'info',
      `Job details: prompt="${job.prompt?.substring(0, 100)}${
        job.prompt && job.prompt.length > 100 ? '...' : ''
      }", repos=${
        enrichedRepos.length > 0
          ? enrichedRepos.map(r => r.repoId).join(', ')
          : 'none'
      }, agentId=${agentId || 'default'}`
    );

    // Step 1: Get git credentials from API (Backend)
    await log(
      'info',
      `Starting: Get git credentials for ${
        enrichedRepos.length > 0
          ? `${enrichedRepos.length} repo(s)`
          : 'no repos'
      }`
    );
    const gitCredentials = await getGitCredentials({
      jobId,
      orgId,
      repoId: enrichedRepos[0]?.repoId, // Use first repo for credentials (assumes same creds for all repos in org)
    });
    await log(
      'info',
      `Completed: Get git credentials - token obtained: ${
        gitCredentials?.token ? 'yes' : 'no'
      }, username: ${gitCredentials?.username || 'none'}`
    );

    // Step 2: Get vibe coder credentials (Backend) - pass agentId to read from agent record
    await log(
      'info',
      `Starting: Get vibe agent credentials for agentId=${agentId || 'default'}`
    );
    let vibeCoderCredentials;
    try {
      vibeCoderCredentials = await getVibeCoderCredentials({ orgId, agentId });
      await log(
        'info',
        `Completed: Get vibe coder credentials - credentials obtained: ${
          vibeCoderCredentials ? 'yes' : 'no'
        }`
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await log('error', `Failed: Get vibe coder credentials - ${errorMsg}`);
      await log(
        'error',
        `Workflow aborting due to credentials failure. Please check agent configuration for agentId=${
          agentId || 'default'
        }`
      );
      finalStatus = 'failed';
      finalError =
        error instanceof Error
          ? error.message
          : 'Failed to get vibe-agent credentials';
      throw error;
    }

    // Step 3: Checkout - Clone repositories
    await log(
      'info',
      `Starting: Checkout - cloning ${enrichedRepos.length} repository(ies)`
    );
    try {
      await sendCommandToAgent({
        jobId,
        orgId,
        command: 'checkout',
        payload: {
          gitCredentials,
          vibeCoderCredentials,
          prompt: job.prompt,
          repos: enrichedRepos, // Pass repos array with configs including URLs
          agentId,
        },
      });
      await log('info', 'Completed: Checkout - repositories cloned');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await log('error', `Failed: Checkout - ${errorMsg}`);
      throw error; // Checkout failure should stop the workflow
    }

    // Step 4: Setup - Run setup commands
    await log('info', 'Starting: Setup - running setup commands');
    let setupSuccess = true;
    try {
      await sendCommandToAgent({
        jobId,
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
      await log('info', 'Completed: Setup - setup commands executed');
    } catch (error) {
      setupSuccess = false;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await log('error', `Failed: Setup - ${errorMsg}`);
      verificationErrors.push(`Setup failed: ${errorMsg}`);
    }

    // Step 5: Execute - Run code generation
    await log('info', 'Starting: Execute - running code generation');
    try {
      await sendCommandToAgent({
        jobId,
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
      await log('info', 'Completed: Execute - code generation finished');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await log('error', `Failed: Execute - ${errorMsg}`);
      verificationErrors.push(`Execute failed: ${errorMsg}`);
    }

    // Step 6: Build - Run build commands
    await log('info', 'Starting: Build - running build commands');
    let buildSuccess = true;
    try {
      await sendCommandToAgent({
        jobId,
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
      await log('info', 'Completed: Build - build commands executed');
    } catch (error) {
      buildSuccess = false;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await log('error', `Failed: Build - ${errorMsg}`);
      verificationErrors.push(`Build failed: ${errorMsg}`);
    }

    // Step 7: Verify - Run verification (tests, lint, etc.)
    await log('info', 'Starting: Verify - running verification');
    let verifySuccess = true;
    try {
      const verificationResult = await sendCommandToAgent({
        jobId,
        orgId,
        command: 'runVerification',
        payload: { agentId },
      });

      if (!verificationResult.success) {
        verifySuccess = false;
        await log('error', `Failed: Verify - ${verificationResult.message}`);
        if (verificationResult.errors && verificationResult.errors.length > 0) {
          verificationErrors.push(...verificationResult.errors);
          await log(
            'error',
            `Verification errors: ${verificationResult.errors.join(', ')}`
          );
        } else {
          verificationErrors.push(
            verificationResult.message || 'Verification failed'
          );
        }
      } else {
        await log('info', 'Completed: Verify - all checks passed');
      }
    } catch (error) {
      verifySuccess = false;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await log('error', `Failed: Verify - ${errorMsg}`);
      verificationErrors.push(`Verification failed: ${errorMsg}`);
    }

    // Step 8: Create PRs (even if Build/Verify failed) - include failure content in PR
    if (enrichedRepos.length > 0) {
      await log(
        'info',
        `Starting: Create pull requests for ${enrichedRepos.length} repo(s)`
      );

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
        await log(
          'info',
          `Creating PR for ${repo.repoId}, branch=${jobId}-${repo.name}`
        );

        try {
          const repoPrResult = await sendCommandToAgent({
            jobId,
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
            await log(
              'info',
              `Completed: PR created for ${repo.repoId} - ${repoPrResult.prLink}`
            );
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          await log(
            'error',
            `Failed to create PR for ${repo.repoId}: ${errorMsg}`
          );
        }
      }
    } else {
      await log(
        'info',
        'Skipping PR creation - no repos configured for this job'
      );
    }

    // Step 9: Cleanup
    await log('info', 'Starting: Cleanup workspace on agent');
    try {
      await sendCommandToAgent({
        jobId,
        orgId,
        command: 'cleanup',
        payload: { agentId },
      });
      await log(
        'info',
        'Completed: Cleanup workspace - agent resources released'
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await log('warn', `Cleanup warning: ${errorMsg}`);
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

    await log(
      'info',
      `Workflow execution ${
        finalStatus === 'completed'
          ? 'completed successfully'
          : 'completed with errors'
      } for job ${jobId}`
    );

    await log(
      'info',
      `Final status: ${
        prLinks.length > 0
          ? `${prLinks.length} PR(s) created: ${prLinks.join(', ')}`
          : 'No PRs created (no repos configured)'
      }`
    );

    return {
      prLink: prLinks.length > 0 ? prLinks[0] : undefined,
      status: finalStatus,
    };
  } catch (error) {
    // Extract meaningful error message from Temporal errors
    let errorMessage = 'Unknown error';
    let errorStack: string | undefined;
    let errorCause: string | undefined;

    if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack;

      // If it's a Temporal ActivityFailure, extract the underlying cause
      if (
        errorMessage.includes('Activity task failed') ||
        errorMessage.includes('ActivityFailure')
      ) {
        // Check for cause property (Temporal wraps errors)
        const cause = (error as { cause?: unknown }).cause;
        if (cause instanceof Error) {
          errorMessage = cause.message;
          errorCause = cause.stack || cause.message;
        } else if (cause && typeof cause === 'string') {
          errorMessage = cause;
          errorCause = cause;
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

    // Log error details to generation logs for developer visibility
    await log('error', `Workflow execution failed: ${errorMessage}`);

    // Log the full error message if different from the extracted one
    if (error instanceof Error && error.message !== errorMessage) {
      await log('error', `Original error message: ${error.message}`);
    }

    // Log error cause if available
    if (errorCause) {
      await log('error', `Error cause: ${errorCause}`);
    }

    // Log stack trace (truncated to avoid overwhelming logs, but keep first 20 lines)
    if (errorStack) {
      const stackLines = errorStack.split('\n');
      const relevantStack = stackLines
        .filter(
          line =>
            !line.includes('Activity task failed') &&
            !line.includes('ActivityFailure') &&
            !line.includes('WorkflowExecutionFailedError')
        )
        .slice(0, 20)
        .join('\n');

      if (relevantStack) {
        await log('error', `Stack trace:\n${relevantStack}`);
      }
    }

    // Log error type for additional context
    const errorType =
      error instanceof Error ? error.constructor.name : typeof error;
    await log('error', `Error type: ${errorType}`);

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
        orgId,
        status,
        prLink,
        error: finalError,
      });

      await log(
        'info',
        `Job status updated to '${status}'${
          finalError ? ` with error: ${finalError}` : ''
        }${prLink ? ` - PR: ${prLink}` : ''}`
      );
    } catch (updateError) {
      // Log update failure but don't throw - workflow is ending
      try {
        await log(
          'error',
          `Failed to update job status: ${
            updateError instanceof Error ? updateError.message : 'Unknown error'
          }`
        );
      } catch {
        // If logging fails, we can't do much - workflow is ending anyway
      }
    }

    // Log workflow completion/termination
    try {
      await log('info', 'Workflow execution completed/terminated');
    } catch {
      // If logging fails, we can't do much - workflow is ending anyway
    }
  }
}
