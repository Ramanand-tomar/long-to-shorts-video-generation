"use server";

import { db } from "@/lib/db";
import { videos, pipelineRuns } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { inngest } from "@/lib/inngest/client";
import { revalidatePath } from "next/cache";

export async function submitGoogleDriveVideo(driveUrl: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    const driveRegex = /(?:\/file\/d\/|id=)([^/?#]+)/;
    const match = driveUrl.match(driveRegex);
    const fileId = match ? match[1] : null;

    if (!fileId) {
      return { error: "invalid_drive_url", message: "Failed to extract file ID from Google Drive URL." };
    }

    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const headResponse = await fetch(directUrl, { method: "HEAD" });
    if (!headResponse.ok) {
      return { 
        error: "inaccessible_file", 
        message: "Google Drive file is inaccessible. Please ensure 'Anyone with the link can view' is enabled." 
      };
    }

    const contentType = headResponse.headers.get("Content-Type") || "";
    const contentLengthStr = headResponse.headers.get("Content-Length");
    const fileSize = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;

    if (contentType.includes("html") || contentType.includes("json") || contentType.includes("text")) {
      return { 
        error: "invalid_mime_type", 
        message: `The file type (${contentType}) is not a supported video file.` 
      };
    }

    const title = `GDrive Video - ${fileId}`;
    const [newVideo] = await db
      .insert(videos)
      .values({
        userId: user.id,
        title: title,
        fileName: `${fileId}.mp4`,
        fileSize: fileSize,
        videoUrl: directUrl,
        sourceType: "gdrive",
        gdriveFileId: fileId,
        status: "pending",
      })
      .returning();

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

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/videos");

    return { 
      success: true, 
      videoId: newVideo.id, 
      pipelineRunId: newRun.id 
    };
  } catch (error) {
    console.error("Failed to submit Google Drive video:", error);
    return { error: "internal_server_error", message: "An unexpected error occurred on the server." };
  }
}
