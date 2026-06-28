import * as FileSystem from 'expo-file-system/legacy';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  assetId: string;
}

export interface UploadProgressCallback {
  (progress: number): void;
}

export async function uploadToCloudinary(
  fileUri: string,
  cloudName: string,
  uploadPreset: string,
  onProgress?: UploadProgressCallback
): Promise<CloudinaryUploadResult> {
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  const uploadTask = FileSystem.createUploadTask(
    uploadUrl,
    fileUri,
    {
      headers: {
        Accept: 'application/json',
      },
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      parameters: {
        upload_preset: uploadPreset,
      },
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
    throw new Error(`Cloudinary upload failed with status code ${response ? response.status : 'unknown'}: ${response ? response.body : ''}`);
  }

  const responseJson = JSON.parse(response.body);
  const secureUrl = responseJson.secure_url;
  const publicId = responseJson.public_id;
  const assetId = responseJson.asset_id;

  if (!secureUrl) {
    throw new Error('Cloudinary upload succeeded but secure_url was not returned.');
  }

  return {
    secureUrl,
    publicId,
    assetId,
  };
}
