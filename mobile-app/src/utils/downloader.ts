import * as FileSystem from 'expo-file-system/legacy';

// Public reliable cobalt API endpoints for extracting YouTube streaming links
const COBALT_ENDPOINTS = [
  'https://api.cobalt.tools/api/json',
  'https://cobalt.api.red.cutie.cafe/api/json',
];

export interface DownloadProgressCallback {
  (progress: number): void;
}

export async function getYouTubeDirectUrl(youtubeUrl: string): Promise<string> {
  let lastError = new Error('Failed to resolve YouTube URL.');

  for (const endpoint of COBALT_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: youtubeUrl,
          videoQuality: '720', // Best balance of speed/quality
          filenamePattern: 'basic',
        }),
      });

      if (!response.ok) {
        throw new Error(`Endpoint returned status ${response.status}`);
      }

      const data = await response.json();
      if (data && data.url) {
        return data.url;
      } else if (data && data.status === 'error') {
        throw new Error(data.text || 'Cobalt API returned error status');
      }
    } catch (error: any) {
      console.warn(`Cobalt endpoint ${endpoint} failed:`, error.message);
      lastError = error;
    }
  }

  throw lastError;
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
