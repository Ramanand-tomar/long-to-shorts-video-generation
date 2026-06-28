import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { videos, pipelineRuns } from "@/lib/db/schema";
import { inngest } from "@/lib/inngest/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { driveUrl, videoUrl, cloudinaryAssetId, userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "missing_fields", message: "userId is required." },
        { status: 400 }
      );
    }

    let finalVideoUrl = "";
    let finalSourceType = "";
    let finalGdriveFileId: string | null = null;
    let finalCloudinaryAssetId: string | null = null;
    let finalTitle = "";
    let finalFileName = "";

    if (driveUrl) {
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

      finalVideoUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      finalSourceType = "gdrive";
      finalGdriveFileId = fileId;
      finalTitle = `GDrive Video - ${fileId}`;
      finalFileName = `${fileId}.mp4`;
    } else if (videoUrl) {
      finalVideoUrl = videoUrl;
      finalSourceType = "cloudinary";
      finalCloudinaryAssetId = cloudinaryAssetId || null;
      finalTitle = `Uploaded Video - ${new Date().getTime()}`;
      finalFileName = `Upload_${new Date().getTime()}.mp4`;
    } else {
      return NextResponse.json(
        { error: "missing_fields", message: "Either driveUrl or videoUrl is required." },
        { status: 400 }
      );
    }

    const [newVideo] = await db
      .insert(videos)
      .values({
        userId: userId,
        title: finalTitle,
        fileName: finalFileName,
        fileSize: 0,
        videoUrl: finalVideoUrl,
        sourceType: finalSourceType,
        gdriveFileId: finalGdriveFileId,
        cloudinaryAssetId: finalCloudinaryAssetId,
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
