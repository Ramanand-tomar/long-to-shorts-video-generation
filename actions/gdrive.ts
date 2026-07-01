"use server";

import { db } from "@/lib/db";
import { videos, pipelineRuns, socialConnections } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { inngest } from "@/lib/inngest/client";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";

async function refreshGoogleDriveAccessToken(encryptedRefreshToken: string): Promise<string> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  let rawRefreshToken = encryptedRefreshToken;
  if (rawRefreshToken && (rawRefreshToken.startsWith("v1:") || rawRefreshToken.includes(":"))) {
    try {
      rawRefreshToken = decrypt(rawRefreshToken);
    } catch (err) {
      console.error("Failed to decrypt GDrive refresh token:", err);
    }
  }

  if (!clientId || !clientSecret || !rawRefreshToken) {
    throw new Error("Missing OAuth credentials for Google Drive.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: rawRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to refresh GDrive token: ${errText}`);
  }

  const data = await response.json();
  return data.access_token;
}

export async function getGoogleDriveConnection() {
  try {
    const user = await getCurrentUser();
    if (!user) return null;

    const [conn] = await db
      .select({
        id: socialConnections.id,
        profileName: socialConnections.profileName,
        refreshToken: socialConnections.refreshToken,
      })
      .from(socialConnections)
      .where(
        and(
          eq(socialConnections.userId, user.id),
          eq(socialConnections.platform, "gdrive")
        )
      )
      .limit(1);

    if (!conn) return null;

    let accessToken: string | null = null;
    if (conn.refreshToken) {
      try {
        accessToken = await refreshGoogleDriveAccessToken(conn.refreshToken);
      } catch (err) {
        console.error("Failed to refresh access token for Google Drive upload:", err);
      }
    }

    return {
      id: conn.id,
      profileName: conn.profileName,
      accessToken,
    };
  } catch (error) {
    console.error("Failed to get Google Drive connection:", error);
    return null;
  }
}

export async function disconnectGoogleDrive() {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "unauthorized" };

    await db
      .delete(socialConnections)
      .where(
        and(
          eq(socialConnections.userId, user.id),
          eq(socialConnections.platform, "gdrive")
        )
      );

    return { success: true };
  } catch (error) {
    console.error("Failed to disconnect Google Drive:", error);
    return { error: "internal_server_error" };
  }
}

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
    let fileSize = 0;
    let contentType = "video/mp4";
    let title = `GDrive Video - ${fileId}`;
    let isPrivate = false;

    // Check if the user has Google Drive OAuth linked
    const [conn] = await db
      .select()
      .from(socialConnections)
      .where(
        and(
          eq(socialConnections.userId, user.id),
          eq(socialConnections.platform, "gdrive")
        )
      )
      .limit(1);

    if (conn && conn.refreshToken) {
      try {
        const accessToken = await refreshGoogleDriveAccessToken(conn.refreshToken);
        
        // Fetch metadata from Google API to check file size and title
        const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size`, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (metaResponse.ok) {
          const metaData = await metaResponse.json();
          fileSize = metaData.size ? parseInt(metaData.size, 10) : 0;
          contentType = metaData.mimeType || contentType;
          title = metaData.name || title;
          isPrivate = true;

          // Temporarily make the file publicly readable by everyone with link
          const permResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              role: "reader",
              type: "anyone",
            }),
          });

          if (!permResponse.ok) {
            console.error("Failed to set temporary public permission:", await permResponse.text());
          }
        }
      } catch (authErr) {
        console.error("Failed to query Google Drive API with OAuth. Trying public fallback...", authErr);
      }
    }

    if (!isPrivate) {
      // Public file fallback check
      const headResponse = await fetch(directUrl, { method: "HEAD" });
      if (!headResponse.ok) {
        return { 
          error: "inaccessible_file", 
          message: "Google Drive file is inaccessible. Please link Google Drive in modal, or ensure 'Anyone with the link can view' is enabled." 
        };
      }

      contentType = headResponse.headers.get("Content-Type") || "";
      const contentLengthStr = headResponse.headers.get("Content-Length");
      fileSize = contentLengthStr ? parseInt(contentLengthStr, 10) : 0;
    }

    if (contentType.includes("html") || contentType.includes("json") || contentType.includes("text")) {
      return { 
        error: "invalid_mime_type", 
        message: `The file type (${contentType}) is not a supported video file.` 
      };
    }

    const [newVideo] = await db
      .insert(videos)
      .values({
        userId: user.id,
        title: title,
        fileName: title.endsWith(".mp4") || title.endsWith(".mov") || title.endsWith(".webm") ? title : `${title}.mp4`,
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
