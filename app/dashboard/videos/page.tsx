import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/db/user";
import { db } from "@/lib/db";
import { videos } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import VideosList from "@/components/VideosList";

export default async function VideosPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch all videos uploaded by the user in reverse chronological order
  const userVideos = await db
    .select()
    .from(videos)
    .where(eq(videos.userId, user.id))
    .orderBy(desc(videos.createdAt));

  return <VideosList videos={userVideos} userPlan={user.plan} />;
}
