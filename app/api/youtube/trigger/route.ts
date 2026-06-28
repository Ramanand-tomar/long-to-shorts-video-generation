import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { videos, pipelineRuns } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { driveUrl, userId } = body;

    if (!driveUrl || !userId) {
      return NextResponse.json(
        { error: "missing_fields", message: "Both driveUrl and userId are required." },
        { status: 400 }
      );
    }

    // Extract fileId from Google Drive URL
    const driveRegex = /(?:\/file\/d\/|id=)([^/?#]+)/;
    const match = driveUrl.match(driveRegex);
    const fileId = match ? match[1] : null;

    if (!fileId) {
      return NextResponse.json(
        { error: "invalid_drive_url", message: "Failed to extract file ID from Google Drive URL." },
        { status: 400 }
      );
    }

    const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

    const title = `GDrive Video - ${fileId}`;
    const [newVideo] = await db
      .insert(videos)
      .values({
        userId: userId,
        title: title,
        fileName: `${fileId}.mp4`,
        fileSize: 0,
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
        userId: userId,
        status: "pending",
      })
      .returning();

    await inngest.send({
      name: "vidshort/auto-pipeline.start",
      data: {
        videoId: newVideo.id,
        userId: userId,
        pipelineRunId: newRun.id,
      },
    });

    return NextResponse.json({
      success: true,
      videoId: newVideo.id,
      pipelineRunId: newRun.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("API Error triggering pipeline:", error);
    return NextResponse.json(
      { error: "internal_server_error", message: errorMessage },
      { status: 500 }
    );
  }
}
