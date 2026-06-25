"use server";

import { db } from "@/lib/db";
import { socialConnections, users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { eq, and } from "drizzle-orm";
import { getZernioOAuthUrl, deleteZernioAccount } from "@/lib/zernio";
import { revalidatePath } from "next/cache";
import { QUOTAS } from "@/lib/quotas";
import { cookies } from "next/headers";
import crypto from "crypto";
import { encrypt } from "@/lib/encryption";

/**
 * Initiates the connection flow for a social media platform via Zernio OAuth.
 * Enforces account count limits based on user plan (1 for Free, 6 for Pro).
 */
export async function getOAuthConnectUrl(provider: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // 1. Fetch current connection count
    const activeConnections = await db
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.userId, user.id));

    const limit = QUOTAS[user.plan as "free" | "pro"].connections;
    if (activeConnections.length >= limit) {
      return { error: "plan_limit_exceeded" };
    }

    // 2. Determine redirect URI
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    
    // 3. Generate a secure random state token and store it in an encrypted cookie
    const state = crypto.randomBytes(16).toString("hex");
    const encryptedState = encrypt(state);

    const redirectUri = `${appUrl}/api/auth/callback/zernio?provider=${provider}&state=${encodeURIComponent(state)}`;
    
    const cookieStore = await cookies();
    cookieStore.set("oauth_state", encryptedState, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    // 4. Request URL from Zernio SDK/REST
    const authUrl = await getZernioOAuthUrl(provider, redirectUri, state);

    return { success: true, authUrl };
  } catch (error) {
    console.error("Failed to generate OAuth connect URL:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Revokes a platform connection, deleting the credentials locally and revoking on Zernio.
 */
export async function disconnectPlatform(connectionId: string) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    // 1. Retrieve connection and assert ownership
    const [connection] = await db
      .select()
      .from(socialConnections)
      .where(
        and(
          eq(socialConnections.id, connectionId),
          eq(socialConnections.userId, user.id)
        )
      )
      .limit(1);

    if (!connection) {
      return { error: "connection_not_found" };
    }

    // 2. Call Zernio API to revoke token on provider
    if (connection.externalAccountId) {
      try {
        await deleteZernioAccount(connection.externalAccountId);
      } catch (err) {
        console.error("Failed to revoke account on Zernio side:", err);
        // Continue deleting local record even if Zernio fails
      }
    }

    // 3. Delete connection record
    await db
      .delete(socialConnections)
      .where(eq(socialConnections.id, connectionId));

    // 4. Revalidate paths
    revalidatePath("/dashboard/social");
    revalidatePath("/dashboard/calendar");
    revalidatePath("/dashboard");

    return { success: true };
  } catch (error) {
    console.error("Failed to disconnect platform:", error);
    return { error: "internal_server_error" };
  }
}

/**
 * Retrieves all connected platform connections for the active user.
 */
export async function getConnectedAccounts() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    return await db
      .select({
        id: socialConnections.id,
        platform: socialConnections.platform,
        profileName: socialConnections.profileName,
        profilePicture: socialConnections.profilePicture,
        createdAt: socialConnections.createdAt,
      })
      .from(socialConnections)
      .where(eq(socialConnections.userId, user.id));
  } catch (error) {
    console.error("Failed to retrieve connected accounts:", error);
    return [];
  }
}
