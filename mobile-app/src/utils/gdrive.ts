import * as FileSystem from 'expo-file-system/legacy';

export interface UploadResult {
  fileId: string;
  driveUrl: string;
}

export interface UploadProgressCallback {
  (progress: number): void;
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
    console.warn('Permission update failed (non-blocking for trigger):', errorText);
  }

  return {
    fileId,
    driveUrl: `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`,
  };
}
