import { proxyActivities } from '@temporalio/workflow';
import type * as activities from '../activities';

const {
  getGitCredentials,
  getVibeCoderCredentials,
  sendCommandToAgent,
  updateJobStatus,
  getJobDetails,
  logToJobActivity,
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
  branch?: string;
}

export async function jobExecutionWorkflow(params: {
  jobId: string;
  orgId: string;
  queueType: 'rework' | 'backlog';
  agentId?: string;
  repos?: RepoConfig[]; // NEW: Support multi-repo
}): Promise<{ prLink?: string; status: string }> {
  const { jobId, orgId, agentId, repos } = params;

  try {
    // Get job details
    const job = await getJobDetails({ jobId, orgId });

    if (!job) {
      throw new Error('Job not found');
    }

    // Note: Job has already been removed from queue and marked as in-progress
    // by the claimNextJobFromQueue activity in queueMonitorWorkflow
    // This ensures atomicity and prevents race conditions

    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Workflow execution started for job ${jobId} in org ${orgId}`,
      stage: 'workflow',
    });

    // Prepare repos array from job.repos
    const reposToUse: RepoConfig[] =
      repos ||
      (job.repos && job.repos.length > 0
        ? job.repos.map(repoId => ({
            repoId,
            name: repoId.split('/')[1] || repoId,
          }))
        : []);

    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Job details: prompt="${job.prompt?.substring(0, 100)}${
        job.prompt && job.prompt.length > 100 ? '...' : ''
      }", repos=${
        reposToUse.length > 0
          ? reposToUse.map(r => r.repoId).join(', ')
          : 'none'
      }, agentId=${agentId || 'default'}`,
      stage: 'workflow',
    });

    // Step 1: Get git credentials from API (Backend)
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Starting: Get git credentials for ${
        reposToUse.length > 0 ? `${reposToUse.length} repo(s)` : 'no repos'
      }`,
      stage: 'workflow',
    });
    const gitCredentials = await getGitCredentials({
      jobId,
      orgId,
      repoId: reposToUse[0]?.repoId, // Use first repo for credentials (assumes same creds for all repos in org)
    });
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Completed: Get git credentials - token obtained: ${
        gitCredentials?.token ? 'yes' : 'no'
      }, username: ${gitCredentials?.username || 'none'}`,
      stage: 'workflow',
    });

    // Step 2: Get vibe coder credentials (Backend) - pass agentId to read from agent record
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Starting: Get vibe agent credentials for agentId=${
        agentId || 'default'
      }`,
      stage: 'workflow',
    });
    let vibeCoderCredentials;
    try {
      vibeCoderCredentials = await getVibeCoderCredentials({ orgId, agentId });
      await logToJobActivity({
        jobId,
        orgId,
        level: 'info',
        message: `Completed: Get vibe coder credentials - credentials obtained: ${
          vibeCoderCredentials ? 'yes' : 'no'
        }`,
        stage: 'workflow',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      await logToJobActivity({
        jobId,
        orgId,
        level: 'error',
        message: `Failed: Get vibe coder credentials - ${errorMsg}`,
        stage: 'workflow',
      });
      await logToJobActivity({
        jobId,
        orgId,
        level: 'error',
        message: `Workflow aborting due to credentials failure. Please check agent configuration for agentId=${
          agentId || 'default'
        }`,
        stage: 'workflow',
      });
      // Update job status to failed with credentials error
      await updateJobStatus({
        jobId,
        orgId,
        status: 'failed',
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get vibe-agent credentials',
      });
      throw error;
    }

    // Step 3-5: Send command to agent to start execution
    // Agent will: clone repos, start cursor, execute task
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Starting: Code generation execution - connecting to agent (agentId=${
        agentId || 'default'
      })`,
      stage: 'workflow',
    });
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Sending startExecution command to agent with repos: ${
        reposToUse.length > 0
          ? reposToUse.map(r => r.repoId).join(', ')
          : 'none'
      }`,
      stage: 'workflow',
    });
    await sendCommandToAgent({
      jobId,
      orgId,
      command: 'startExecution',
      payload: {
        gitCredentials,
        vibeCoderCredentials,
        prompt: job.prompt,
        repos: reposToUse, // Pass repos array
        agentId, // Pass agentId to activity
      },
    });
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message:
        'Completed: Code generation execution - agent finished processing',
      stage: 'workflow',
    });

    // Step 6: Code generation streams via gRPC (handled in activity)
    // Step 7: Execution completes (handled in startExecution)

    // Step 7.a: Automatically run verification
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Starting: Run verification - sending runVerification command to agent`,
      stage: 'workflow',
    });
    const verificationResult = await sendCommandToAgent({
      jobId,
      orgId,
      command: 'runVerification',
      payload: { agentId }, // Pass agentId to activity
    });

    if (!verificationResult.success) {
      await logToJobActivity({
        jobId,
        orgId,
        level: 'error',
        message: `Failed: Run verification - ${verificationResult.message}`,
        stage: 'workflow',
      });
      await logToJobActivity({
        jobId,
        orgId,
        level: 'error',
        message: `Verification errors: ${
          verificationResult.errors?.join(', ') || 'none provided'
        }`,
        stage: 'workflow',
      });
      throw new Error(`Verification failed: ${verificationResult.message}`);
    }
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Completed: Run verification - all checks passed`,
      stage: 'workflow',
    });

    // Step 8-9: Automatically create PRs (if repos exist)
    let prResult = null;
    const prLinks: string[] = [];

    if (reposToUse.length > 0) {
      await logToJobActivity({
        jobId,
        orgId,
        level: 'info',
        message: `Starting: Create pull requests for ${reposToUse.length} repo(s)`,
        stage: 'workflow',
      });

      // Create PR for each repo
      for (const repo of reposToUse) {
        await logToJobActivity({
          jobId,
          orgId,
          level: 'info',
          message: `Creating PR for ${repo.repoId}, branch=${jobId}-${repo.name}`,
          stage: 'workflow',
        });

        const repoPrResult = await sendCommandToAgent({
          jobId,
          orgId,
          command: 'createPR',
          payload: {
            repoId: repo.repoId,
            branchName: `${jobId}-${repo.name}`, // Unique branch per repo
            agentId,
          },
        });

        if (repoPrResult.prLink) {
          prLinks.push(repoPrResult.prLink);
          await logToJobActivity({
            jobId,
            orgId,
            level: 'info',
            message: `Completed: PR created for ${repo.repoId} - ${repoPrResult.prLink}`,
            stage: 'workflow',
          });
        }
      }

      // Use first PR link for backward compatibility
      prResult = { prLink: prLinks[0] };

      // Step 12: Backend updates PR in job and marks as in-review
      await logToJobActivity({
        jobId,
        orgId,
        level: 'info',
        message: `Starting: Update job status to in-review with ${prLinks.length} PR link(s)`,
        stage: 'workflow',
      });
      await updateJobStatus({
        jobId,
        orgId,
        status: 'in-review',
        prLink: prLinks[0], // Store first PR link (can extend to support multiple in future)
      });
      await logToJobActivity({
        jobId,
        orgId,
        level: 'info',
        message: `Completed: Update job status to in-review`,
        stage: 'workflow',
      });
    } else {
      await logToJobActivity({
        jobId,
        orgId,
        level: 'info',
        message: `Skipping PR creation - no repos configured for this job`,
        stage: 'workflow',
      });
    }

    // Step 10-11: Automatically cleanup
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Starting: Cleanup workspace on agent`,
      stage: 'workflow',
    });
    await sendCommandToAgent({
      jobId,
      orgId,
      command: 'cleanup',
      payload: { agentId }, // Pass agentId to activity
    });
    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Completed: Cleanup workspace - agent resources released`,
      stage: 'workflow',
    });

    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Workflow execution completed successfully for job ${jobId}`,
      stage: 'workflow',
    });

    await logToJobActivity({
      jobId,
      orgId,
      level: 'info',
      message: `Final status: ${
        prLinks.length > 0
          ? `${prLinks.length} PR(s) created: ${prLinks.join(', ')}`
          : 'No PRs created (no repos configured)'
      }`,
      stage: 'workflow',
    });

    return {
      prLink: prResult?.prLink,
      status: 'completed',
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
    await logToJobActivity({
      jobId,
      orgId,
      level: 'error',
      message: `Workflow execution failed: ${errorMessage}`,
      stage: 'workflow',
    });

    // Log the full error message if different from the extracted one
    if (error instanceof Error && error.message !== errorMessage) {
      await logToJobActivity({
        jobId,
        orgId,
        level: 'error',
        message: `Original error message: ${error.message}`,
        stage: 'workflow',
      });
    }

    // Log error cause if available
    if (errorCause) {
      await logToJobActivity({
        jobId,
        orgId,
        level: 'error',
        message: `Error cause: ${errorCause}`,
        stage: 'workflow',
      });
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
        await logToJobActivity({
          jobId,
          orgId,
          level: 'error',
          message: `Stack trace:\n${relevantStack}`,
          stage: 'workflow',
        });
      }
    }

    // Log error type for additional context
    const errorType =
      error instanceof Error ? error.constructor.name : typeof error;
    await logToJobActivity({
      jobId,
      orgId,
      level: 'error',
      message: `Error type: ${errorType}`,
      stage: 'workflow',
    });

    await logToJobActivity({
      jobId,
      orgId,
      level: 'error',
      message: `Job status will be updated to 'failed'. Please review the error details above.`,
      stage: 'workflow',
    });

    await updateJobStatus({
      jobId,
      orgId,
      status: 'failed',
      error: errorMessage,
    });

    await logToJobActivity({
      jobId,
      orgId,
      level: 'error',
      message: `[Workflow] Workflow execution terminated with error. Job marked as failed.`,
      stage: 'workflow',
    });

    throw error;
  } finally {
    // Log workflow completion/termination
    // This will run whether the workflow succeeds or fails
    try {
      await logToJobActivity({
        jobId,
        orgId,
        level: 'info',
        message: `[Workflow] Workflow execution completed/terminated.`,
        stage: 'workflow',
      });
    } catch {
      // If logging fails, we can't do much - workflow is ending anyway
      // This is a best-effort log
    }
  }
}
