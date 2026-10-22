'use strict';
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || 'local';
const LOCAL_STORAGE_PATH = process.env.LOCAL_STORAGE_PATH || path.join(process.cwd(), 'uploads');

// Ensure local upload directory exists
if (STORAGE_PROVIDER === 'local') {
  fs.mkdirSync(LOCAL_STORAGE_PATH, { recursive: true });
}

/**
 * Generate a unique, safe storage key for a file.
 */
function generateStorageKey(ownerId, documentType, originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const uid = crypto.randomBytes(16).toString('hex');
  return `documents/${ownerId}/${documentType}/${uid}${ext}`;
}

/**
 * Save a file buffer to storage.
 * @param {Buffer} buffer - File content
 * @param {string} storageKey - Storage path/key
 * @param {string} mimeType - MIME type
 * @returns {Promise<void>}
 */
function getS3Client() {
  const { S3Client } = require('@aws-sdk/client-s3');
  const region = process.env.AWS_REGION || 'us-east-1';
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage is configured (STORAGE_PROVIDER=s3), but AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY is missing.');
  }

  const config = {
    region,
    credentials: { accessKeyId, secretAccessKey },
  };

  // Optional custom endpoint for Cloudflare R2, MinIO, Wasabi, or Backblaze B2
  if (process.env.AWS_ENDPOINT) {
    config.endpoint = process.env.AWS_ENDPOINT;
  }

  return new S3Client(config);
}

/**
 * Save a file buffer to storage.
 * @param {Buffer} buffer - File content
 * @param {string} storageKey - Storage path/key
 * @param {string} mimeType - MIME type
 * @returns {Promise<void>}
 */
async function saveFile(buffer, storageKey, mimeType) {
  if (STORAGE_PROVIDER === 'local') {
    const fullPath = path.join(LOCAL_STORAGE_PATH, storageKey);
    const dir = path.dirname(fullPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, buffer);
    return;
  }

  if (STORAGE_PROVIDER === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const s3 = getS3Client();
    await s3.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: mimeType,
    }));
    return;
  }

  throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
}

/**
 * Get a file stream or Buffer for download.
 * Returns { stream } for local, { signedUrl } for S3 (redirect the client).
 */
async function getFile(storageKey) {
  if (STORAGE_PROVIDER === 'local') {
    const fullPath = path.join(LOCAL_STORAGE_PATH, storageKey);
    if (!fs.existsSync(fullPath)) {
      throw Object.assign(new Error('File not found in storage.'), { statusCode: 404, code: 'FILE_NOT_FOUND' });
    }
    return { stream: fs.createReadStream(fullPath) };
  }

  if (STORAGE_PROVIDER === 's3') {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
    const s3 = getS3Client();
    const command = new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: storageKey });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5-minute URL
    return { signedUrl };
  }

  throw new Error(`Unknown storage provider: ${STORAGE_PROVIDER}`);
}

/**
 * Delete a file from storage.
 */
async function deleteFile(storageKey) {
  if (STORAGE_PROVIDER === 'local') {
    const fullPath = path.join(LOCAL_STORAGE_PATH, storageKey);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    return;
  }

  if (STORAGE_PROVIDER === 's3') {
    try {
      const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
      const s3 = getS3Client();
      await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET, Key: storageKey }));
    } catch (err) {
      console.warn(`[storage] Failed to delete S3 file ${storageKey}:`, err.message);
    }
    return;
  }
}

module.exports = { generateStorageKey, saveFile, getFile, deleteFile };
