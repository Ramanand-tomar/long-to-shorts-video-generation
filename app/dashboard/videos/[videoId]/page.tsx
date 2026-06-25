import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/db/user";
import { db } from "@/lib/db";
import { videos, analysisJobs, clips } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import VideoDetail from "@/components/VideoDetail";

interface PageProps {
  params: Promise<{
    videoId: string;
  }>;
}

export default async function VideoDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Next.js 15 dynamic route params are async and must be awaited
  const { videoId } = await params;

  // Retrieve video details (scoped to the authenticated user)
  const [video] = await db
    .select()
    .from(videos)
    .where(
      and(
        eq(videos.id, videoId),
        eq(videos.userId, user.id)
      )
    )
    .limit(1);

  if (!video) {
    redirect("/dashboard/videos");
  }

  // Retrieve any associated analysis jobs, preferring active ones or otherwise the newest
  const [job] = await db
    .select()
    .from(analysisJobs)
    .where(eq(analysisJobs.videoId, videoId))
    .orderBy(
      sql`case when ${analysisJobs.status} in ('queued', 'processing') then 0 else 1 end`,
      desc(analysisJobs.createdAt)
    )
    .limit(1);

  // Retrieve any clip recommendations generated for this video
  const videoClips = await db
    .select()
    .from(clips)
    .where(eq(clips.videoId, videoId))
    .orderBy(clips.startTime);

  return (
    <VideoDetail
      video={video}
      analysisJob={job || null}
      clips={videoClips}
    />
  );
}
