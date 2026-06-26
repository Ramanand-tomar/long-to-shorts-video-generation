import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { socialConnections } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/db/user";
import { exchangeZernioCode } from "@/lib/zernio";
import { encrypt, decrypt } from "@/lib/encryption";
import { eq, and } from "drizzle-orm";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const provider = searchParams.get("provider") || "instagram";
  const state = searchParams.get("state");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin || "http://localhost:3000";

  // 1. Authenticate user
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${appUrl}/sign-in`);
  }

  // 2. Validate OAuth state parameter
  const cookieStore = await cookies();
  const encryptedState = cookieStore.get("oauth_state")?.value;

  if (!state || !encryptedState) {
    return NextResponse.redirect(`${appUrl}/dashboard/social?error=missing_state`);
  }

  try {
    const decryptedState = decrypt(encryptedState);
    if (decryptedState !== state) {
      return NextResponse.redirect(`${appUrl}/dashboard/social?error=state_mismatch`);
    }
  } catch (err) {
    console.error("Failed to decrypt OAuth state cookie:", err);
    return NextResponse.redirect(`${appUrl}/dashboard/social?error=invalid_state`);
  }

  // Clear the state cookie upon successful validation
  cookieStore.delete("oauth_state");

  const connectToken = searchParams.get("connect_token");
  const accountId = searchParams.get("accountId");

  if (!code && !connectToken) {
    return NextResponse.redirect(`${appUrl}/dashboard/social?error=missing_code`);
  }

  try {
    let credentials;
    if (connectToken && accountId) {
      // Zernio connected directly and returned final connection credentials in query parameters
      credentials = {
        accessToken: connectToken,
        refreshToken: undefined,
        profileName: searchParams.get("username") || `@creator_${accountId}`,
        platformUserId: accountId,
        externalAccountId: accountId,
      };
    } else if (code) {
      // Standard OAuth callback flow: exchange code for final credentials
      credentials = await exchangeZernioCode(code);
    } else {
      throw new Error("Unable to resolve credentials from callback parameters");
    }

    // 3. Encrypt sensitive tokens using AES-256-CBC
    const encryptedAccessToken = encrypt(credentials.accessToken);
    const encryptedRefreshToken = credentials.refreshToken
      ? encrypt(credentials.refreshToken)
      : null;

    // 4. Check if the connection already exists
    const [existingConnection] = await db
      .select()
      .from(socialConnections)
      .where(
        and(
          eq(socialConnections.userId, user.id),
          eq(socialConnections.platform, provider),
          eq(socialConnections.platformUserId, credentials.platformUserId)
        )
      )
      .limit(1);

    if (existingConnection) {
      // Update existing connection
      await db
        .update(socialConnections)
        .set({
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          profileName: credentials.profileName,
          externalAccountId: credentials.externalAccountId,
          updatedAt: new Date(),
        })
        .where(eq(socialConnections.id, existingConnection.id));
    } else {
      // Insert new connection record
      await db.insert(socialConnections).values({
        userId: user.id,
        platform: provider,
        platformUserId: credentials.platformUserId,
        externalAccountId: credentials.externalAccountId,
        profileName: credentials.profileName,
        profilePicture: null,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt: null,
      });
    }

    return NextResponse.redirect(`${appUrl}/dashboard/social?success=true`);
  } catch (error) {
    console.error("OAuth callback processing failed:", error);
    return NextResponse.redirect(`${appUrl}/dashboard/social?error=exchange_failed`);
  }
}
