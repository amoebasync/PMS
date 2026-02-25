import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION || 'ap-northeast-1';
const bucket = process.env.AWS_S3_BUCKET || '';

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

export function getS3Url(key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

/** S3 URLまたはキーからアプリ内プロキシURLを生成する */
export function toProxyUrl(s3UrlOrKey: string): string {
  if (!s3UrlOrKey) return s3UrlOrKey;
  // すでにプロキシURLの場合はそのまま返す
  if (s3UrlOrKey.startsWith('/api/s3-proxy')) return s3UrlOrKey;
  // S3 URLからキーを抽出
  const s3Prefix = `https://${bucket}.s3.${region}.amazonaws.com/`;
  const key = s3UrlOrKey.startsWith(s3Prefix)
    ? s3UrlOrKey.slice(s3Prefix.length)
    : s3UrlOrKey;
  return `/api/s3-proxy?key=${encodeURIComponent(key)}`;
}

/** 署名付きURLを生成する（有効期限: デフォルト1時間） */
export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn }
  );
}

export async function uploadToS3(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
  return toProxyUrl(key);
}

export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function listS3Objects(
  prefix: string
): Promise<Array<{ key: string; lastModified: Date }>> {
  const results: Array<{ key: string; lastModified: Date }> = [];
  let continuationToken: string | undefined;

  do {
    const response = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );

    for (const obj of response.Contents || []) {
      if (obj.Key && obj.LastModified) {
        results.push({ key: obj.Key, lastModified: obj.LastModified });
      }
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return results;
}

/** ファイル拡張子からMIMEタイプを返す */
export function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    ai: 'application/postscript',
    psd: 'image/vnd.adobe.photoshop',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    zip: 'application/zip',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}
