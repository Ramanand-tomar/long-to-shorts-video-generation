const apiKey = process.env.ZERNIO_API_KEY;

if (!apiKey || apiKey.includes("placeholder") || apiKey.startsWith("your_")) {
  throw new Error("ZERNIO_API_KEY is not configured or contains placeholder values. Please check your .env.local file.");
}

export interface ZernioOAuthResponse {
  accessToken: string;
  refreshToken?: string;
  profileName: string;
  platformUserId: string;
  externalAccountId: string;
}

export interface ZernioMediaItem {
  type: "image" | "video" | "gif" | "document";
  url: string;
  title?: string;
  filename?: string;
}

export interface ZernioPlatform {
  platform: string;
  accountId: string;
  customContent?: string;
  customMedia?: ZernioMediaItem[];
}

export interface ZernioPostPayload {
  title?: string;
  content?: string;
  mediaItems?: ZernioMediaItem[];
  platforms?: ZernioPlatform[];
  publishNow?: boolean;
  scheduledFor?: string;
  isDraft?: boolean;
}

/**
 * Retrieves the first/default Zernio profile ID.
 */
export async function getZernioProfileId(): Promise<string> {
  const response = await fetch("https://zernio.com/api/v1/profiles", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch Zernio profiles: ${text}`);
  }

  const data = await response.json();
  const profiles = data.profiles || [];
  if (profiles.length === 0) {
    throw new Error("No profiles found on your Zernio account. Please create a profile in the Zernio dashboard.");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const defaultProfile = profiles.find((p: any) => p.isDefault) || profiles[0];
  return defaultProfile._id || defaultProfile.id;
}

/**
 * Retrieves the OAuth URL from Zernio for a given provider.
 */
export async function getZernioOAuthUrl(provider: string, redirectUri: string, state: string): Promise<string> {
  const profileId = await getZernioProfileId();

  const response = await fetch(
    `https://zernio.com/api/v1/connect/${provider}?profileId=${profileId}&redirect_url=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zernio OAuth URL request failed: ${text}`);
  }

  const data = await response.json();
  return data.authUrl;
}

/**
 * Exchanges the OAuth callback code for tokens and account identifiers.
 */
export async function exchangeZernioCode(code: string): Promise<ZernioOAuthResponse> {
  const response = await fetch("https://zernio.com/api/v1/auth/callback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zernio code exchange failed: ${text}`);
  }

  const data = await response.json();
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    profileName: data.profileName || data.name || `@creator_${data.accountId}`,
    platformUserId: data.platformUserId || data.platform_user_id || "platform_" + data.accountId,
    externalAccountId: data.accountId || data.externalAccountId,
  };
}

/**
 * Deletes connection on Zernio platform.
 */
export async function deleteZernioAccount(externalAccountId: string): Promise<void> {
  const response = await fetch(`https://zernio.com/api/v1/accounts/${externalAccountId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zernio account revocation failed: ${text}`);
  }
}

/**
 * Gets a presigned S3 upload URL from Zernio.
 */
export async function getZernioPresignedUrl(filename: string): Promise<{ uploadUrl: string; mediaUrl: string }> {
  const response = await fetch("https://zernio.com/api/v1/media/presigned-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ filename }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zernio presigned url request failed: ${text}`);
  }

  return await response.json();
}

/**
 * Publishes a post across selected platforms using Zernio.
 */
export async function publishToZernio(payload: ZernioPostPayload): Promise<unknown> {
  const response = await fetch("https://zernio.com/api/v1/posts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zernio post publishing failed (${response.status}): ${text}`);
  }

  return await response.json();
}
