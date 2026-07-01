import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { socialConnections } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { encrypt } from "@/lib/encryption";
import { eq, and } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const origin = request.nextUrl.origin;
  const targetUrl = new URL("/dashboard", origin);

  if (error) {
    console.error("Google Drive OAuth callback returned error:", error);
    targetUrl.searchParams.set("error", `Google OAuth failed: ${error}`);
    return NextResponse.redirect(targetUrl.toString());
  }

  if (!code) {
    targetUrl.searchParams.set("error", "No code returned from Google OAuth.");
    return NextResponse.redirect(targetUrl.toString());
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      targetUrl.searchParams.set("error", "Unauthorized. Please log in first.");
      return NextResponse.redirect(targetUrl.toString());
    }

    const clientId = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      targetUrl.searchParams.set("error", "OAuth credentials are not configured on the server.");
      return NextResponse.redirect(targetUrl.toString());
    }

    const redirectUri = `${origin}/api/auth/gdrive/callback`;

    // 1. Exchange authorization code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      targetUrl.searchParams.set("error", `Failed to exchange token: ${errText}`);
      return NextResponse.redirect(targetUrl.toString());
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // 2. Fetch profile info using access token
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let profileName = "Google Drive Account";
    let platformUserId = user.id.toString();

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();
      profileName = profileData.email || profileData.name || "Google Drive Account";
      platformUserId = profileData.sub || platformUserId;
    }

    const encryptedAccessToken = encrypt(accessToken);
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : null;

    // 3. Find if there's an existing gdrive connection
    const [existing] = await db
      .select()
      .from(socialConnections)
      .where(
        and(
          eq(socialConnections.userId, user.id),
          eq(socialConnections.platform, "gdrive")
        )
      )
      .limit(1);

    if (existing) {
      const updateData: Partial<typeof socialConnections.$inferInsert> = {
        accessToken: encryptedAccessToken,
        profileName,
        platformUserId,
        updatedAt: new Date(),
      };
      if (encryptedRefreshToken) {
        updateData.refreshToken = encryptedRefreshToken;
      }
      await db
        .update(socialConnections)
        .set(updateData)
        .where(eq(socialConnections.id, existing.id));
    } else {
      await db.insert(socialConnections).values({
        userId: user.id,
        platform: "gdrive",
        platformUserId,
        profileName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
      });
    }

    targetUrl.searchParams.set("success_gdrive", "true");
    return NextResponse.redirect(targetUrl.toString());
  } catch (err: unknown) {
    console.error("Google Drive OAuth callback execution failed:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    targetUrl.searchParams.set("error", `Internal server error: ${errorMsg}`);
    return NextResponse.redirect(targetUrl.toString());
  }
}
