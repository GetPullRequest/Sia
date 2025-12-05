import { db, schema } from '../../db/index';
import { eq, and, isNull } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

/**
 * Manages channel/thread settings (quiet mode, etc.) - platform agnostic
 */
export class ChannelSettingsManager {
  /**
   * Check if quiet mode is enabled for a channel/thread
   * Checks thread-level first, then channel-level
   */
  async isQuietMode(
    platform: string,
    channelId: string,
    threadId: string | undefined,
    orgId: string
  ): Promise<boolean> {
    // First check thread-level settings if threadId exists
    if (threadId) {
      const threadSettings = await db
        .select()
        .from(schema.channelSettings)
        .where(
          and(
            eq(schema.channelSettings.platform, platform),
            eq(schema.channelSettings.channelId, channelId),
            eq(schema.channelSettings.threadId, threadId),
            eq(schema.channelSettings.orgId, orgId)
          )
        )
        .limit(1);

      if (threadSettings.length > 0) {
        const settings = threadSettings[0];
        // Check if quiet mode expired
        if (settings.quietUntil && new Date(settings.quietUntil) < new Date()) {
          // Quiet mode expired, update it
          await this.setQuietMode(platform, channelId, threadId, orgId, false);
          return false;
        }
        return settings.isQuiet;
      }
    }

    // Check channel-level settings (threadId is null or empty)
    const channelSettings = await db
      .select()
      .from(schema.channelSettings)
      .where(
        and(
          eq(schema.channelSettings.platform, platform),
          eq(schema.channelSettings.channelId, channelId),
          isNull(schema.channelSettings.threadId),
          eq(schema.channelSettings.orgId, orgId)
        )
      )
      .limit(1);

    if (channelSettings.length > 0) {
      const settings = channelSettings[0];
      // Check if quiet mode expired
      if (settings.quietUntil && new Date(settings.quietUntil) < new Date()) {
        // Quiet mode expired, update it
        await this.setQuietMode(platform, channelId, undefined, orgId, false);
        return false;
      }
      return settings.isQuiet;
    }

    return false; // Default: not quiet
  }

  /**
   * Set quiet mode for a channel/thread
   */
  async setQuietMode(
    platform: string,
    channelId: string,
    threadId: string | undefined,
    orgId: string,
    quiet: boolean,
    quietUntil?: Date
  ): Promise<void> {
    // Check if settings exist
    const existing = await db
      .select()
      .from(schema.channelSettings)
      .where(
        and(
          eq(schema.channelSettings.platform, platform),
          eq(schema.channelSettings.channelId, channelId),
          threadId
            ? eq(schema.channelSettings.threadId, threadId)
            : isNull(schema.channelSettings.threadId),
          eq(schema.channelSettings.orgId, orgId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing settings
      await db
        .update(schema.channelSettings)
        .set({
          isQuiet: quiet,
          quietUntil: quietUntil || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.channelSettings.id, existing[0].id));
    } else {
      // Create new settings
      await db.insert(schema.channelSettings).values({
        id: uuidv4(),
        platform,
        channelId,
        threadId: threadId || null,
        orgId,
        isQuiet: quiet,
        quietUntil: quietUntil || null,
      });
    }
  }
}

export const channelSettingsManager = new ChannelSettingsManager();

