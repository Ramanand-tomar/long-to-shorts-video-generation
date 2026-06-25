import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/db/user";
import { db } from "@/lib/db";
import { clips, videos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import ClipEditorClient from "@/components/ClipEditorClient";

interface PageProps {
  params: Promise<{
    clipId: string;
  }>;
}

export default async function ClipDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  // Await async dynamic route parameters
  const { clipId } = await params;

  // Retrieve the clip record and join with parent video to assert user ownership
  const [clipData] = await db
    .select({
      clip: clips,
      video: videos,
    })
    .from(clips)
    .innerJoin(videos, eq(clips.videoId, videos.id))
    .where(and(eq(clips.id, clipId), eq(videos.userId, user.id)))
    .limit(1);

  if (!clipData) {
    redirect("/dashboard");
  }

  const { clip, video } = clipData;

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

  // Parse Deepgram transcripts into word segments
  const transcriptData = video.transcript as unknown as TranscriptPayload | null;
  const alternatives = transcriptData?.results?.channels?.[0]?.alternatives?.[0];
  const words = alternatives?.words || [];

  // Filter words that fall within the clip's time range
  const clipWords = words.filter(
    (w) => w.start >= clip.startTime && w.start <= clip.endTime
  );

  return (
    <ClipEditorClient
      clip={{
        ...clip,
        subtitleStyle: clip.subtitleStyle || null,
        clipUrl: clip.clipUrl || null,
      }}
      video={video}
      transcriptSegments={clipWords}
    />
  );
}
