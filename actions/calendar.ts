"use server";

import { db } from "@/lib/db";
import { clips, socialConnections, scheduledPosts, videos } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { inngest } from "@/lib/inngest/client";

interface SchedulePostPayload {
  clipId: string;
  connectionIds: string[];
  scheduledFor: string; // ISO string representation of the date/time
  caption: string;
}

/**
 * Schedules a post for a clip to multiple connected channels.
 * Validates render status of the clip, future post date, ownership, and active scheduling quotas.
 */
export async function schedulePost(payload: SchedulePostPayload) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    const { clipId, connectionIds, scheduledFor, caption } = payload;

    if (!clipId || !connectionIds || connectionIds.length === 0 || !scheduledFor) {
      return { error: "missing_required_fields" };
    }

    // 1. Validate post date is in the future
    const scheduleDate = new Date(scheduledFor);
    if (isNaN(scheduleDate.getTime()) || scheduleDate.getTime() <= Date.now()) {
      return { error: "invalid_future_date" };
    }

    // 2. Fetch the clip and confirm ownership
    const [clip] = await db
      .select({
        id: clips.id,
        renderStatus: clips.renderStatus,
        videoId: clips.videoId,
        userId: videos.userId,
      })
      .from(clips)
      .innerJoin(videos, eq(clips.videoId, videos.id))
      .where(and(eq(clips.id, clipId), eq(videos.userId, user.id)))
      .limit(1);

    if (!clip) {
      return { error: "clip_not_found" };
    }

    // 3. Confirm clip is rendered (completed)
    if (clip.renderStatus !== "completed") {
      return { error: "clip_not_rendered" };
    }

    // 4. Validate connections exist and belong to the user
    for (const connectionId of connectionIds) {
      const [connection] = await db
        .select()
        .from(socialConnections)
        .where(
          and(
            eq(socialConnections.id, connectionId),
            eq(socialConnections.userId, user.id)
          )
        )
        .limit(1);

      if (!connection) {
        return { error: `invalid_connection_${connectionId}` };
      }
    }

    // 5. Enforce active queue limit for Free users (max 5 active scheduled posts)
    if (user.plan === "free") {
      const activeScheduledPostsRes = await db
        .select({ count: sql<number>`count(*)` })
        .from(scheduledPosts)
        .where(
          and(
            eq(scheduledPosts.userId, user.id),
            eq(scheduledPosts.status, "scheduled")
          )
        );

      const activeCount = Number(activeScheduledPostsRes[0]?.count || 0);
      const newCount = activeCount + connectionIds.length;

      if (newCount > 5) {
        return { error: "plan_limit_exceeded" };
      }
    }

    // 6. Schedule posts for each selected connection
    const scheduledRecords = [];
    for (const connectionId of connectionIds) {
      const [scheduled] = await db
        .insert(scheduledPosts)
        .values({
          userId: user.id,
          clipId,
          connectionId,
          caption,
          scheduledFor: scheduleDate,
          status: "scheduled",
        })
        .returning();
      
      // Dispatch the Inngest event to trigger the publishing flow (which will sleep until scheduled date)
      await inngest.send({
        name: "vidshort/post.publish",
        data: {
          scheduledPostId: scheduled.id,
        },
      });

      scheduledRecords.push(scheduled);
    }

    // 7. Revalidate paths
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");

    return { success: true, scheduledPosts: scheduledRecords };
  } catch (error) {
    console.error("Failed to schedule post:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Uses Gemini to generate high-converting social media caption copy.
 * Pre-fills the scheduler modal text field.
 */
export async function generateAICaption(prompt: string, clipTitle: string, hookText?: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const isMock = !geminiKey || geminiKey.includes("placeholder") || geminiKey.startsWith("your_");

    if (isMock) {
      // Simulate delay and return a mock caption
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return {
        success: true,
        caption: `🔥 ${clipTitle}!\n\n"${hookText || "Check this out!"}"\n\nWhat do you think? Drop a comment below! 👇\n\n#video #viral #trending #contentcreator #motivation`,
        hashtags: ["video", "viral", "trending", "contentcreator", "motivation"],
      };
    }

    const geminiPrompt = `
You are an expert social media copywriter and growth marketer. Generate a highly engaging, high-converting caption and list of hashtags for a short-form video clip.
The clip title is: "${clipTitle}".
The first sentence/hook of the clip is: "${hookText || ""}".
The user's specific context or request is: "${prompt}".

Guidelines:
1. Write a captivating, scroll-stopping hook matching or building upon the clip's hook.
2. Structure the caption with clean line breaks, emojis, and clear call-to-actions (e.g. "Double tap if you agree!", "Share this with a friend!").
3. Make it suitable for TikTok, Instagram Reels, and YouTube Shorts.
4. Keep the caption concise yet punchy.

You MUST reply strictly with a JSON object (no markdown block wrapper, just raw JSON) conforming to this format:
{
  "caption": "The written caption with emojis and line breaks",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}
`;

    let response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: geminiPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn("Gemini 2.5 Flash caption generation failed. Trying fallback to gemini-2.0-flash...");
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API caption generation failed: ${errText}`);
    }

    const result = await response.json();
    const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!jsonText) {
      throw new Error("Gemini returned an empty response");
    }

    const parsed = JSON.parse(jsonText.trim());
    
    // Combine caption and hashtags nicely if required, or return them separately
    return {
      success: true,
      caption: parsed.caption,
      hashtags: parsed.hashtags || [],
    };
  } catch (error) {
    console.error("Failed to generate AI caption:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Retrieves all rendered clips (renderStatus = 'completed') owned by the current user.
 */
export async function getCompletedClips() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    return await db
      .select({
        id: clips.id,
        title: clips.title,
        description: clips.description,
        startTime: clips.startTime,
        endTime: clips.endTime,
        clipUrl: clips.clipUrl,
        videoTitle: videos.title,
        hookText: clips.hookText
      })
      .from(clips)
      .innerJoin(videos, eq(clips.videoId, videos.id))
      .where(
        and(
          eq(videos.userId, user.id),
          eq(clips.renderStatus, "completed")
        )
      );
  } catch (error) {
    console.error("Failed to retrieve completed clips:", error);
    return [];
  }
}

/**
 * Retrieves all scheduled, publishing, published, and failed posts for the current user.
 */
export async function getScheduledPosts() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    return await db
      .select({
        id: scheduledPosts.id,
        caption: scheduledPosts.caption,
        scheduledFor: scheduledPosts.scheduledFor,
        status: scheduledPosts.status,
        errorMessage: scheduledPosts.errorMessage,
        clipTitle: clips.title,
        clipUrl: clips.clipUrl,
        platform: socialConnections.platform,
        profileName: socialConnections.profileName,
      })
      .from(scheduledPosts)
      .innerJoin(clips, eq(scheduledPosts.clipId, clips.id))
      .innerJoin(socialConnections, eq(scheduledPosts.connectionId, socialConnections.id))
      .where(eq(scheduledPosts.userId, user.id));
  } catch (error) {
    console.error("Failed to retrieve scheduled posts:", error);
    return [];
  }
}

interface PublishPostNowPayload {
  clipId: string;
  connectionIds: string[];
  caption: string;
}

/**
 * Publishes a post immediately to selected connected channels.
 */
export async function publishPostNow(payload: PublishPostNowPayload) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    const { clipId, connectionIds, caption } = payload;

    if (!clipId || !connectionIds || connectionIds.length === 0) {
      return { error: "missing_required_fields" };
    }

    // 1. Fetch the clip and confirm ownership
    const [clip] = await db
      .select({
        id: clips.id,
        renderStatus: clips.renderStatus,
        videoId: clips.videoId,
        userId: videos.userId,
      })
      .from(clips)
      .innerJoin(videos, eq(clips.videoId, videos.id))
      .where(and(eq(clips.id, clipId), eq(videos.userId, user.id)))
      .limit(1);

    if (!clip) {
      return { error: "clip_not_found" };
    }

    // 2. Confirm clip is rendered (completed)
    if (clip.renderStatus !== "completed") {
      return { error: "clip_not_rendered" };
    }

    // 3. Validate connections exist and belong to the user
    for (const connectionId of connectionIds) {
      const [connection] = await db
        .select()
        .from(socialConnections)
        .where(
          and(
            eq(socialConnections.id, connectionId),
            eq(socialConnections.userId, user.id)
          )
        )
        .limit(1);

      if (!connection) {
        return { error: `invalid_connection_${connectionId}` };
      }
    }

    // 4. Create post records with status 'scheduled' and scheduledFor = now
    const scheduledRecords = [];
    const now = new Date();
    for (const connectionId of connectionIds) {
      const [scheduled] = await db
        .insert(scheduledPosts)
        .values({
          userId: user.id,
          clipId,
          connectionId,
          caption,
          scheduledFor: now,
          status: "scheduled",
        })
        .returning();

      // Dispatch the Inngest event to trigger the publishing flow immediately (no sleep since it's already due/now)
      await inngest.send({
        name: "vidshort/post.publish",
        data: {
          scheduledPostId: scheduled.id,
        },
      });

      scheduledRecords.push(scheduled);
    }

    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");

    return { success: true, publishedPosts: scheduledRecords };
  } catch (error) {
    console.error("Failed to publish post immediately:", error);
    return { error: "internal_server_error" };
  }
}

