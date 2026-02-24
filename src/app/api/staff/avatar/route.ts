import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import Busboy from 'busboy';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

const prisma = new PrismaClient();

function parseMultipart(request: Request): Promise<{ buffer: Buffer; originalName: string } | null> {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get('content-type') ?? '';
    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    });

    let fileBuffer: Buffer | null = null;
    let originalName = '';

    busboy.on('file', (_name, stream, info) => {
      originalName = info.filename;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
      stream.on('error', reject);
    });

    busboy.on('finish', () => {
      resolve(fileBuffer ? { buffer: fileBuffer, originalName } : null);
    });

    busboy.on('error', reject);

    const reader = request.body?.getReader();
    if (!reader) { reject(new Error('No request body')); return; }

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { busboy.end(); break; }
          busboy.write(Buffer.from(value));
        }
      } catch (err) {
        reject(err);
      }
    };
    pump();
  });
}

export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const file = await parseMultipart(request);
    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
    }

    const ext = file.originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowed.includes(ext)) {
      return NextResponse.json({ error: '画像ファイル（JPG/PNG/GIF/WebP）のみアップロードできます' }, { status: 400 });
    }

    const filename = `distributor-${distributor.id}-${Date.now()}.${ext}`;
    const uploadDir = path.join(process.cwd(), 'public/uploads/distributor-avatars');
    await mkdir(uploadDir, { recursive: true });

    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, file.buffer);

    const url = `/uploads/distributor-avatars/${filename}`;

    await prisma.flyerDistributor.update({
      where: { id: distributor.id },
      data: { avatarUrl: url },
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Distributor Avatar Upload Error:', error);
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 });
  }
}
