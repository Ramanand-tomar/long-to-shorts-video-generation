import { inngest } from "../client";
import { db } from "@/lib/db";
import { scheduledPosts, socialConnections, clips, usageLogs } from "@/lib/db/schema";
import { eq, and, lte } from "drizzle-orm";
import { publishToZernio } from "@/lib/zernio";
import { decrypt } from "@/lib/encryption";

// Unused interface commented out to resolve ESLint warning
// interface PublishPostEvent {
//   name: "vidshort/post.publish";
//   data: {
//     scheduledPostId: string;
//   };
// }

/**
 * Cron function running every 15 minutes.
 * Scans the DB for scheduled posts that are due, and triggers the publishing flow for each.
 */
export const publishScheduledPosts = inngest.createFunction(
  { 
    id: "publish-scheduled-posts", 
    name: "Publish Scheduled Posts Cron",
    triggers: [{ cron: "*/15 * * * *" }]
  },
  async ({ step }) => {
    const now = new Date();

    // 1. Query all posts with status 'scheduled' whose time is due
    const duePosts = await step.run("get-due-posts", async () => {
      return await db
        .select({
          id: scheduledPosts.id,
        })
        .from(scheduledPosts)
        .where(
          and(
            eq(scheduledPosts.status, "scheduled"),
            lte(scheduledPosts.scheduledFor, now)
          )
        );
    });

    if (duePosts.length === 0) {
      return { message: "No due posts found." };
    }

    // 2. Fire the publish event for each due post to handle them independently
    const events = duePosts.map((post) => ({
      name: "vidshort/post.publish" as const,
      data: {
        scheduledPostId: post.id,
      },
    }));

    await step.sendEvent("trigger-individual-publishing", events);

    return { triggeredCount: duePosts.length };
  }
);

/**
 * Worker function that handles publishing a single post.
 * Configured with retries and failure fallback.
 */
