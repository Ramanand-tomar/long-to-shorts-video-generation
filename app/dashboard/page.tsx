import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/db/user";
import { db } from "@/lib/db";
import { videos, clips, scheduledPosts, usageLogs, pipelineRuns } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import DashboardOverview from "@/components/DashboardOverview";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  // 1. Fetch total videos count
  const videosCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(videos)
    .where(eq(videos.userId, user.id));
  const totalVideos = Number(videosCountRes[0]?.count || 0);

  // 2. Fetch clips generated count
  const clipsCountRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(clips)
    .innerJoin(videos, eq(clips.videoId, videos.id))
    .where(eq(videos.userId, user.id));
  const clipsGenerated = Number(clipsCountRes[0]?.count || 0);

  // 3. Fetch pending renders count
  const pendingRendersRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(clips)
    .innerJoin(videos, eq(clips.videoId, videos.id))
    .where(
      and(
        eq(videos.userId, user.id),
        eq(clips.renderStatus, "rendering")
      )
    );
  const pendingRenders = Number(pendingRendersRes[0]?.count || 0);

  // 4. Fetch scheduled posts count
  const scheduledPostsRes = await db
    .select({ count: sql<number>`count(*)` })
    .from(scheduledPosts)
    .where(
      and(
        eq(scheduledPosts.userId, user.id),
        eq(scheduledPosts.status, "scheduled")
      )
    );
  const scheduledPostsCount = Number(scheduledPostsRes[0]?.count || 0);

  // 5. Fetch last 10 usage logs
  const logs = await db
    .select()
    .from(usageLogs)
    .where(eq(usageLogs.userId, user.id))
    .orderBy(desc(usageLogs.timestamp))
    .limit(10);

  // 6. Fetch active pipeline runs (status not in completed or failed)
  const activePipelines = await db
    .select({
      id: pipelineRuns.id,
      videoId: pipelineRuns.videoId,
      status: pipelineRuns.status,
      totalClips: pipelineRuns.totalClips,
      publishedClips: pipelineRuns.publishedClips,
      videoTitle: videos.title,
    })
    .from(pipelineRuns)
    .innerJoin(videos, eq(pipelineRuns.videoId, videos.id))
    .where(
      and(
        eq(pipelineRuns.userId, user.id),
        sql`${pipelineRuns.status} not in ('completed', 'failed')`
      )
    )
    .orderBy(desc(pipelineRuns.createdAt));

  return (
    <DashboardOverview
      userPlan={user.plan}
      stats={{
        totalVideos,
        clipsGenerated,
        pendingRenders,
        scheduledPosts: scheduledPostsCount,
      }}
      recentLogs={logs}
      activePipelines={activePipelines}
    />
  );
}
