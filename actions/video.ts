"use server";

import { db } from "@/lib/db";
import { videos, users, usageLogs, pipelineRuns } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";
import { getCurrentUser } from "@/lib/db/user";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { QUOTAS } from "@/lib/quotas";

interface CreateVideoPayload {
  title: string;
  fileName: string;
  fileSize: number;
  videoUrl: string;
  duration?: number;
  format?: string;
  cloudinaryAssetId?: string;
  triggerPipeline?: boolean;
}

/**
 * Server action to record a successfully uploaded video in the database.
 * Enforces a 24-hour rate limit based on the user's plan.
 */
export async function createVideo(payload: CreateVideoPayload) {
  try {
    // 1. Authenticate and retrieve user
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // 2. Perform 24-hour rate limit checks
    const now = new Date();
    let currentCount = user.uploadCount24h;
    let resetTime = user.lastUploadReset ? new Date(user.lastUploadReset) : now;

    const msSinceReset = now.getTime() - resetTime.getTime();
    if (msSinceReset >= 24 * 60 * 60 * 1000) {
      currentCount = 0;
      resetTime = now;
    }

    const limit = QUOTAS[user.plan as "free" | "pro"]?.uploads ?? QUOTAS.free.uploads;
    if (currentCount >= limit) {
      return { error: "upload_limit_exceeded" };
    }

    const shouldTrigger = payload.triggerPipeline !== false;

    // 3. Save the video to the database
    const [newVideo] = await db
      .insert(videos)
      .values({
        userId: user.id,
        title: payload.title,
        fileName: payload.fileName,
        fileSize: payload.fileSize,
        videoUrl: payload.videoUrl,
        duration: payload.duration || 0,
        format: payload.format || null,
        cloudinaryAssetId: payload.cloudinaryAssetId || null,
        status: shouldTrigger ? "pending" : "ready",
      })
      .returning();

    // Trigger pipeline if requested
    if (shouldTrigger) {
      const [newRun] = await db
        .insert(pipelineRuns)
        .values({
          videoId: newVideo.id,
          userId: user.id,
          status: "pending",
        })
        .returning();

      await inngest.send({
        name: "vidshort/auto-pipeline.start",
        data: {
          videoId: newVideo.id,
          userId: user.id,
          pipelineRunId: newRun.id,
        },
      });
    }

    // 4. Increment the user's upload counter and update the timestamp
    await db
      .update(users)
      .set({
        uploadCount24h: currentCount + 1,
        lastUploadAt: now,
        lastUploadReset: resetTime,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // 5. Log the action to the usage logs
    await db.insert(usageLogs).values({
      userId: user.id,
      action: "video_upload",
      quantity: 1,
    });

    // 6. Revalidate routes to refresh data on dynamic pages
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/videos");

    return { success: true, videoId: newVideo.id };
  } catch (error) {
    console.error("Failed to create video record in database:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Server action to delete an uploaded video.
 * Cascading constraints in the database will automatically remove associated clips and jobs.
 */
export async function deleteVideo(videoId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // 1. Confirm video ownership
    const [video] = await db
      .select({
        id: videos.id,
        userId: videos.userId,
      })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);

    if (!video || video.userId !== user.id) {
      return { error: "video_not_found" };
    }

    // 2. Delete video (cascade deletion is automatic)
    await db
      .delete(videos)
      .where(eq(videos.id, videoId));

    // 3. Revalidate dynamic routes
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/videos");

    return { success: true };
  } catch (error) {
    console.error("Failed to delete video:", error);
    return { error: "internal_server_error" };
  }
}
