"use server";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function disconnectYouTube() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "unauthorized" };
    }

    await db
      .update(users)
      .set({
        youtubeRefreshToken: null,
        youtubeChannelId: null,
        youtubeChannelName: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/dashboard/settings/youtube");
    return { success: true };
  } catch (error) {
    console.error("Failed to disconnect YouTube:", error);
    return { error: "internal_server_error" };
  }
}
