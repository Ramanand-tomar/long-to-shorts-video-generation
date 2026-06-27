import { inngest } from "../client";
import { db } from "@/lib/db";
import { videos, clips, pipelineRuns, users, socialConnections } from "@/lib/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { renderMediaOnLambda, getRenderProgress, AwsRegion } from "@remotion/lambda";
import { publishToZernio } from "@/lib/zernio";
import { deleteFileFromS3 } from "@/lib/s3";
import { sendCompletionEmail } from "@/lib/email";
import { StyleConfig } from "@/components/remotion/ClipComposition";

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

        const response = await fetch(
          "https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true&model=nova-2&detect_language=true",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${deepgramKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: video.videoUrl }),
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

      // 3. Extract Clips with Gemini
      const suggestedClips = await step.run("extract-clips-with-gemini", async () => {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey || geminiKey.includes("placeholder") || geminiKey.startsWith("your_")) {
          throw new Error("GEMINI_API_KEY is not configured properly.");
        }

        const alternatives = transcriptData.results?.channels?.[0]?.alternatives?.[0];
        const words = alternatives?.words || [];
        const fullText = alternatives?.transcript || "";

        let formattedTranscript = "";
        if (words.length > 0) {
          formattedTranscript = (words as Array<{ start: number; end: number; word: string }>)
            .map((w) => `[${w.start.toFixed(2)}s - ${w.end.toFixed(2)}s]: ${w.word}`)
            .join(" ");
        } else {
          formattedTranscript = fullText;
        }

        const prompt = `
You are an expert AI video editor. I will provide you with the transcript of a long-form video, annotated with timestamps for each word.
Your goal is to identify the top 4-5 highly engaging, contextually complete, and viral clips from this transcript that are suitable for social media (TikTok, YouTube Shorts, Reels).

Guidelines:
1. Each clip must have a strong hook (compelling first few words).
2. Each clip must range from 15 seconds to 90 seconds.
3. The start and end times must align precisely with the word timestamps in the transcript.
4. Keep the clips contextually complete (don't cut off mid-thought).
5. Language optimization: Detect the primary language spoken in the transcript. If the transcript is in Hindi (whether written in Devanagari script or romanized Hinglish/Latin characters like "aaj hum baat karenge"), you MUST write the output fields 'title', 'description', 'reason', 'hookText', and 'captionText' in Hindi (using Devanagari script). If it is in another language, write those fields in that respective language. Otherwise, default to English.

Transcript:
---
${formattedTranscript.substring(0, 40000)}
---

You MUST reply strictly with a JSON array (no markdown block wrapper, just raw JSON) conforming to this TypeScript type:
\`\`\`typescript
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
\`\`\`
`;

        const jsonText = await callGemini(prompt, geminiKey);
        const parsed = JSON.parse(jsonText) as SuggestedClip[];

        if (!Array.isArray(parsed)) {
          throw new Error("Gemini response is not a valid JSON array.");
        }

        return parsed;
      });

      // 4. Save suggested clips to DB & update total count
      await step.run("save-clips-to-db", async () => {
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
              fontSize: 20,
              captionColor: "#ffffff",
              highlightColor: "#fbbf24",
              textPosition: "bottom",
              backgroundStyle: "box",
              emphasisAnimation: "pop",
              layoutType: "fit_black",
              layoutTitleText: "wait for end",
              isMirrored: true,
              playbackSpeed: 1.02,
            },
            seoScore: c.seoScore ?? (c.confidenceScore ? Math.round(c.confidenceScore * 100) : 80),
            hookText: c.hookText || c.hook || null,
            captionText: c.captionText || null,
            hashtags: c.hashtags || null,
            reason: c.reason || null,
          });
        }

        await db
          .update(pipelineRuns)
          .set({
            totalClips: suggestedClips.length,
            status: "rendering",
            updatedAt: new Date(),
          })
          .where(eq(pipelineRuns.id, pipelineRunId));
      });

      // 5. Fetch all clips in chronological order
      const clipRecs = await step.run("fetch-clips-list", async () => {
        return await db
          .select({ id: clips.id, title: clips.title })
          .from(clips)
          .where(eq(clips.videoId, videoId))
          .orderBy(asc(clips.startTime));
      });

      const totalClips = clipRecs.length;

      // 6. Sequential Loop: Render -> Metadata -> Upload -> Delete S3 -> Sleep 1h
      for (let i = 0; i < totalClips; i++) {
        const currentClipId = clipRecs[i].id;

        // Render clip
        await step.run(`render-clip-${i}`, async () => {
          await db
            .update(clips)
            .set({
              renderStatus: "rendering",
              updatedAt: new Date(),
            })
            .where(eq(clips.id, currentClipId));

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

          const styleConfig = (clip.subtitleStyle as StyleConfig | null) || {
            fontFamily: "Inter",
            fontSize: 20,
            captionColor: "#ffffff",
            highlightColor: "#fbbf24",
            textPosition: "bottom",
            backgroundStyle: "box",
            emphasisAnimation: "pop",
            layoutType: "fit_black",
            layoutTitleText: "wait for end",
            isMirrored: true,
            playbackSpeed: 1.02,
          };

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

          // Begin Polling logic using Inngest step loops
          let isDone = false;
          let attempts = 0;
          const maxAttempts = 180;

          while (!isDone && attempts < maxAttempts) {
            attempts++;

            const progress = await getRenderProgress({
              renderId: result.renderId,
              bucketName: result.bucketName,
              functionName: functionName!,
              region: awsRegion,
            });

            if (progress.fatalErrorEncountered) {
              throw new Error(`Fatal rendering error: ${progress.errors.map((e) => e.message).join(", ")}`);
            }

            if (progress.done) {
              isDone = true;
              if (progress.outputFile) {
                await db
                  .update(clips)
                  .set({
                    clipUrl: progress.outputFile,
                    renderStatus: "completed",
                    updatedAt: new Date(),
                  })
                  .where(eq(clips.id, currentClipId));
              } else {
                throw new Error("Lambda render completed but returned no output file URL");
              }
            } else {
              // Wait 5 seconds
              await new Promise((resolve) => setTimeout(resolve, 5000));
            }
          }

          if (!isDone) {
            throw new Error("Rendering timed out on Remotion Lambda after 15 minutes.");
          }
        });

        // Generate YouTube optimized description
        const metadata = await step.run(`generate-yt-description-${i}`, async () => {
          const geminiKey = process.env.GEMINI_API_KEY;
          if (!geminiKey) {
            throw new Error("Missing GEMINI_API_KEY.");
          }

          const [clip] = await db
            .select()
            .from(clips)
            .where(eq(clips.id, currentClipId))
            .limit(1);

          const prompt = `
You are an expert social media manager. I will provide you with a short video clip's details (its hook, visual caption, and suggested hashtags).
Your task is to generate:
1. A highly engaging, click-worthy YouTube Shorts-optimized title (maximum 100 characters, including relevant hashtags if appropriate).
2. A compelling, concise YouTube Shorts description (2 to 3 sentences, incorporating relevant keywords and hashtags, maximum 500 characters).
3. A list of 10 to 15 search-optimized tags (keywords) for YouTube metadata.

Clip Details:
- Hook Text: "${clip.hookText || ""}"
- Caption Text: "${clip.captionText || ""}"
- AI Hashtags: ${JSON.stringify(clip.hashtags || [])}
- Raw Title: "${clip.title}"
- Transcript/Context Description: "${clip.description || ""}"

Language Rules:
Detect the primary language of the clip content (e.g. Hindi, Spanish, or English). You MUST generate the title and description in that same language (using Devanagari script for Hindi, Cyrillic for Russian, Latin characters for English/Spanish, etc.). The tags should be in that same language and English to maximize searchability.

You MUST reply strictly with a JSON object (no markdown code blocks, just raw JSON) conforming to this structure:
{
  "youtubeTitle": "string",
  "youtubeDescription": "string",
  "youtubeTags": ["string"]
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
        await step.run(`publish-to-youtube-${i}`, async () => {
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

          const youtubeVideoId = zernioResult?.id || "zernio_published";

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
        await step.run(`delete-s3-clip-${i}`, async () => {
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
        if (i < totalClips - 1) {
          await step.sleep(`sleep-before-next-${i}`, "1h");
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
          to: userRec.email,
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

      throw error;
    }
  }
);
