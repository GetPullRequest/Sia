import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

export interface FileMetadata {
  fileName: string;
  mimeType?: string;
  size: number;
  orgId: string;
  jobId?: string;
  uploadedBy: string;
}

export interface StoredFile {
  id: string;
  gcsPath: string;
  signedUrl?: string;
}

/**
 * Google Cloud Storage integration for file uploads
 */
export class GCSStorage {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    // In production (Cloud Run), projectId and credentials are automatically
    // inferred from the instance metadata and attached service account.
    // Locally, they can be inferred from gcloud CLI config or explicitly set.
    this.storage = new Storage({
      ...(process.env.GCS_PROJECT_ID && {
        projectId: process.env.GCS_PROJECT_ID,
      }),
      ...(process.env.GCS_CREDENTIALS_PATH && {
        keyFilename: process.env.GCS_CREDENTIALS_PATH,
      }),
    });

    this.bucketName = process.env.GCS_BUCKET_NAME || 'sia-user-files';
  }

  /**
   * Upload file to GCS
   */
  async uploadFile(file: Buffer, metadata: FileMetadata): Promise<StoredFile> {
    const fileId = uuidv4();
    const fileName = `${metadata.orgId}/${fileId}/${metadata.fileName}`;

    const bucket = this.storage.bucket(this.bucketName);
    const blob = bucket.file(fileName);

    await blob.save(file, {
      metadata: {
        contentType: metadata.mimeType,
        metadata: {
          orgId: metadata.orgId,
          jobId: metadata.jobId || '',
          uploadedBy: metadata.uploadedBy,
        },
      },
    });

    return {
      id: fileId,
      gcsPath: fileName,
    };
  }

  /**
   * Generate signed URL for file access (valid for 1 hour)
   */
  async getSignedUrl(gcsPath: string): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcsPath);

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    return url;
  }

  /**
   * Delete file from GCS
   */
  async deleteFile(gcsPath: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(gcsPath);
    await file.delete();
  }

  /**
   * Get total storage used by an organization (in bytes)
   */
  async getOrgStorageUsage(orgId: string): Promise<number> {
    const bucket = this.storage.bucket(this.bucketName);
    const [files] = await bucket.getFiles({ prefix: `${orgId}/` });

    let totalSize = 0;
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const size = metadata.size || '0';
      totalSize += typeof size === 'number' ? size : parseInt(size, 10);
    }

    return totalSize;
  }
}

export const gcsStorage = new GCSStorage();