export const publishSinglePost = inngest.createFunction(
  {
    id: "publish-single-post",
    name: "Publish Single Post",
    concurrency: 5,
    // Max 3 retries (first attempt + 2 retries = 3 attempts total)
    retries: 2, 
    triggers: [{ event: "vidshort/post.publish" }]
  },
  async ({ event, step }) => {
    const { scheduledPostId } = event.data;

    // Validate that scheduledPostId is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scheduledPostId);
    if (!isUuid) {
      return { status: "ignored", reason: `Invalid UUID format: ${scheduledPostId}` };
    }

    // 1. Fetch scheduled post, associated connection, and clip
    const postDetails = await step.run("get-post-details", async () => {
      const [details] = await db
        .select({
          postId: scheduledPosts.id,
          caption: scheduledPosts.caption,
          clipUrl: clips.clipUrl,
          clipTitle: clips.title,
          connectionId: socialConnections.id,
          accessToken: socialConnections.accessToken,
          externalAccountId: socialConnections.externalAccountId,
          platform: socialConnections.platform,
          userId: scheduledPosts.userId,
          status: scheduledPosts.status,
          scheduledFor: scheduledPosts.scheduledFor,
        })
        .from(scheduledPosts)
        .innerJoin(clips, eq(scheduledPosts.clipId, clips.id))
        .innerJoin(socialConnections, eq(scheduledPosts.connectionId, socialConnections.id))
        .where(eq(scheduledPosts.id, scheduledPostId))
        .limit(1);

      return details;
    });

    if (!postDetails) {
      return { status: "ignored", reason: "Post details not found" };
    }

    // 2. Sleep until the scheduled post time is reached (if it's in the future)
    const scheduledTime = new Date(postDetails.scheduledFor);
    if (scheduledTime.getTime() > Date.now()) {
      await step.sleepUntil("wait-until-scheduled-time", scheduledTime);

      // Re-verify the scheduled post is still in 'scheduled' status (not cancelled or double-processed)
      const currentDetails = await step.run("reverify-post-status", async () => {
        const [details] = await db
          .select({
            status: scheduledPosts.status,
          })
          .from(scheduledPosts)
          .where(eq(scheduledPosts.id, scheduledPostId))
          .limit(1);
        return details;
      });

      if (!currentDetails || currentDetails.status !== "scheduled") {
        return { status: "ignored", reason: `Post is no longer in scheduled status: ${currentDetails?.status || "deleted"}` };
      }
    } else {
      // If it's already in the past, verify it is still in 'scheduled' status (prevents double-publishing)
      if (postDetails.status !== "scheduled") {
        return { status: "ignored", reason: `Post is already processed with status: ${postDetails.status}` };
      }
    }

    // 3. Set status to publishing
    await step.run("update-status-publishing", async () => {
      await db
        .update(scheduledPosts)
        .set({ status: "publishing", updatedAt: new Date() })
        .where(eq(scheduledPosts.id, scheduledPostId));
    });

    // 3. Decrypt tokens to demonstrate decryption requirement (Zernio handles it on API endpoint, but we decrypt here as requested)
    const decryptedToken = await step.run("decrypt-credentials", async () => {
      try {
        return decrypt(postDetails.accessToken);
      } catch (err) {
        console.error("Token decryption failed:", err);
        return null;
      }
    });

    if (decryptedToken) {
      console.log(`Verified token decryption. Length: ${decryptedToken.length}`);
    }

    // 4. Submit post to Zernio API
    const publishResponse = await step.run("send-to-zernio", async () => {
      if (!postDetails.clipUrl) {
        throw new Error("Clip does not have a rendered video URL");
      }
      if (!postDetails.externalAccountId) {
        throw new Error("Social connection has no external account ID linked");
      }

      try {
        const result = await publishToZernio({
          title: postDetails.clipTitle || undefined,
          content: postDetails.caption || "",
          mediaItems: [
            {
              type: "video",
              url: postDetails.clipUrl,
            }
          ],
          platforms: [
            {
              platform: postDetails.platform,
              accountId: postDetails.externalAccountId,
            }
          ],
          publishNow: true,
        });
        return result as { id?: string; status?: string; platforms?: unknown[]; publishedAt?: string };
      } catch (error: unknown) {
        // Parse error message / status code
        const err = error as { message?: string };
        const msg = err.message || "";
        const is4xx = msg.includes("status: 4") || msg.includes("(40") || msg.includes("failed (4");
        
        if (is4xx) {
          // 4xx client/revocation error -> Non-retryable error, update status to failed directly
          await db
            .update(scheduledPosts)
            .set({ 
              status: "failed", 
              errorMessage: `Client configuration error: ${msg}`,
              updatedAt: new Date() 
            })
            .where(eq(scheduledPosts.id, scheduledPostId));
          
          return { status: "failed_4xx", error: msg };
        }
        
        // 5xx or others -> throw so Inngest retries
        throw error;
      }
    });

    if (publishResponse && publishResponse.status === "failed_4xx") {
      return { status: "failed_client_error" };
    }

    const postId = (publishResponse as { id?: string }).id || "published";

    // 5. Update post status to published
    await step.run("update-status-published", async () => {
      await db
        .update(scheduledPosts)
        .set({
          status: "published",
          publishedPostId: postId,
          platformResponse: publishResponse,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, scheduledPostId));
    });

    // 6. Write to usage logs
    await step.run("log-usage", async () => {
      await db.insert(usageLogs).values({
        userId: postDetails.userId,
        action: "social_publish",
        quantity: 1,
      });
    });

    return { status: "success", postId: postId };
  }
);

/**
 * Global failure handler for publishSinglePost function.
 * Called when all retries are exhausted.
 */
export const handlePublishFailure = inngest.createFunction(
  { 
    id: "publish-single-post-failed", 
    name: "Handle Publish Single Post Failure",
    triggers: [{ event: "inngest/function.failed" }]
  },
  async ({ event, step }) => {
    // Only handle failures from publishSinglePost
    const originalEvent = event.data.event;
    if (originalEvent.name !== "vidshort/post.publish") {
      return;
    }

    const { scheduledPostId } = originalEvent.data;

    // Validate that scheduledPostId is a valid UUID
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scheduledPostId);
    if (!isUuid) {
      return { status: "ignored", reason: `Invalid UUID format: ${scheduledPostId}` };
    }

    const errorMsg = event.data.error.message || "Max retries exceeded";

    await step.run("update-status-failed-permanent", async () => {
      await db
        .update(scheduledPosts)
        .set({
          status: "failed",
          errorMessage: `Permanent failure: ${errorMsg}`,
          updatedAt: new Date(),
        })
        .where(eq(scheduledPosts.id, scheduledPostId));
    });

    return { status: "failed_permanently", errorMsg };
  }
);
