import { currentUser } from "@clerk/nextjs/server";
import { db } from "./index";
import { users } from "./schema";
import { eq } from "drizzle-orm";

/**
 * Fetches the database user record for the currently logged-in Clerk user.
 * Proactively provisions the user in the database as a fallback if they don't exist yet.
 */
export async function getCurrentUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) {
    return null;
  }

  try {
    // 1. Fetch user from DB by clerkUserId
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.clerkUserId, clerkUser.id))
      .limit(1);

    if (dbUser) {
      return dbUser;
    }

    // 2. Proactive provisioning fallback:
    // If the webhook hasn't run or completed yet, provision the user directly
    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      console.error(`Clerk user ${clerkUser.id} does not have an email address`);
      return null;
    }

    const name = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ") || null;

    const [newDbUser] = await db
      .insert(users)
      .values({
        clerkUserId: clerkUser.id,
        email,
        name,
        plan: "free",
        uploadCount24h: 0,
      })
      .returning();

    return newDbUser;
  } catch (error) {
    console.error("Error retrieving or provisioning user in DB:", error);
    return null;
  }
}
