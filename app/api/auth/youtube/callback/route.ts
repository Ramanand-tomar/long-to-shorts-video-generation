import { NextResponse, NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { eq } from "drizzle-orm";
import { encrypt } from "@/lib/encryption";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const origin = request.nextUrl.origin;
  const targetUrl = new URL("/dashboard/settings/youtube", origin);

  if (error) {
    console.error("YouTube OAuth callback returned error:", error);
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

    const redirectUri = `${origin}/api/auth/youtube/callback`;

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

    if (!refreshToken) {
      if (!user.youtubeRefreshToken) {
        targetUrl.searchParams.set("error", "Google did not return a refresh token. Please remove app access from your Google account settings and try again.");
        return NextResponse.redirect(targetUrl.toString());
      }
    }

    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    let channelId = null;
    let channelName = null;

    if (channelResponse.ok) {
      const channelData = await channelResponse.json();
      const channel = channelData.items?.[0];
      if (channel) {
        channelId = channel.id;
        channelName = channel.snippet?.title;
      }
    }

    const updateData: Partial<typeof users.$inferInsert> = {
      youtubeChannelId: channelId,
      youtubeChannelName: channelName,
      updatedAt: new Date(),
    };

    if (refreshToken) {
      updateData.youtubeRefreshToken = encrypt(refreshToken);
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, user.id));

    targetUrl.searchParams.set("success", "true");
    return NextResponse.redirect(targetUrl.toString());
  } catch (err: unknown) {
    console.error("YouTube callback execution failed:", err);
    const errorMsg = err instanceof Error ? err.message : String(err);
    targetUrl.searchParams.set("error", `Internal server error: ${errorMsg}`);
    return NextResponse.redirect(targetUrl.toString());
  }
}
