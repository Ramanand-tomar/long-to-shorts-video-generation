import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const SIGNING_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!SIGNING_SECRET) {
    console.error("Missing CLERK_WEBHOOK_SECRET environment variable");
    return new Response("Error: Webhook secret not configured", {
      status: 500,
    });
  }

  // Get headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error: Missing Svix headers", {
      status: 400,
    });
  }

  // Get body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  let evt: WebhookEvent;

  // Create new Svix instance with secret
  const wh = new Webhook(SIGNING_SECRET);

  // Verify payload
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error: Could not verify webhook signature:", err);
    return new Response("Error: Verification failed", {
      status: 400,
    });
  }

  // Handle user creation
  const eventType = evt.type;

  if (eventType === "user.created") {
    const { id, email_addresses, first_name, last_name } = evt.data;

    // Retrieve email address
    const email = email_addresses?.[0]?.email_address;
    if (!email) {
      console.error(`Received user.created event for ${id} without an email address`);
      return new Response("Error: No email address found", {
        status: 400,
      });
    }

    const name = [first_name, last_name].filter(Boolean).join(" ") || null;

    try {
      // Prevent duplicate insertions
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.clerkUserId, id))
        .limit(1);

      if (!existingUser) {
        await db.insert(users).values({
          clerkUserId: id,
          email,
          name,
          plan: "free",
          uploadCount24h: 0,
        });
        console.log(`Provisioned user record for Clerk ID: ${id} (${email})`);
      } else {
        console.log(`User ${id} already provisioned, skipping database write`);
      }
    } catch (error) {
      console.error("Database error during user provisioning:", error);
      return new Response("Internal Database Error", {
        status: 500,
      });
    }
  }

  return new Response("Webhook processed successfully", { status: 200 });
}
