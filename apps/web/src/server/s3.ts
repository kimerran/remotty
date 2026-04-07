import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

let s3: S3Client | null = null

function getS3(): S3Client {
  if (!s3) {
    s3 = new S3Client({
      endpoint: process.env['S3_ENDPOINT'],
      region: process.env['S3_REGION'] ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env['S3_ACCESS_KEY'] ?? '',
        secretAccessKey: process.env['S3_SECRET_KEY'] ?? '',
      },
      forcePathStyle: true, // needed for MinIO
    })
  }
  return s3
}

const BUCKET = process.env['S3_BUCKET'] ?? 'orchestrator'

export async function getUploadUrl(
  key: string,
  contentType: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _maxSizeBytes = 100 * 1024 * 1024, // 100MB (reserved for future use)
): Promise<{ uploadUrl: string; key: string }> {
  const s3Client = getS3()
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  })
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 })
  return { uploadUrl, key }
}

export async function getDownloadUrl(key: string): Promise<string> {
  const s3Client = getS3()
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3Client, command, { expiresIn: 3600 })
}

export function buildSessionFileKey(sessionId: string, filename: string): string {
  return `sessions/${sessionId}/${filename}`
}
