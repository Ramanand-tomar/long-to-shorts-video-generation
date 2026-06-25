"use server";

import { db } from "@/lib/db";
import { users, socialConnections, scheduledPosts } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { eq, and, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { QUOTAS } from "@/lib/quotas";

/**
 * Updates the user's subscription plan tier.
 * Only succeeds from a trusted entitlement source (bypassSecret === ENCRYPTION_KEY)
 * or under development check + admin allowlist.
 */
export async function updateUserPlan(targetUserId: string, plan: "free" | "pro", bypassSecret?: string) {
  try {
    const isWebhook = bypassSecret && bypassSecret === process.env.ENCRYPTION_KEY;
    
    if (isWebhook) {
      await db
        .update(users)
        .set({ plan, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));

      revalidatePath("/dashboard/settings");
      revalidatePath("/dashboard");
      return { success: true };
    }

    // Interactive caller check
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    const isDevelopment = process.env.NODE_ENV === "development";
    const ADMIN_ALLOWLIST = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .concat(["admin@example.com", "admin@vidshort.com", "raman@example.com"]);
    
    const isAllowedAdmin = ADMIN_ALLOWLIST.includes(user.email.toLowerCase());

    if (!isDevelopment || !isAllowedAdmin) {
      return { error: "forbidden_self_service_disabled" };
    }

    await db
      .update(users)
      .set({ plan, updatedAt: new Date() })
      .where(eq(users.id, targetUserId));

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to update user plan:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Fetches all settings usage metrics and quota status for the current user.
 */
export async function getUserSettingsMetrics() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return null;
    }

    // 1. Count social connections
    const connectionsCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(socialConnections)
      .where(eq(socialConnections.userId, user.id));
    const socialConnectionsCount = Number(connectionsCountRes[0]?.count || 0);

    // 2. Count active scheduled posts (status = 'scheduled')
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

    // 3. Reset rolling metrics if 24 hours have elapsed
    const now = new Date();
    let currentUploadCount = user.uploadCount24h;
    let currentRenderCount = user.renderCount24h;
    let currentAnalysisCount = user.analysisCount24h;

    // Check Upload Reset
    if (user.lastUploadReset) {
      const ms = now.getTime() - new Date(user.lastUploadReset).getTime();
      if (ms >= 24 * 60 * 60 * 1000) {
        currentUploadCount = 0;
      }
    }

    // Check Render Reset
    if (user.lastRenderReset) {
      const ms = now.getTime() - new Date(user.lastRenderReset).getTime();
      if (ms >= 24 * 60 * 60 * 1000) {
        currentRenderCount = 0;
      }
    }

    // Check Analysis Reset
    if (user.lastAnalysisReset) {
      const ms = now.getTime() - new Date(user.lastAnalysisReset).getTime();
      if (ms >= 24 * 60 * 60 * 1000) {
        currentAnalysisCount = 0;
      }
    }

    const planKey = user.plan as "free" | "pro";
    const userQuotas = QUOTAS[planKey] || QUOTAS.free;

    const isDevelopment = process.env.NODE_ENV === "development";
    const ADMIN_ALLOWLIST = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map(e => e.trim().toLowerCase())
      .concat(["admin@example.com", "admin@vidshort.com", "raman@example.com"]);
    const isAllowedAdmin = ADMIN_ALLOWLIST.includes(user.email.toLowerCase());

    return {
      plan: user.plan,
      userId: user.id,
      isAdmin: isAllowedAdmin,
      isDev: isDevelopment,
      uploads: {
        current: currentUploadCount,
        limit: userQuotas.uploads,
        nextReset: user.lastUploadReset ? new Date(new Date(user.lastUploadReset).getTime() + 24 * 60 * 60 * 1000) : now,
      },
      renders: {
        current: currentRenderCount,
        limit: userQuotas.renders,
        nextReset: user.lastRenderReset ? new Date(new Date(user.lastRenderReset).getTime() + 24 * 60 * 60 * 1000) : now,
      },
      analyses: {
        current: currentAnalysisCount,
        limit: userQuotas.analyses,
        nextReset: user.lastAnalysisReset ? new Date(new Date(user.lastAnalysisReset).getTime() + 24 * 60 * 60 * 1000) : now,
      },
      connections: {
        current: socialConnectionsCount,
        limit: userQuotas.connections,
      },
      scheduled: {
        current: scheduledPostsCount,
        limit: userQuotas.scheduled,
      }
    };
  } catch (error) {
    console.error("Failed to retrieve user settings metrics:", error);
    return null;
  }
}

