import * as FileSystem from 'expo-file-system/legacy';

export interface UploadResult {
  fileId: string;
  driveUrl: string;
}

export interface UploadProgressCallback {
  (progress: number): void;
}
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  console.log('Refreshing Google Drive Access Token using Refresh Token...');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&refresh_token=${encodeURIComponent(refreshToken)}&grant_type=refresh_token`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google access token: ${errorText}`);
  }

  const data = await response.json();
  if (data && data.access_token) {
    return data.access_token;
  }

  throw new Error('Refresh token request succeeded but did not return access_token.');
}
export async function uploadToGoogleDrive(
  fileUri: string,
  accessToken: string,
  fileName: string,
  folderId?: string,
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media';

  // 1. Upload raw binary file to Google Drive with progress tracking
  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
    fileUri,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      mimeType: 'video/mp4',
    },
    (data) => {
      if (onProgress && data.totalBytesExpectedToSend > 0) {
        const progress = data.totalBytesSent / data.totalBytesExpectedToSend;
        onProgress(progress);
      }
    }
  );

  const response = await uploadTask.uploadAsync();

  if (!response || response.status < 200 || response.status >= 300) {
    throw new Error(`Google Drive upload failed with status code ${response ? response.status : 'unknown'}: ${response ? response.body : ''}`);
  }

  const responseJson = JSON.parse(response.body);
  const fileId = responseJson.id;

  if (!fileId) {
    throw new Error('Google Drive upload succeeded but no file ID was returned.');
  }

  // 2. Patch file metadata (rename file and optionally set parent folder)
  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  
  const patchBody: Record<string, any> = {
    name: fileName,
  };

  const patchUrl = new URL(metadataUrl);
  if (folderId && folderId.trim()) {
    // Adding parents and removing default root
    patchUrl.searchParams.append('addParents', folderId.trim());
  }

  const metadataResponse = await fetch(patchUrl.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(patchBody),
  });

  if (!metadataResponse.ok) {
    const errorText = await metadataResponse.text();
    console.warn('Metadata patch failed (non-blocking for trigger):', errorText);
  }

  // 3. Make file accessible via link (Anyone with the link can view) so pipeline can download it
  const permissionUrl = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`;
  const permissionResponse = await fetch(permissionUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      role: 'reader',
      type: 'anyone',
    }),
  });

  if (!permissionResponse.ok) {
    const errorText = await permissionResponse.text();
    throw new Error(
      `Failed to make Google Drive file public: ${errorText}. Please make sure your Google account allows sharing files outside your organization with 'anyone with the link'.`
    );
  }

  return {
    fileId,
    driveUrl: `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`,
  };
}
