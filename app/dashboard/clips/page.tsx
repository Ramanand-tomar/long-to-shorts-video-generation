import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/db/user";
import { db } from "@/lib/db";
import { clips, videos } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import ClipsList from "@/components/ClipsList";

export default async function ClipsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch all clips belonging to any video uploaded by the user
  const userClips = await db
    .select({
      id: clips.id,
      title: clips.title,
      description: clips.description,
      startTime: clips.startTime,
      endTime: clips.endTime,
      confidenceScore: clips.confidenceScore,
      clipUrl: clips.clipUrl,
      renderStatus: clips.renderStatus,
      seoScore: clips.seoScore,
      createdAt: clips.createdAt,
      videoTitle: videos.title,
    })
    .from(clips)
    .innerJoin(videos, eq(clips.videoId, videos.id))
    .where(eq(videos.userId, user.id))
    .orderBy(desc(clips.createdAt));

  return <ClipsList clips={userClips} />;
}
