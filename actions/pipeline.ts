"use server";

import { db } from "@/lib/db";
import { pipelineRuns, clips, videos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function getPipelineStatus(pipelineRunId: string) {
  try {
    const [run] = await db
      .select()
      .from(pipelineRuns)
      .where(eq(pipelineRuns.id, pipelineRunId))
      .limit(1);

    if (!run) {
      return { error: "not_found" };
    }

    const [video] = await db
      .select({ title: videos.title, sourceType: videos.sourceType })
      .from(videos)
      .where(eq(videos.id, run.videoId))
      .limit(1);

    const runClips = await db
      .select({
        id: clips.id,
        title: clips.title,
        startTime: clips.startTime,
        endTime: clips.endTime,
        renderStatus: clips.renderStatus,
        youtubeVideoId: clips.youtubeVideoId,
        youtubePublishedAt: clips.youtubePublishedAt,
        youtubeTitle: clips.youtubeTitle,
      })
      .from(clips)
      .where(eq(clips.videoId, run.videoId))
      .orderBy(clips.startTime);

    return {
      success: true,
      pipelineRun: {
        id: run.id,
        status: run.status,
        errorMessage: run.errorMessage,
        totalClips: run.totalClips,
        publishedClips: run.publishedClips,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        videoTitle: video?.title || "Unknown Video",
        videoSource: video?.sourceType || "gdrive",
      },
      clips: runClips,
    };
  } catch (error) {
    console.error("Failed to get pipeline status:", error);
    return { error: "internal_server_error" };
  }
}
