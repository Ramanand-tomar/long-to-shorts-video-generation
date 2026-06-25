"use server";

import { db } from "@/lib/db";
import { videos, analysisJobs, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { eq, and, or } from "drizzle-orm";
import { inngest } from "@/lib/inngest/client";
import { revalidatePath } from "next/cache";

/**
 * Triggers the AI analysis pipeline on a video.
 * Enforces ownership and checks that no other analysis is currently active.
 */
export async function startAnalysis(videoId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // 1. Confirm video ownership
    const [video] = await db
      .select()
      .from(videos)
      .where(and(eq(videos.id, videoId), eq(videos.userId, user.id)))
      .limit(1);

    if (!video) {
      return { error: "video_not_found" };
    }

    // 2. Perform 24-hour rate limit checks for AI Analysis
    const now = new Date();
    let currentCount = user.analysisCount24h;
    let resetTime = user.lastAnalysisReset ? new Date(user.lastAnalysisReset) : now;

    const msSinceReset = now.getTime() - resetTime.getTime();
    if (msSinceReset >= 24 * 60 * 60 * 1000) {
      currentCount = 0;
      resetTime = now;
    }

    const limit = user.plan === "free" ? 50 : 100;
    if (currentCount >= limit) {
      return { error: "analysis_limit_exceeded" };
    }

    // 3. Prevent concurrent analysis runs
    const [activeJob] = await db
      .select()
      .from(analysisJobs)
      .where(
        and(
          eq(analysisJobs.videoId, videoId),
          or(
            eq(analysisJobs.status, "queued"),
            eq(analysisJobs.status, "processing")
          )
        )
      )
      .limit(1);

    if (activeJob) {
      return { success: true, jobId: activeJob.id, status: activeJob.status };
    }

    // 4. Register a new AnalysisJob in the DB
    const [newJob] = await db
      .insert(analysisJobs)
      .values({
        videoId: videoId,
        status: "queued",
      })
      .returning();

    // 4. Update the parent video record's status to processing
    await db
      .update(videos)
      .set({
        status: "processing",
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));

    // Increment analysis count for the user
    await db
      .update(users)
      .set({
        analysisCount24h: currentCount + 1,
        lastAnalysisReset: resetTime,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));

    // 5. Fire background Inngest event
    await inngest.send({
      name: "vidshort/analysis.start",
      data: {
        videoId,
        userId: user.id,
        analysisJobId: newJob.id,
      },
    });

    // 6. Refresh path caches
    revalidatePath(`/dashboard/videos/${videoId}`);
    revalidatePath("/dashboard/videos");
    revalidatePath("/dashboard");

    return { success: true, jobId: newJob.id };
  } catch (error) {
    console.error("Failed to start AI analysis in server action:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Returns the status of an active or completed AnalysisJob.
 * Used by the client details view to poll for background task completion.
 */
export async function getAnalysisStatus(jobId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // Retrieve the job details, joining with videos to verify ownership
    const [jobWithVideo] = await db
      .select({
        id: analysisJobs.id,
        status: analysisJobs.status,
        error: analysisJobs.error,
        userId: videos.userId,
      })
      .from(analysisJobs)
      .innerJoin(videos, eq(analysisJobs.videoId, videos.id))
      .where(eq(analysisJobs.id, jobId))
      .limit(1);

    if (!jobWithVideo || jobWithVideo.userId !== user.id) {
      return { error: "job_not_found" };
    }

    return { 
      success: true, 
      status: jobWithVideo.status, 
      error: jobWithVideo.error 
    };
  } catch (error) {
    console.error("Failed to retrieve analysis job status:", error);
    return { error: "internal_server_error" };
  }
}
