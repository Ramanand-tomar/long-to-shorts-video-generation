"use server";

import { db } from "@/lib/db";
import { clips, videos, users, usageLogs } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { eq, and, gte } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";
import { revalidatePath } from "next/cache";
import { QUOTAS } from "@/lib/quotas";
import { getPlayableUrl } from "@/lib/s3";

/**
 * Persists the subtitle style configuration for a clip.
 * If the clip was already rendered, resets the status to "not_started" to allow re-rendering.
 */
export async function saveClipStyle(clipId: string, styleConfig: unknown) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // 1. Retrieve the clip and verify ownership via the associated video
    const [clip] = await db
      .select({
        id: clips.id,
        videoId: clips.videoId,
        renderStatus: clips.renderStatus,
        userId: videos.userId,
      })
      .from(clips)
      .innerJoin(videos, eq(clips.videoId, videos.id))
      .where(eq(clips.id, clipId))
      .limit(1);

    if (!clip || clip.userId !== user.id) {
      return { error: "clip_not_found" };
    }

        // 2. Update subtitle style. If status was completed, reset it to not_started so it can be re-rendered.
    const newRenderStatus = clip.renderStatus === "completed" ? "not_started" : clip.renderStatus;

    await db
      .update(clips)
      .set({
        subtitleStyle: styleConfig,
        renderStatus: newRenderStatus,
        updatedAt: new Date(),
      })
      .where(eq(clips.id, clipId));

    // 3. Revalidate path cache
    revalidatePath(`/dashboard/clips/${clipId}`);
    revalidatePath(`/dashboard/videos/${clip.videoId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to save clip style:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Initiates the cloud rendering pipeline for a clip.
 * Enforces usage quotas (3 renders/day for Free tier, 100/day for Pro tier).
 */
export async function startRender(clipId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // 1. Retrieve the clip and verify ownership
    const [clip] = await db
      .select({
        id: clips.id,
        videoId: clips.videoId,
        renderStatus: clips.renderStatus,
        userId: videos.userId,
      })
      .from(clips)
      .innerJoin(videos, eq(clips.videoId, videos.id))
      .where(eq(clips.id, clipId))
      .limit(1);

    if (!clip || clip.userId !== user.id) {
      return { error: "clip_not_found" };
    }

    // 2. Prevent concurrent renders
    if (clip.renderStatus === "queued" || clip.renderStatus === "rendering") {
      return { success: true, status: clip.renderStatus };
    }

    // 3. Rolling 24-hour rate limit check
    const now = new Date();
    let currentCount = user.renderCount24h;
    let resetTime = user.lastRenderReset ? new Date(user.lastRenderReset) : now;

    const msSinceReset = now.getTime() - resetTime.getTime();
    if (msSinceReset >= 24 * 60 * 60 * 1000) {
      currentCount = 0;
      resetTime = now;
    }

    const limit = QUOTAS[user.plan as "free" | "pro"].renders;

    if (currentCount >= limit) {
      return { error: "render_limit_exceeded" };
    }

    // 4. Update status in DB to queued
    await db
      .update(clips)
      .set({
        renderStatus: "queued",
        updatedAt: now,
      })
      .where(eq(clips.id, clipId));

    // Update user's render count
    await db
      .update(users)
      .set({
        renderCount24h: currentCount + 1,
        lastRenderReset: resetTime,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // 5. Fire background Inngest event
    await inngest.send({
      name: "vidshort/render.start",
      data: {
        clipId: clipId,
        userId: user.id,
      },
    });

    // 6. Write usage logs record
    await db.insert(usageLogs).values({
      userId: user.id,
      action: "render",
      quantity: 1,
    });

    // 7. Refresh path caches
    revalidatePath(`/dashboard/clips/${clipId}`);
    revalidatePath(`/dashboard/videos/${clip.videoId}`);
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to start clip rendering:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Retrieves the status and final url of a rendering clip.
 * Used by the client details view to poll for background task completion.
 */
export async function getRenderStatus(clipId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    const [clip] = await db
      .select({
        id: clips.id,
        renderStatus: clips.renderStatus,
        clipUrl: clips.clipUrl,
        userId: videos.userId,
      })
      .from(clips)
      .innerJoin(videos, eq(clips.videoId, videos.id))
      .where(eq(clips.id, clipId))
      .limit(1);

    if (!clip || clip.userId !== user.id) {
      return { error: "clip_not_found" };
    }

    return {
      success: true,
      status: clip.renderStatus,
      clipUrl: await getPlayableUrl(clip.clipUrl),
    };
  } catch (error) {
    console.error("Failed to get render status:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Server action to delete an individual AI generated clip.
 */
export async function deleteClip(clipId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // 1. Retrieve the clip and verify ownership via the associated video
    const [clip] = await db
      .select({
        id: clips.id,
        videoId: clips.videoId,
        userId: videos.userId,
      })
      .from(clips)
      .innerJoin(videos, eq(clips.videoId, videos.id))
      .where(eq(clips.id, clipId))
      .limit(1);

    if (!clip || clip.userId !== user.id) {
      return { error: "clip_not_found" };
    }

    // 2. Delete the clip row
    await db
      .delete(clips)
      .where(eq(clips.id, clipId));

    // 3. Revalidate paths to update the clip details page and video detail page
    revalidatePath(`/dashboard/videos/${clip.videoId}`);

    return { success: true };
  } catch (error) {
    console.error("Failed to delete clip:", error);
    return { error: "internal_server_error" };
  }
}
