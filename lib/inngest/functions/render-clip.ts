import { inngest } from "../client";
import { db } from "@/lib/db";
import { videos, clips } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { renderMediaOnLambda, getRenderProgress, AwsRegion } from "@remotion/lambda";
import { StyleConfig } from "@/components/remotion/ClipComposition";

interface EventData {
  clipId: string;
  userId: string;
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

/**
 * Inngest background function to render video clips using Remotion.
 * When AWS credentials or Remotion Lambda variables are not set or are mock,
 * it runs a detailed simulation that updates database progress to support development testing.
 */
export const renderClip = inngest.createFunction(
  { 
    id: "render-clip", 
    name: "Render Clip",
    triggers: [{ event: "vidshort/render.start" }],
    retries: 1,
  },
  async ({ event, step }) => {
    const { clipId } = event.data as EventData;

    try {
      // 1. Update Clip Status to rendering
      await step.run("update-clip-rendering", async () => {
        await db
          .update(clips)
          .set({
            renderStatus: "rendering",
            updatedAt: new Date(),
          })
          .where(eq(clips.id, clipId));
      });

      // 2. Fetch Clip and Parent Video details
      const { clip, video } = await step.run("fetch-clip-and-video", async () => {
        const [clipRec] = await db
          .select()
          .from(clips)
          .where(eq(clips.id, clipId))
          .limit(1);

        if (!clipRec) {
          throw new Error(`Clip not found: ${clipId}`);
        }

        const [videoRec] = await db
          .select()
          .from(videos)
          .where(eq(videos.id, clipRec.videoId))
          .limit(1);

        if (!videoRec) {
          throw new Error(`Parent video not found for clip: ${clipId}`);
        }

        return { clip: clipRec, video: videoRec };
      });

      // Check if Lambda environment variables are configured
      const awsKey = process.env.REMOTION_AWS_ACCESS_KEY_ID;
      const awsSecret = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;
      const awsRegion = (process.env.REMOTION_AWS_REGION || "us-east-1") as AwsRegion;
      const functionName = process.env.REMOTION_LAMBDA_FUNCTION_NAME;
      const serveUrl = process.env.REMOTION_SERVE_URL || process.env.REMOTION_S3_SITE_NAME;

      const isConfigMissing =
        !awsKey ||
        awsKey.includes("placeholder") ||
        awsKey.startsWith("your_") ||
        !awsSecret ||
        awsSecret.includes("placeholder") ||
        !functionName ||
        functionName.includes("placeholder") ||
        !serveUrl;

      if (isConfigMissing) {
        throw new Error("Remotion Lambda AWS credentials or site settings are missing or contain placeholder values. Please check your .env.local file.");
      }

      // --- REMOTION LAMBDA PRODUCTION MODE ---
      
      // Calculate start and end frames at 30 fps
      const fps = 30;
      const startFrame = Math.round(clip.startTime * fps);
      const endFrame = Math.round(clip.endTime * fps);

      // Parse Deepgram transcripts into segments
      const transcriptData = video.transcript as unknown as TranscriptPayload | null;
      const alternatives = transcriptData?.results?.channels?.[0]?.alternatives?.[0];
      const allWords = alternatives?.words || [];
      const clipWords = allWords.filter(
        (w) => w.start >= clip.startTime && w.start <= clip.endTime
      );

      const styleConfig = (clip.subtitleStyle as StyleConfig) || {
        fontFamily: "Inter",
        fontSize: 20,
        captionColor: "#ffffff",
        highlightColor: "#fbbf24",
        textPosition: "bottom",
        backgroundStyle: "box",
        emphasisAnimation: "pop",
        layoutType: "crop",
        layoutTitleText: "",
        isMirrored: false,
        playbackSpeed: 1.0,
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

       // Concurrency settings to handle AWS account rate limits
      const concurrencyEnv = process.env.REMOTION_CONCURRENCY
        ? parseInt(process.env.REMOTION_CONCURRENCY, 10)
        : undefined;
      const framesPerLambdaEnv = process.env.REMOTION_FRAMES_PER_LAMBDA
        ? parseInt(process.env.REMOTION_FRAMES_PER_LAMBDA, 10)
        : undefined;

      // Determine concurrency config parameter to pass
      let concurrencyOption: number | undefined = undefined;
      let framesPerLambdaOption: number | undefined = undefined;

      if (framesPerLambdaEnv !== undefined) {
        framesPerLambdaOption = framesPerLambdaEnv;
      } else if (concurrencyEnv !== undefined) {
        concurrencyOption = concurrencyEnv;
      } else {
        // Default to a concurrency limit of 1 (sequential rendering) to completely avoid AWS "Rate Exceeded"
        // errors on restricted or new AWS accounts, while leveraging fast optimized chunk rendering.
        concurrencyOption = 1;
      }

      // Trigger the Remotion Lambda rendering task
      const { renderId, bucketName } = await step.run("trigger-lambda-render", async () => {
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

        return { renderId: result.renderId, bucketName: result.bucketName };
      });

      // Poll Lambda until completed or failed using Inngest step.sleep to prevent Vercel Function timeouts
      let isDone = false;
      let attempts = 0;
      const maxAttempts = 180; // 15 minutes max (180 attempts * 5s = 900s)

      while (!isDone && attempts < maxAttempts) {
        attempts++;
        
        const progress = await step.run(`check-progress-${attempts}`, async () => {
          return await getRenderProgress({
            renderId,
            bucketName,
            functionName: functionName!,
            region: awsRegion,
          });
        });

        if (progress.fatalErrorEncountered) {
          throw new Error(`Fatal rendering error: ${progress.errors.map(e => e.message).join(", ")}`);
        }

        if (progress.done) {
          isDone = true;
          
          if (progress.outputFile) {
            await step.run("save-clip-url", async () => {
              await db
                .update(clips)
                .set({
                  clipUrl: progress.outputFile,
                  renderStatus: "completed",
                  updatedAt: new Date(),
                })
                .where(eq(clips.id, clipId));
            });
          } else {
            throw new Error("Lambda render completed but returned no output URL");
          }
        } else {
          // Use Inngest native sleep to suspend execution and avoid Vercel timeouts
          await step.sleep(`wait-5s-${attempts}`, "5s");
        }
      }

      if (!isDone) {
        throw new Error("Rendering timed out on Remotion Lambda after 15 minutes.");
      }

      return { success: true };
    } catch (error) {
      console.error("Clip rendering failed:", error);

      // Register render failure in DB
      await db
        .update(clips)
        .set({
          renderStatus: "failed",
          updatedAt: new Date(),
        })
        .where(eq(clips.id, clipId));

      throw error; // Re-throw so Inngest marks run as failed
    }
  }
);
