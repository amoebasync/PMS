import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Busboy from 'busboy';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { uploadToS3, getMimeType } from '@/lib/s3';

function parseMultipart(request: Request): Promise<{ buffer: Buffer; originalName: string; fieldName: string } | null> {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get('content-type') ?? '';
    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    });

    let fileBuffer: Buffer | null = null;
    let originalName = '';
    let fieldName = '';

    busboy.on('file', (name, stream, info) => {
      fieldName = name;
      originalName = info.filename;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
      stream.on('error', reject);
    });

    busboy.on('finish', () => {
      resolve(fileBuffer ? { buffer: fileBuffer, originalName, fieldName } : null);
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

    const { searchParams } = new URL(request.url);
    const side = searchParams.get('side'); // 'front' or 'back'
    if (side !== 'front' && side !== 'back') {
      return NextResponse.json({ error: 'side パラメータは front または back を指定してください' }, { status: 400 });
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

    const filename = `distributor-${distributor.id}-residence-card-${side}-${Date.now()}.${ext}`;
    const s3Key = `uploads/residence-cards/${filename}`;
    const url = await uploadToS3(file.buffer, s3Key, getMimeType(ext));

    const updateData = side === 'front'
      ? { residenceCardFrontUrl: url }
      : { residenceCardBackUrl: url };

    await prisma.flyerDistributor.update({
      where: { id: distributor.id },
      data: updateData,
    });

    return NextResponse.json({ url, side });
  } catch (error) {
    console.error('Residence Card Upload Error:', error);
    return NextResponse.json({ error: 'アップロードに失敗しました' }, { status: 500 });
  }
}
