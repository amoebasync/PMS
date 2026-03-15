import { NextResponse } from 'next/server';
import { requireAdminSession } from '@/lib/adminAuth';
import { uploadToS3 } from '@/lib/s3';
import Busboy from 'busboy';
import { Readable } from 'stream';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart/form-data required' }, { status: 400 });
    }

    const body = await request.arrayBuffer();
    const buffer = Buffer.from(body);

    return new Promise<NextResponse>((resolve) => {
      const busboy = Busboy({ headers: { 'content-type': contentType } });
      let fileBuffer: Buffer | null = null;
      let fileName = '';
      let mimeType = '';

      busboy.on('file', (_field, file, info) => {
        const chunks: Buffer[] = [];
        fileName = info.filename;
        mimeType = info.mimeType;
        file.on('data', (chunk: Buffer) => chunks.push(chunk));
        file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
      });

      busboy.on('finish', async () => {
        if (!fileBuffer) {
          resolve(NextResponse.json({ error: 'No file' }, { status: 400 }));
          return;
        }
        const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
        const key = `uploads/company/seal_${Date.now()}.${ext}`;
        const url = await uploadToS3(fileBuffer, key, mimeType);
        resolve(NextResponse.json({ url }));
      });

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(busboy);
    });
  } catch (err) {
    console.error('Seal upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
