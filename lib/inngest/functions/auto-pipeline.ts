import { inngest } from "../client";
import { db } from "@/lib/db";
import { videos, clips, pipelineRuns, users, socialConnections } from "@/lib/db/schema";
import { eq, asc, and, gte, lte } from "drizzle-orm";
import { renderMediaOnLambda, getRenderProgress, AwsRegion } from "@remotion/lambda";
import { publishToZernio } from "@/lib/zernio";
import { deleteFileFromS3, uploadStreamToS3, getPlayableUrl } from "@/lib/s3";
import { sendCompletionEmail, sendFailureEmail } from "@/lib/email";
import { uploadVideoToYouTube } from "@/lib/youtube";
import { StyleConfig } from "@/components/remotion/ClipComposition";
import { v2 as cloudinary } from 'cloudinary';
import { decrypt } from "@/lib/encryption";

interface EventData {
  videoId: string;
  userId: string;
  pipelineRunId: string;
}

interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

interface TranscriptPayload {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        words?: TranscriptWord[];
      }>;
    }>;
  };
}

interface SuggestedClip {
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  confidenceScore: number;
  reason?: string;
  seoScore?: number;
  hookText?: string;
  hook?: string;
  captionText?: string;
  hashtags?: string[];
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  let response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    console.warn("Gemini 2.5-flash failed. Falling back to 2.0-flash...");
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API generateContent failed: ${errText}`);
  }

  const result = await response.json();
  const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!jsonText) {
    throw new Error("Gemini returned an empty response");
  }
  return jsonText.trim();
}

export const autoPipeline = inngest.createFunction(
  {
    id: "auto-pipeline",
    name: "Auto-Pipeline Core Orchestrator",
    triggers: [{ event: "vidshort/auto-pipeline.start" }],
    retries: 1,
  },
  async ({ event, step }) => {
    const { videoId, userId, pipelineRunId } = event.data as EventData;

    try {
      // 0. Pre-validate YouTube connection via Zernio to prevent wasteful API usage
      await step.run("validate-youtube-connection", async () => {
        const [youtubeConn] = await db
          .select()
          .from(socialConnections)
          .where(
            and(
              eq(socialConnections.userId, userId),
              eq(socialConnections.platform, "youtube")
            )
          )
          .limit(1);

        if (!youtubeConn) {
          throw new Error("No connected YouTube channel found. Connect your YouTube channel in Settings first.");
        }
      });

      // 1. Update pipelineRuns to analyzing
      await step.run("update-pipeline-analyzing", async () => {
        await db
          .update(pipelineRuns)
          .set({
            status: "analyzing",
            updatedAt: new Date(),
          })
          .where(eq(pipelineRuns.id, pipelineRunId));

        await db
          .update(videos)
          .set({
            status: "analyzing",
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      });

      // 1.5 Prepare Video Source (Clone Google Drive video to S3 if needed)
      await step.run("prepare-video-source", async () => {
        const [video] = await db
          .select()
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (!video) {
          throw new Error(`Video record not found for ID: ${videoId}`);
        }

        if (video.sourceType === "gdrive" && video.gdriveFileId) {
          // Check if we already cloned it to S3
          if (video.videoUrl.includes(".amazonaws.com/")) {
            return;
          }

          // Get fresh Google Drive token
          const [conn] = await db
            .select()
            .from(socialConnections)
            .where(
              and(
                eq(socialConnections.userId, userId),
                eq(socialConnections.platform, "gdrive")
              )
            )
            .limit(1);

          if (!conn || !conn.refreshToken) {
            throw new Error("Google Drive connection is missing. Please reconnect Google Drive.");
          }

          const clientId = process.env.YOUTUBE_CLIENT_ID;
          const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
          let rawRefreshToken = conn.refreshToken;
          if (rawRefreshToken && (rawRefreshToken.startsWith("v1:") || rawRefreshToken.includes(":"))) {
            rawRefreshToken = decrypt(rawRefreshToken);
          }

          const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId!,
              client_secret: clientSecret!,
              refresh_token: rawRefreshToken,
              grant_type: "refresh_token",
            }),
          });

          if (!refreshResponse.ok) {
            throw new Error(`Failed to refresh Google Drive token: ${await refreshResponse.text()}`);
          }

          const refreshData = await refreshResponse.json();
          const accessToken = refreshData.access_token;

          // Fetch stream from Google Drive
          const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${video.gdriveFileId}?alt=media`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });

          if (!driveRes.ok) {
            throw new Error(`Failed to fetch file stream from Google Drive: ${await driveRes.text()}`);
          }

          if (!driveRes.body) {
            throw new Error("Google Drive response body is empty.");
          }

          // Upload stream to S3
          const s3Key = `vidshort/uploads/${videoId}.mp4`;
          const s3Url = await uploadStreamToS3(
            driveRes.body,
            s3Key,
            "video/mp4",
            video.fileSize || 0
          );

          // Update database with the new S3 URL
          await db
            .update(videos)
            .set({
              videoUrl: s3Url,
              updatedAt: new Date(),
            })
            .where(eq(videos.id, videoId));
        }
      });

      // 2. Transcribe Video using Deepgram
      const transcriptData = await step.run("transcribe-video", async () => {
        const [video] = await db
          .select()
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (!video) {
          throw new Error(`Video record not found for ID: ${videoId}`);
        }

        const deepgramKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramKey || deepgramKey.includes("placeholder") || deepgramKey.startsWith("your_")) {
          throw new Error("DEEPGRAM_API_KEY is not configured properly in environmental variables.");
        }

        // Generate a temporary signed S3 URL for Deepgram to access safely
        const transcriptionUrl = await getPlayableUrl(video.videoUrl);

        const response = await fetch(
          "https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true&model=nova-2&detect_language=true",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${deepgramKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: transcriptionUrl }),
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Deepgram transcription failed: ${errText}`);
        }

        return await response.json();
      });

      // Save transcript back to database
      await step.run("save-transcript", async () => {
        await db
          .update(videos)
          .set({
            transcript: transcriptData,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      });

      // Get the video details to check duration and gdrive source
      const [videoInfo] = await db
        .select()
        .from(videos)
        .where(eq(videos.id, videoId))
        .limit(1);

      if (!videoInfo) {
        throw new Error(`Video record not found for ID: ${videoId}`);
      }

      const videoDuration = videoInfo.duration && videoInfo.duration > 0 ? videoInfo.duration : 900;

      // 2.5 Revoke temporary Google Drive permissions
      if (videoInfo.sourceType === "gdrive" && videoInfo.gdriveFileId) {
        await step.run("cleanup-gdrive-permissions", async () => {
          const [conn] = await db
            .select()
            .from(socialConnections)
            .where(
              and(
                eq(socialConnections.userId, userId),
                eq(socialConnections.platform, "gdrive")
              )
            )
            .limit(1);

          if (conn && conn.refreshToken) {
            try {
              const clientId = process.env.YOUTUBE_CLIENT_ID;
              const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
              let rawRefreshToken = conn.refreshToken;
              if (rawRefreshToken && (rawRefreshToken.startsWith("v1:") || rawRefreshToken.includes(":"))) {
                rawRefreshToken = decrypt(rawRefreshToken);
              }
              const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                  client_id: clientId!,
                  client_secret: clientSecret!,
                  refresh_token: rawRefreshToken,
                  grant_type: "refresh_token",
                }),
              });
              if (refreshResponse.ok) {
                const refreshData = await refreshResponse.json();
                const accessToken = refreshData.access_token;

                const fileId = videoInfo.gdriveFileId;
                const listPermResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,type,role)`, {
                  headers: { Authorization: `Bearer ${accessToken}` }
                });

                if (listPermResponse.ok) {
                  const listData = await listPermResponse.json();
                  const permissions = listData.permissions || [];
                  const anyonePerm = permissions.find(
                    (p: { id?: string; type?: string; role?: string }) =>
                      p.type === "anyone" && p.role === "reader"
                  );

                  if (anyonePerm && anyonePerm.id) {
                    const delResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${anyonePerm.id}`, {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${accessToken}` }
                    });
                    if (delResponse.ok) {
                      console.log("Successfully revoked temporary Google Drive public permission.");
                    } else {
                      console.error("Failed to revoke public permission:", await delResponse.text());
                    }
                  }
                }
              }
            } catch (err) {
              console.error("Error during temporary Google Drive permissions cleanup:", err);
            }
          }
        });
      }

      const CHUNK_DURATION = 15 * 60; // 15 minutes in seconds
      const numChunks = Math.ceil(videoDuration / CHUNK_DURATION);

      for (let chunkIdx = 0; chunkIdx < numChunks; chunkIdx++) {
        const chunkStart = chunkIdx * CHUNK_DURATION;
        const chunkEnd = Math.min((chunkIdx + 1) * CHUNK_DURATION, videoDuration);

        // 3. Extract Clips with Gemini for this chunk
        const suggestedClips = await step.run(`extract-clips-with-gemini-chunk-${chunkIdx}`, async () => {
          const geminiKey = process.env.GEMINI_API_KEY;
          if (!geminiKey || geminiKey.includes("placeholder") || geminiKey.startsWith("your_")) {
            throw new Error("GEMINI_API_KEY is not configured properly.");
          }

          const alternatives = transcriptData.results?.channels?.[0]?.alternatives?.[0];
          const words = alternatives?.words || [];
          const fullText = alternatives?.transcript || "";

          // Filter words that belong to this chunk's timeline
          const chunkWords = (words as TranscriptWord[]).filter((w: TranscriptWord) => w.start >= chunkStart && w.start <= chunkEnd);

          let formattedTranscript = "";
          if (chunkWords.length > 0) {
            formattedTranscript = (chunkWords as Array<{ start: number; end: number; word: string }>)
              .map((w) => `[${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s]: ${w.word}`)
              .join(" ");
          } else {
            formattedTranscript = fullText;
          }

          const prompt = `
You are an expert AI video editor. I will provide you with the transcript of a segment of a long-form video (specifically from ${chunkStart}s to ${chunkEnd}s of the video), annotated with timestamps for each word.
Your goal is to identify the top 1-2 highly engaging, contextually complete, and viral clips from this transcript that are suitable for social media (TikTok, YouTube Shorts, Reels).

Guidelines:
1. Each clip must have a strong hook (compelling first few words).
2. Each clip must range from 15 seconds to 90 seconds.
3. The start and end times must align precisely with the word timestamps in the transcript.
4. Keep the clips contextually complete (don't cut off mid-thought).
5. Language optimization: Detect the primary language spoken in the transcript. If the transcript is in Hindi (whether written in Devanagari script or romanized Hinglish/Latin characters like "aaj hum baat karenge"), you MUST write the output fields 'title', 'description', 'reason', 'hookText', and 'captionText' in Hindi (using Devanagari script). If it is in another language, write those fields in that respective language. Otherwise, default to English.

Transcript for this segment:
---
${formattedTranscript.substring(0, 40000)}
---

You MUST reply strictly with a JSON array (no markdown block wrapper, just raw JSON) conforming to this TypeScript type:
Array<{
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  confidenceScore: number; // A float between 0.00 and 1.00 indicating virality strength
  reason: string; // engagement reason explanation
  seoScore: number; // AI-predicted virality score (integer between 0 and 100)
  hookText: string; // The opening hook sentence of the clip
  captionText: string; // Suggested social media caption
  hashtags: string[]; // Suggested hashtags as a string array
}>
`;

          const jsonText = await callGemini(prompt, geminiKey);
          const parsed = JSON.parse(jsonText) as SuggestedClip[];

          if (!Array.isArray(parsed)) {
            throw new Error("Gemini response is not a valid JSON array.");
          }

          return parsed;
        });

        // 4. Save suggested clips to DB & update total count
        await step.run(`save-clips-to-db-chunk-${chunkIdx}`, async () => {
          for (const c of suggestedClips) {
            await db.insert(clips).values({
              videoId: videoId,
              title: c.title,
              description: c.description || c.hookText || c.hook || null,
              startTime: c.startTime,
              endTime: c.endTime,
              confidenceScore: c.confidenceScore || 0.8,
              renderStatus: "not_started",
              subtitleStyle: {
                fontFamily: "Inter",
                fontSize: 80,
                captionColor: "#ffffff",
                highlightColor: "#fbbf24",
                textPosition: "bottom",
                backgroundStyle: "box",
                emphasisAnimation: "pop",
                layoutType: "fit_black",
                layoutTitleText: c.title,
                isMirrored: false,
                playbackSpeed: 1.02,
              },
              seoScore: c.seoScore ?? (c.confidenceScore ? Math.round(c.confidenceScore * 100) : 80),
              hookText: c.hookText || c.hook || null,
              captionText: c.captionText || null,
              hashtags: c.hashtags || null,
              reason: c.reason || null,
            });
          }

          const [run] = await db
            .select()
            .from(pipelineRuns)
            .where(eq(pipelineRuns.id, pipelineRunId))
            .limit(1);

          await db
            .update(pipelineRuns)
            .set({
              totalClips: (run?.totalClips || 0) + suggestedClips.length,
              status: "rendering",
              updatedAt: new Date(),
            })
            .where(eq(pipelineRuns.id, pipelineRunId));
        });

        // 5. Fetch clips list in this chunk range
        const chunkClips = await step.run(`fetch-clips-list-chunk-${chunkIdx}`, async () => {
          return await db
            .select({ id: clips.id, title: clips.title })
            .from(clips)
            .where(
              and(
                eq(clips.videoId, videoId),
                gte(clips.startTime, chunkStart),
                lte(clips.startTime, chunkEnd)
              )
            )
            .orderBy(asc(clips.startTime));
        });

        const totalChunkClips = chunkClips.length;

        // 6. Sequential Loop: Render -> Metadata -> Upload -> Delete S3 -> Sleep 1m
        for (let i = 0; i < totalChunkClips; i++) {
          const currentClipId = chunkClips[i].id;

          // First, mark the clip as rendering
          await step.run(`mark-rendering-chunk-${chunkIdx}-clip-${i}`, async () => {
            await db
              .update(clips)
              .set({
                renderStatus: "rendering",
                updatedAt: new Date(),
              })
              .where(eq(clips.id, currentClipId));
          });

          // Trigger the render on AWS Lambda as a single discrete step
          const renderResult = await step.run(`trigger-lambda-render-chunk-${chunkIdx}-clip-${i}`, async () => {
            const [clip] = await db
              .select()
              .from(clips)
              .where(eq(clips.id, currentClipId))
              .limit(1);

            const [video] = await db
              .select()
              .from(videos)
              .where(eq(videos.id, videoId))
              .limit(1);

            const awsKey = process.env.REMOTION_AWS_ACCESS_KEY_ID;
            const awsSecret = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
            const awsRegion = (process.env.REMOTION_AWS_REGION || "us-east-1") as AwsRegion;
            const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
            const serveUrl = process.env.REMOTION_SERVE_URL || process.env.REMOTION_S3_SITE_NAME;

            const isConfigMissing =
              !awsKey ||
              awsKey.includes("placeholder") ||
              !awsSecret ||
              awsSecret.includes("placeholder") ||
              !functionName ||
              functionName.includes("placeholder") ||
              !serveUrl;

            if (isConfigMissing) {
              throw new Error("Remotion Lambda AWS settings are not configured. Please check .env.local.");
            }

            const fps = 30;
            const startFrame = Math.round(clip.startTime * fps);
            const endFrame = Math.round(clip.endTime * fps);

            const transData = video.transcript as unknown as TranscriptPayload | null;
            const alternatives = transData?.results?.channels?.[0]?.alternatives?.[0];
            const allWords = alternatives?.words || [];
            const clipWords = allWords.filter(
              (w) => w.start >= clip.startTime && w.start <= clip.endTime
            );

            let styleConfig = (clip.subtitleStyle as StyleConfig | null);
            if (!styleConfig) {
              styleConfig = {
                fontFamily: "Inter",
                fontSize: 80,
                captionColor: "#ffffff",
                highlightColor: "#fbbf24",
                textPosition: "bottom",
                backgroundStyle: "box",
                emphasisAnimation: "pop",
                layoutType: "fit_black",
                layoutTitleText: clip.title,
                isMirrored: false,
                playbackSpeed: 1.02,
              };
            } else if (styleConfig.layoutTitleText === undefined || styleConfig.layoutTitleText === "wait for end") {
              styleConfig = {
                ...styleConfig,
                layoutTitleText: clip.title,
              };
            }

            const speed = styleConfig.playbackSpeed || 1.0;
            const inputProps = {
              videoUrl: video.videoUrl,
              startFrame,
              endFrame,
              transcriptSegments: clipWords,
              styleConfig,
            };

            const durationInFrames = Math.max(30, Math.round((endFrame - startFrame) / speed));

            const concurrencyEnv = process.env.REMOTION_CONCURRENCY
              ? parseInt(process.env.REMOTION_CONCURRENCY, 10)
              : undefined;
            const framesPerLambdaEnv = process.env.REMOTION_FRAMES_PER_LAMBDA
              ? parseInt(process.env.REMOTION_FRAMES_PER_LAMBDA, 10)
              : undefined;

            let concurrencyOption: number | undefined = undefined;
            let framesPerLambdaOption: number | undefined = undefined;

            if (framesPerLambdaEnv !== undefined) {
              framesPerLambdaOption = framesPerLambdaEnv;
            } else if (concurrencyEnv !== undefined) {
              concurrencyOption = concurrencyEnv;
            } else {
              concurrencyOption = 1;
            }

            const result = await renderMediaOnLambda({
              functionName: functionName!,
              region: awsRegion,
              serveUrl: serveUrl!,
              composition: "ClipComposition",
              inputProps,
              codec: "h264",
              privacy: "public",
              forceDurationInFrames: durationInFrames,
              ...(concurrencyOption !== undefined ? { concurrency: concurrencyOption } : {}),
              ...(framesPerLambdaOption !== undefined ? { framesPerLambda: framesPerLambdaOption } : {}),
            });

            return {
              renderId: result.renderId,
              bucketName: result.bucketName,
              awsRegion,
              functionName: functionName!
            };
          });

          // Poll progress outside step.run using Inngest step.sleep to prevent Vercel execution timeouts
          let isDone = false;
          let attempts = 0;
          const maxAttempts = 180;

          while (!isDone && attempts < maxAttempts) {
            attempts++;

            const progress = await step.run(`check-progress-clip-chunk-${chunkIdx}-clip-${i}-attempt-${attempts}`, async () => {
              return await getRenderProgress({
                renderId: renderResult.renderId,
                bucketName: renderResult.bucketName,
                functionName: renderResult.functionName,
                region: renderResult.awsRegion as AwsRegion,
              });
            });

            if (progress.fatalErrorEncountered) {
              throw new Error(`AWS Lambda render encountered a fatal error: ${JSON.stringify(progress.errors)}`);
            }

            if (progress.done) {
              isDone = true;

              await step.run(`save-render-url-chunk-${chunkIdx}-clip-${i}`, async () => {
                const s3Url = progress.outputFile;
                if (!s3Url) {
                  throw new Error("AWS Lambda render completed, but outputFile was not returned.");
                }

                await db
                  .update(clips)
                  .set({
                    clipUrl: s3Url,
                    renderStatus: "completed",
                    updatedAt: new Date(),
                  })
                  .where(eq(clips.id, currentClipId));
              });
            } else {
              await step.sleep(`sleep-render-chunk-${chunkIdx}-clip-${i}-attempt-${attempts}`, "15s");
            }
          }

          if (!isDone) {
            throw new Error(`AWS Lambda render timed out after ${maxAttempts} attempts.`);
          }

          // Metadata step
          const metadata = await step.run(`generate-metadata-chunk-${chunkIdx}-clip-${i}`, async () => {
            const [clip] = await db
              .select()
              .from(clips)
              .where(eq(clips.id, currentClipId))
              .limit(1);

            const geminiKey = process.env.GEMINI_API_KEY;
            if (!geminiKey) {
              return {
                youtubeTitle: clip.title,
                youtubeDescription: clip.description || "",
                youtubeTags: [],
              };
            }

            const prompt = `
Generate optimized metadata for a YouTube Shorts/TikTok video.
Title: ${clip.title}
Reason for engagement: ${clip.reason}
Caption: ${clip.captionText}

Reply strictly with a JSON object:
{
  "youtubeTitle": "optimized title (max 50 chars, no hashtags)",
  "youtubeDescription": "optimized description with search keywords and hashtags",
  "youtubeTags": ["tag1", "tag2", "tag3"]
}
`;

            const jsonText = await callGemini(prompt, geminiKey);
            const parsed = JSON.parse(jsonText) as {
              youtubeTitle: string;
              youtubeDescription: string;
              youtubeTags: string[];
            };

            await db
              .update(clips)
              .set({
                youtubeTitle: parsed.youtubeTitle,
                youtubeDescription: parsed.youtubeDescription,
                youtubeTags: parsed.youtubeTags,
                updatedAt: new Date(),
              })
              .where(eq(clips.id, currentClipId));

            return parsed;
          });

          // Publish to YouTube
          await step.run(`publish-to-youtube-chunk-${chunkIdx}-clip-${i}`, async () => {
            const [clip] = await db
              .select()
              .from(clips)
              .where(eq(clips.id, currentClipId))
              .limit(1);

            if (!clip.clipUrl) {
              throw new Error(`Clip does not have a rendered URL: ${currentClipId}`);
            }

            // Retrieve user's YouTube connection linked via Zernio OAuth
            const [youtubeConn] = await db
              .select()
              .from(socialConnections)
              .where(
                and(
                  eq(socialConnections.userId, userId),
                  eq(socialConnections.platform, "youtube")
                )
              )
              .limit(1);

            if (!youtubeConn || !youtubeConn.externalAccountId) {
              throw new Error(`User does not have a linked YouTube channel on Zernio. Please link it in Settings.`);
            }

            let youtubeVideoId: string | null = null;
            let zernioError: unknown = null;

            try {
              // Submit post to Zernio API for YouTube
              const zernioResult = await publishToZernio({
                title: metadata.youtubeTitle || clip.title,
                content: metadata.youtubeDescription || clip.description || "",
                mediaItems: [
                  {
                    type: "video",
                    url: clip.clipUrl,
                  }
                ],
                platforms: [
                  {
                    platform: "youtube",
                    accountId: youtubeConn.externalAccountId,
                  }
                ],
                publishNow: true,
              }) as { id?: string } | undefined;

              youtubeVideoId = zernioResult?.id || "zernio_published";
            } catch (err) {
              zernioError = err;
              console.error("Zernio YouTube publish failed. Attempting direct upload fallback...", err);
            }

            if (!youtubeVideoId) {
              // Retrieve direct YouTube refresh token for direct upload fallback
              const [user] = await db
                .select({ youtubeRefreshToken: users.youtubeRefreshToken })
                .from(users)
                .where(eq(users.id, userId))
                .limit(1);

              const directRefreshToken = user?.youtubeRefreshToken || youtubeConn?.refreshToken;

              if (!directRefreshToken) {
                throw new Error(
                  `YouTube upload failed. Zernio error: ${
                    zernioError instanceof Error ? zernioError.message : String(zernioError)
                  }. Direct upload fallback failed: No direct YouTube refresh token found.`
                );
              }

              try {
                const directId = await uploadVideoToYouTube({
                  s3Url: clip.clipUrl,
                  title: metadata.youtubeTitle || clip.title,
                  description: metadata.youtubeDescription || clip.description || "",
                  tags: metadata.youtubeTags || [],
                  refreshToken: directRefreshToken,
                });
                youtubeVideoId = directId;
                console.log(`Direct YouTube upload fallback succeeded. Video ID: ${youtubeVideoId}`);
              } catch (fallbackErr) {
                console.error("Direct YouTube upload fallback failed:", fallbackErr);
                throw new Error(
                  `YouTube upload failed. Zernio error: ${
                    zernioError instanceof Error ? zernioError.message : String(zernioError)
                  }. Direct upload fallback error: ${
                    fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
                  }`
                );
              }
            }

            await db
              .update(clips)
              .set({
                youtubeVideoId,
                youtubePublishedAt: new Date(),
                updatedAt: new Date(),
              })
              .where(eq(clips.id, currentClipId));

            // Increment published clips count in pipeline run
            const [run] = await db
              .select()
              .from(pipelineRuns)
              .where(eq(pipelineRuns.id, pipelineRunId))
              .limit(1);

            await db
              .update(pipelineRuns)
              .set({
                publishedClips: (run?.publishedClips || 0) + 1,
                status: "publishing",
                updatedAt: new Date(),
              })
              .where(eq(pipelineRuns.id, pipelineRunId));
          });

          // Delete S3 clip
          await step.run(`delete-s3-clip-chunk-${chunkIdx}-clip-${i}`, async () => {
            const [clip] = await db
              .select()
              .from(clips)
              .where(eq(clips.id, currentClipId))
              .limit(1);

            if (clip.clipUrl) {
              await deleteFileFromS3(clip.clipUrl);
              await db
                .update(clips)
                .set({
                  s3Deleted: true,
                  updatedAt: new Date(),
                })
                .where(eq(clips.id, currentClipId));
            }
          });

          // Sleep before the next clip (except the last one)
          if (i < totalChunkClips - 1) {
            await step.sleep(`sleep-before-next-chunk-${chunkIdx}-clip-${i}`, "1m");
          }
        }

        // Sleep before the next chunk (except the last one)
        if (chunkIdx < numChunks - 1) {
          await step.sleep(`sleep-before-next-chunk-${chunkIdx}`, "1m");
        }
      }

      // 7. Send Completion Email
      await step.run("send-completion-email", async () => {
        const [userRec] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!userRec) {
          throw new Error(`User not found: ${userId}`);
        }

        const publishedClips = await db
          .select({
            title: clips.title,
            youtubeVideoId: clips.youtubeVideoId,
          })
          .from(clips)
          .where(eq(clips.videoId, videoId))
          .orderBy(asc(clips.startTime));

        await sendCompletionEmail({
          to: "nandutomar0000@gmail.com",
          clips: publishedClips,
        });

        await db
          .update(pipelineRuns)
          .set({
            completionEmailSent: true,
            updatedAt: new Date(),
          })
          .where(eq(pipelineRuns.id, pipelineRunId));
      });

      // 8. Finalize Pipeline & Video Status
      await step.run("finalize-pipeline", async () => {
        try {
          const [videoRecord] = await db
            .select()
            .from(videos)
            .where(eq(videos.id, videoId))
            .limit(1);

          if (videoRecord && videoRecord.cloudinaryAssetId) {
            console.log(`Destroying Cloudinary asset to free space: ${videoRecord.cloudinaryAssetId}`);
            cloudinary.config({
              cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
              api_key: process.env.CLOUDINARY_API_KEY,
              api_secret: process.env.CLOUDINARY_API_SECRET,
            });
            const destroyRes = await cloudinary.uploader.destroy(videoRecord.cloudinaryAssetId, {
              resource_type: 'video',
            });
            console.log('Cloudinary destroy result:', destroyRes);
          }
        } catch (cloudinaryErr) {
          console.error('Failed to delete video from Cloudinary:', cloudinaryErr);
        }

        await db
          .update(pipelineRuns)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(pipelineRuns.id, pipelineRunId));

        await db
          .update(videos)
          .set({
            status: "completed",
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      });

      return { success: true };
    } catch (error) {
      console.error("Auto-Pipeline workflow failed:", error);
      const errMsg = error instanceof Error ? error.message : "Unknown error in auto-pipeline";

      // Try to clean up Cloudinary video if we failed
      try {
        const [videoRecord] = await db
          .select()
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);
        if (videoRecord && videoRecord.cloudinaryAssetId) {
          console.log(`Pipeline failed. Cleaning up Cloudinary asset to free space: ${videoRecord.cloudinaryAssetId}`);
          cloudinary.config({
            cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
          });
          await cloudinary.uploader.destroy(videoRecord.cloudinaryAssetId, {
            resource_type: 'video',
          });
        }
      } catch (cleanupErr) {
        console.error("Failed to clean up Cloudinary asset after failure:", cleanupErr);
      }

      // Try to clean up temporary Google Drive permissions if we failed
      try {
        const [videoRecord] = await db
          .select()
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (videoRecord && videoRecord.sourceType === "gdrive" && videoRecord.gdriveFileId) {
          const [conn] = await db
            .select()
            .from(socialConnections)
            .where(
              and(
                eq(socialConnections.userId, userId),
                eq(socialConnections.platform, "gdrive")
              )
            )
            .limit(1);

          if (conn && conn.refreshToken) {
            const clientId = process.env.YOUTUBE_CLIENT_ID;
            const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
            let rawRefreshToken = conn.refreshToken;
            if (rawRefreshToken && (rawRefreshToken.startsWith("v1:") || rawRefreshToken.includes(":"))) {
              rawRefreshToken = decrypt(rawRefreshToken);
            }
            const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                client_id: clientId!,
                client_secret: clientSecret!,
                refresh_token: rawRefreshToken,
                grant_type: "refresh_token",
              }),
            });
            if (refreshResponse.ok) {
              const refreshData = await refreshResponse.json();
              const accessToken = refreshData.access_token;
              const fileId = videoRecord.gdriveFileId;
              const listPermResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions?fields=permissions(id,type,role)`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });

              if (listPermResponse.ok) {
                const listData = await listPermResponse.json();
                const permissions = listData.permissions || [];
                const anyonePerm = permissions.find(
                  (p: { id?: string; type?: string; role?: string }) =>
                    p.type === "anyone" && p.role === "reader"
                );

                if (anyonePerm && anyonePerm.id) {
                  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions/${anyonePerm.id}`, {
                    method: "DELETE",
                    headers: { Authorization: `Bearer ${accessToken}` }
                  });
                  console.log("Successfully revoked temporary Google Drive public permission in catch block.");
                }
              }
            }
          }
        }
      } catch (gdriveCleanupErr) {
        console.error("Failed to clean up Google Drive permissions after failure:", gdriveCleanupErr);
      }

      await db
        .update(pipelineRuns)
        .set({
          status: "failed",
          errorMessage: errMsg,
          updatedAt: new Date(),
        })
        .where(eq(pipelineRuns.id, pipelineRunId));

      await db
        .update(videos)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(videos.id, videoId));

      // Send pipeline failure email notification
      try {
        const [userRec] = await db
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        const userEmail = userRec?.email || "nandutomar0000@gmail.com";

        const [videoRec] = await db
          .select({ title: videos.title })
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        const videoTitle = videoRec?.title || "Unknown Video";

        const recipients = Array.from(new Set([userEmail, "nandutomar0000@gmail.com"]));
        for (const recipient of recipients) {
          await sendFailureEmail({
            to: recipient,
            videoTitle,
            error: errMsg,
            pipelineRunId,
          });
        }
      } catch (emailErr) {
        console.error("Failed to send failure email notifications:", emailErr);
      }

      throw error;
    }
  }
);
