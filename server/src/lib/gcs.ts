import { Storage } from '@google-cloud/storage';

// Initialize the GCS client
// Note: In production, you would typically use a service account key file.
// If GOOGLE_APPLICATION_CREDENTIALS is set in the environment, it uses that.
const storage = new Storage();

// We'll use a bucket name from env or a fallback for development
const bucketName = process.env.GCS_BUCKET_NAME || 'tenderiq-vault';

/**
 * Generate a signed URL for uploading a file directly from the client to GCS.
 * @param gcsKey The object key (path) in GCS
 * @param contentType The MIME type of the file
 * @returns An object containing the upload URL
 */
export async function generateUploadUrl(gcsKey: string, contentType: string = 'application/octet-stream') {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsKey);

    // Set a short expiration time (e.g., 15 minutes) for the upload URL
    const options = {
      version: 'v4' as const,
      action: 'write' as const,
      expires: Date.now() + 15 * 60 * 1000, 
      contentType,
    };

    const [url] = await file.getSignedUrl(options);
    return { uploadUrl: url, gcsKey };
  } catch (err: any) {
    console.error('Error generating GCS upload URL:', err);
    // If we're not properly authenticated in local dev, return a mock URL
    // This allows the UI to proceed without a real GCS bucket during development
    if (process.env.NODE_ENV !== 'production' && (err.message.includes('credential') || err.message.includes('auth'))) {
      return { 
        uploadUrl: `http://localhost:5000/api/v1/vault/mock-s3-upload?key=${encodeURIComponent(gcsKey)}`, 
        gcsKey 
      };
    }
    throw err;
  }
}

/**
 * Generate a signed URL for downloading/viewing a file securely.
 * @param gcsKey The object key (path) in GCS
 * @returns An object containing the download URL and expiration time
 */
export async function generateDownloadUrl(gcsKey: string) {
  try {
    const bucket = storage.bucket(bucketName);
    const file = bucket.file(gcsKey);

    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    const options = {
      version: 'v4' as const,
      action: 'read' as const,
      expires: expiresAt,
    };

    const [url] = await file.getSignedUrl(options);
    return { downloadUrl: url, expiresAt };
  } catch (err: any) {
    console.error('Error generating GCS download URL:', err);
    if (process.env.NODE_ENV !== 'production' && (err.message.includes('credential') || err.message.includes('auth'))) {
      return { 
        downloadUrl: `https://storage.googleapis.com/${bucketName}/${gcsKey}?mock=true`, 
        expiresAt: Date.now() + 15 * 60 * 1000 
      };
    }
    throw err;
  }
}
