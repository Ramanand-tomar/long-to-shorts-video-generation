export async function refreshYouTubeAccessToken(): Promise<string> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing YouTube OAuth credentials. Verify YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REFRESH_TOKEN in .env.local.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to refresh YouTube access token: ${errText}`);
  }

  const data = await response.json();
  if (!data.access_token) {
    throw new Error("No access_token found in token refresh response.");
  }

  return data.access_token;
}

export async function uploadVideoToYouTube(params: {
  s3Url: string;
  title: string;
  description: string;
  tags?: string[];
}): Promise<string> {
  const { s3Url, title, description, tags = [] } = params;

  console.log(`Starting YouTube upload for video: "${title}"`);

  const accessToken = await refreshYouTubeAccessToken();

  const headResponse = await fetch(s3Url, { method: "HEAD" });
  if (!headResponse.ok) {
    throw new Error(`Failed to fetch headers for video at ${s3Url}. Status: ${headResponse.status}`);
  }
  const contentLengthStr = headResponse.headers.get("Content-Length");
  if (!contentLengthStr) {
    throw new Error(`Could not determine video content length from HEAD request to: ${s3Url}`);
  }
  const videoSize = parseInt(contentLengthStr, 10);

  const metadata = {
    snippet: {
      title,
      description,
      tags,
      categoryId: "22",
    },
    status: {
      privacyStatus: "public",
      selfDeclaredMadeForKids: false,
    },
  };

  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": videoSize.toString(),
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initResponse.ok) {
    const errText = await initResponse.text();
    throw new Error(`Failed to initiate YouTube resumable upload session: ${errText}`);
  }

  const uploadUrl = initResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Location header not returned from YouTube upload initialization endpoint.");
  }

  const videoStreamResponse = await fetch(s3Url);
  if (!videoStreamResponse.ok) {
    throw new Error(`Failed to download video stream from S3: ${s3Url}`);
  }

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": videoSize.toString(),
      "Content-Type": "video/mp4",
    },
    body: videoStreamResponse.body as unknown as BodyInit,
  });

  if (!uploadResponse.ok) {
    const errText = await uploadResponse.text();
    throw new Error(`Failed to stream video bytes to YouTube: ${errText}`);
  }

  const uploadResult = (await uploadResponse.json()) as { id?: string };
  if (!uploadResult.id) {
    throw new Error(`YouTube upload completed, but response lacks video ID: ${JSON.stringify(uploadResult)}`);
  }

  console.log(`YouTube upload completed successfully. Video ID: ${uploadResult.id}`);
  return uploadResult.id;
}
