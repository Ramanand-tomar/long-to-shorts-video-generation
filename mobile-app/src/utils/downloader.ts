import * as FileSystem from 'expo-file-system/legacy';


export interface DownloadProgressCallback {
  (progress: number): void;
}

export async function getYouTubeDirectUrl(youtubeUrl: string, serverUrl: string): Promise<string> {
  const resolveUrl = `${serverUrl.replace(/\/$/, '')}/api/youtube/resolve`;
  
  console.log(`Resolving YouTube link via Next.js server resolver: ${resolveUrl}`);
  const response = await fetch(resolveUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      youtubeUrl: youtubeUrl,
    }),
  });

  if (!response.ok) {
    const errorJson = await response.json().catch(() => ({}));
    throw new Error(errorJson.message || `Server resolution failed with status ${response.status}`);
  }

  const data = await response.json();
  if (data && data.url) {
    return data.url;
  }

  throw new Error('Resolution succeeded but server returned no stream URL.');
}

export async function downloadVideo(
  directUrl: string,
  onProgress: DownloadProgressCallback
): Promise<string> {
  const fileUri = `${FileSystem.cacheDirectory}downloaded_youtube_video.mp4`;

  // Delete existing file if any
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  }

  const downloadResumable = FileSystem.createDownloadResumable(
    directUrl,
    fileUri,
    {},
    (downloadProgress) => {
      const progress =
        downloadProgress.totalBytesWritten /
        downloadProgress.totalBytesExpectedToWrite;
      onProgress(progress);
    }
  );

  const result = await downloadResumable.downloadAsync();
  if (!result || !result.uri) {
    throw new Error('Failed to download video file.');
  }

  return result.uri;
}
