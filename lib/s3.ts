import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.REMOTION_AWS_REGION || "us-east-1";
const accessKeyId = process.env.REMOTION_AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.REMOTION_AWS_SECRET_ACCESS_KEY;

const s3Client = accessKeyId && secretAccessKey
  ? new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  : null;

export function getS3BucketAndKey(fileUrl: string) {
  const url = new URL(fileUrl);
  let bucketName = "";
  let key = "";

  if (url.hostname.includes(".s3.")) {
    bucketName = url.hostname.split(".s3")[0];
    key = decodeURIComponent(url.pathname.substring(1));
  } else {
    const parts = url.pathname.split("/").filter(Boolean);
    bucketName = parts[0] || "";
    key = decodeURIComponent(parts.slice(1).join("/"));
  }

  return { bucketName, key };
}

export async function deleteFileFromS3(fileUrl: string): Promise<void> {
  if (!s3Client) {
    throw new Error("AWS S3 client is not configured. Missing REMOTION_AWS_ACCESS_KEY_ID or REMOTION_AWS_SECRET_ACCESS_KEY.");
  }

  const { bucketName, key } = getS3BucketAndKey(fileUrl);
  if (!bucketName || !key) {
    throw new Error(`Failed to extract S3 bucket and key from URL: ${fileUrl}`);
  }

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );
  
  console.log(`Successfully deleted S3 object: ${key} from bucket: ${bucketName}`);
}

/**
 * Generates a secure, temporary presigned URL for private S3 assets.
 * Falls back gracefully to the raw URL if the asset is not in S3 or credentials are missing.
 */
export async function getPlayableUrl(fileUrl: string | null | undefined): Promise<string> {
  if (!fileUrl) return "";
  
  const isS3 = fileUrl.includes("s3.amazonaws.com") || fileUrl.includes(".s3.");
  if (!isS3) {
    return fileUrl;
  }
  
  if (!s3Client) {
    return fileUrl;
  }
  
  try {
    const { bucketName, key } = getS3BucketAndKey(fileUrl);
    if (!bucketName || !key) {
      return fileUrl;
    }
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    });
    
    // URL expires in 2 hours (7200 seconds)
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 7200 });
    return signedUrl;
  } catch (error) {
    console.error("Failed to generate presigned S3 URL:", error);
    return fileUrl;
  }
}
