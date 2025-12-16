import { db, schema } from '../db/index.js';
import { eq, and, inArray } from 'drizzle-orm';

const { repos, repoProviders, repoConfigs, jobs } = schema;

export class RepoProviderService {
  /**
   * Disconnect a repository provider and clean up all associated data
   * @param providerId - The ID of the provider to disconnect
   * @param orgId - The organization ID
   * @returns Promise<void>
   */
  static async disconnectProvider(
    providerId: string,
    orgId: string
  ): Promise<void> {
    // Verify provider exists and belongs to the org
    const provider = await db
      .select()
      .from(repoProviders)
      .where(
        and(eq(repoProviders.id, providerId), eq(repoProviders.orgId, orgId))
      )
      .limit(1);

    if (!provider[0]) {
      throw new Error('Repo provider not found');
    }

    // Get all repos for this provider to clean up related data
    const reposToDelete = await db
      .select({ id: repos.id })
      .from(repos)
      .where(
        and(eq(repos.repo_provider_id, providerId), eq(repos.orgId, orgId))
      );

    const repoIds = reposToDelete.map(repo => repo.id);

    if (repoIds.length > 0) {
      // Delete repo configs for these repositories
      await db.delete(repoConfigs).where(inArray(repoConfigs.repoId, repoIds));

      // Update jobs to remove references to these repositories
      const jobsWithRepos = await db
        .select({ id: jobs.id, version: jobs.version, repos: jobs.repos })
        .from(jobs)
        .where(eq(jobs.orgId, orgId));

      for (const job of jobsWithRepos) {
        if (job.repos && job.repos.length > 0) {
          const updatedRepos = job.repos.filter(
            repoId => !repoIds.includes(repoId)
          );
          if (updatedRepos.length !== job.repos.length) {
            await db
              .update(jobs)
              .set({ repos: updatedRepos })
              .where(and(eq(jobs.id, job.id), eq(jobs.version, job.version)));
          }
        }
      }
    }

    // Delete repositories
    await db
      .delete(repos)
      .where(
        and(eq(repos.repo_provider_id, providerId), eq(repos.orgId, orgId))
      );

    // Delete the provider
    await db
      .delete(repoProviders)
      .where(
        and(eq(repoProviders.id, providerId), eq(repoProviders.orgId, orgId))
      );
  }
}
