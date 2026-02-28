import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { uploadToS3, deleteFromS3, getMimeType } from '@/lib/s3';
import Busboy from 'busboy';
import { randomUUID } from 'crypto';

const S3_PREFIX = 'uploads/prohibited-properties/';

// busboy でマルチパートフォームをパースするヘルパー
type ParsedUpload = {
  file: { buffer: Buffer; originalName: string } | null;
  fields: Record<string, string>;
};

function parseMultipart(request: Request): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get('content-type') ?? '';

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    });

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let originalName = '';

    busboy.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    busboy.on('file', (_name: string, stream: NodeJS.ReadableStream, info: { filename: string }) => {
      originalName = info.filename;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
      stream.on('error', reject);
    });

    busboy.on('finish', () => {
      resolve({
        file: fileBuffer ? { buffer: fileBuffer, originalName } : null,
        fields,
      });
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

// POST /api/prohibited-properties/[id]/images
// 画像をS3にアップロードし、物件のimageUrls配列に追加
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    // 物件存在チェック
    const property = await prisma.prohibitedProperty.findUnique({
      where: { id },
      select: { id: true, imageUrls: true },
    });
    if (!property) {
      return NextResponse.json({ error: '配布禁止物件が見つかりません' }, { status: 404 });
    }

    const { file } = await parseMultipart(request);
    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
    }

    const ext = file.originalName.split('.').pop() || 'bin';
    const uuid = randomUUID();
    const s3Key = `${S3_PREFIX}${id}/${uuid}.${ext}`;
    const url = await uploadToS3(file.buffer, s3Key, getMimeType(ext));

    // 既存のimageUrls配列に追加
    let currentUrls: string[] = [];
    if (property.imageUrls) {
      try {
        currentUrls = JSON.parse(property.imageUrls);
      } catch {
        currentUrls = [];
      }
    }
    currentUrls.push(url);

    await prisma.prohibitedProperty.update({
      where: { id },
      data: { imageUrls: JSON.stringify(currentUrls) },
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('ProhibitedProperty Image Upload Error:', error);
    return NextResponse.json({ error: '画像のアップロードに失敗しました' }, { status: 500 });
  }
}

// DELETE /api/prohibited-properties/[id]/images
// S3から画像を削除し、物件のimageUrls配列から除外
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const body = await request.json();
    const { imageUrl } = body;
    if (!imageUrl) {
      return NextResponse.json({ error: '削除する画像URLが必要です' }, { status: 400 });
    }

    const property = await prisma.prohibitedProperty.findUnique({
      where: { id },
      select: { id: true, imageUrls: true },
    });
    if (!property) {
      return NextResponse.json({ error: '配布禁止物件が見つかりません' }, { status: 404 });
    }

    // S3から削除 - プロキシURLからS3キーを抽出
    let s3Key = '';
    if (imageUrl.startsWith('/api/s3-proxy')) {
      // /api/s3-proxy?key=xxx 形式
      const urlObj = new URL(imageUrl, 'http://localhost');
      s3Key = urlObj.searchParams.get('key') || '';
    } else if (imageUrl.includes('.amazonaws.com/')) {
      // フルS3 URL形式
      s3Key = imageUrl.split('.amazonaws.com/')[1];
    } else {
      s3Key = imageUrl;
    }

    if (s3Key) {
      try {
        await deleteFromS3(s3Key);
      } catch (err) {
        console.error('S3 delete error (continuing):', err);
      }
    }

    // imageUrls配列から除外
    let currentUrls: string[] = [];
    if (property.imageUrls) {
      try {
        currentUrls = JSON.parse(property.imageUrls);
      } catch {
        currentUrls = [];
      }
    }
    const updatedUrls = currentUrls.filter((u: string) => u !== imageUrl);

    await prisma.prohibitedProperty.update({
      where: { id },
      data: { imageUrls: updatedUrls.length > 0 ? JSON.stringify(updatedUrls) : null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ProhibitedProperty Image Delete Error:', error);
    return NextResponse.json({ error: '画像の削除に失敗しました' }, { status: 500 });
  }
}
