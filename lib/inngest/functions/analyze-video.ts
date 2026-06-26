import { inngest } from "../client";
import { db } from "@/lib/db";
import { videos, analysisJobs, clips } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

interface EventData {
  videoId: string;
  userId: string;
  analysisJobId: string;
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
  hook?: string; // fallback
  captionText?: string;
  hashtags?: string[];
}

/**
 * Inngest function to run the background video analysis pipeline.
 * Performs transcribing (Deepgram) and AI moments extraction (Gemini).
 */
export const analyzeVideo = inngest.createFunction(
  { 
    id: "analyze-video", 
    name: "Analyze Video",
    triggers: [{ event: "vidshort/analysis.start" }],
    retries: 1,
  },
  async ({ event, step }) => {
    const { videoId, analysisJobId } = event.data as EventData;

    try {
      // Step 1: Update AnalysisJob status to processing
      await step.run("update-job-processing", async () => {
        await db
          .update(analysisJobs)
          .set({ 
            status: "processing", 
            updatedAt: new Date() 
          })
          .where(eq(analysisJobs.id, analysisJobId));
      });

      // Step 2: Transcribe video using Deepgram
      const transcriptData = await step.run("transcribe-video-audio", async () => {
        const [video] = await db
          .select()
          .from(videos)
          .where(eq(videos.id, videoId))
          .limit(1);

        if (!video) {
          throw new Error(`Video not found: ${videoId}`);
        }

        const deepgramKey = process.env.DEEPGRAM_API_KEY;
        if (!deepgramKey || deepgramKey.includes("placeholder") || deepgramKey.startsWith("your_")) {
          throw new Error("DEEPGRAM_API_KEY is not set or contains placeholder values. Please check your .env.local file.");
        }

        const response = await fetch("https://api.deepgram.com/v1/listen?smart_format=true&punctuate=true&model=nova-2&detect_language=true", {
          method: "POST",
          headers: {
            Authorization: `Token ${deepgramKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: video.videoUrl }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Deepgram transcription failed: ${errText}`);
        }

        return await response.json();
      });

      // Step 2.5: Save transcript data into the video record
      await step.run("save-transcript-to-video", async () => {
        await db
          .update(videos)
          .set({
            transcript: transcriptData,
            updatedAt: new Date(),
          })
          .where(eq(videos.id, videoId));
      });

      // Step 3: Run Gemini to detect top viral moments
      const suggestedClips = await step.run("pick-moments-with-gemini", async () => {
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey || geminiKey.includes("placeholder") || geminiKey.startsWith("your_")) {
          throw new Error("GEMINI_API_KEY is not set or contains placeholder values. Please check your .env.local file.");
        }

        // Prepare transcript format with timestamps
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
  reason: string; // Gemini's engagement reason explanation
  seoScore: number; // AI-predicted virality score (integer between 0 and 100)
  hookText: string; // The opening hook sentence of the clip
  captionText: string; // Suggested social media caption
  hashtags: string[]; // Suggested hashtags as a string array
}>
\`\`\`
`;

        let response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
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
          console.warn("Gemini 2.5 Flash call failed or was rate-limited. Trying fallback to gemini-2.0-flash...");
          response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
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

        const parsed = JSON.parse(jsonText.trim());
        if (!Array.isArray(parsed)) {
          throw new Error("Gemini did not return a valid array of clips");
        }

        // Validate structure
        for (const clipItem of parsed) {
          if (
            !clipItem.title ||
            typeof clipItem.startTime !== "number" ||
            typeof clipItem.endTime !== "number"
          ) {
            throw new Error("Clip item lacks required title, startTime, or endTime parameters");
          }
        }

        return parsed as SuggestedClip[];
      });

      // Step 4: Save suggested clips to DB
      await step.run("save-clips-to-database", async () => {
        for (const c of suggestedClips) {
          await db.insert(clips).values({
            videoId: videoId,
            title: c.title,
            description: c.description || c.hookText || c.hook || null,
            startTime: c.startTime,
            endTime: c.endTime,
            confidenceScore: c.confidenceScore || 0.8,
            renderStatus: "not_started",
            subtitleStyle: null,
            seoScore: c.seoScore ?? (c.confidenceScore ? Math.round(c.confidenceScore * 100) : 80),
            hookText: c.hookText || c.hook || null,
            captionText: c.captionText || null,
            hashtags: c.hashtags || null,
            reason: c.reason || null,
          });
        }
      });

      // Step 5: Update AnalysisJob status to completed, update video status to ready
      await step.run("update-job-completed", async () => {
        await db
          .update(analysisJobs)
          .set({ 
            status: "completed", 
            updatedAt: new Date() 
          })
          .where(eq(analysisJobs.id, analysisJobId));

        await db
          .update(videos)
          .set({
            status: "ready",
            updatedAt: new Date()
          })
          .where(eq(videos.id, videoId));
      });

      return { success: true };
    } catch (error) {
      console.error("Analysis pipeline failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error during background processing";
      
      // On error, register job failure in DB
      await db
        .update(analysisJobs)
        .set({
          status: "failed",
          error: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(analysisJobs.id, analysisJobId));

      await db
        .update(videos)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(videos.id, videoId));

      throw error; // Re-throw so Inngest registers the failure
    }
  }
);

// MOCK DATA GENERATORS FOR SAFE DEVS/TESTS

