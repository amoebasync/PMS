import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { uploadToS3, deleteFromS3, getMimeType } from '@/lib/s3';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import Busboy from 'busboy';
import { randomUUID } from 'crypto';

// ================================================================
// busboy でリクエストからファイルをパース
// ================================================================
type ParsedUpload = {
  file: { buffer: Buffer; originalName: string } | null;
  fields: Record<string, string>;
};

function parseMultipart(request: Request): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get('content-type') ?? '';

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    });

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let originalName = '';

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (_name, stream, info) => {
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

// ================================================================
// imageUrls JSON ヘルパー
// ================================================================
function parseImageUrls(imageUrlsStr: string | null): string[] {
  if (!imageUrlsStr) return [];
  try {
    const parsed = JSON.parse(imageUrlsStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// S3 URL / プロキシURLからS3キーを抽出
function extractS3Key(url: string): string | null {
  // プロキシURL形式: /api/s3-proxy?key=uploads/complaints/...
  if (url.startsWith('/api/s3-proxy')) {
    try {
      const u = new URL(url, 'http://localhost');
      return u.searchParams.get('key');
    } catch {
      return null;
    }
  }
  // フルS3 URL形式
  const match = url.match(/amazonaws\.com\/(.+)$/);
  return match ? match[1] : null;
}

// POST /api/complaints/[id]/images
// クレーム画像アップロード
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true, title: true, imageUrls: true },
    });
    if (!complaint) {
      return NextResponse.json({ error: 'クレームが見つかりません' }, { status: 404 });
    }

    const { file } = await parseMultipart(request);
    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
    }

    // 許可する拡張子
    const ext = file.originalName.split('.').pop()?.toLowerCase() || 'bin';
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: '対応していない画像形式です。jpg, png, gif, webp のみ対応しています' },
        { status: 400 }
      );
    }

    // S3にアップロード
    const uuid = randomUUID();
    const s3Key = `uploads/complaints/${complaintId}/${uuid}.${ext}`;
    const url = await uploadToS3(file.buffer, s3Key, getMimeType(ext));

    // imageUrls JSON配列に追加
    const currentUrls = parseImageUrls(complaint.imageUrls);
    currentUrls.push(url);

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    await prisma.$transaction(async (tx) => {
      await tx.complaint.update({
        where: { id: complaintId },
        data: { imageUrls: JSON.stringify(currentUrls) },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'Complaint',
        targetId: complaintId,
        beforeData: { imageUrls: parseImageUrls(complaint.imageUrls) },
        afterData: { imageUrls: currentUrls },
        ipAddress: ip,
        description: `クレーム「${complaint.title}」に画像を追加`,
        tx,
      });
    });

    return NextResponse.json({ url, imageUrls: currentUrls }, { status: 201 });
  } catch (error) {
    console.error('Complaint Image Upload Error:', error);
    return NextResponse.json({ error: '画像のアップロードに失敗しました' }, { status: 500 });
  }
}

// DELETE /api/complaints/[id]/images
// クレーム画像削除（body: { url: string }）
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const complaintId = parseInt(id);
    if (isNaN(complaintId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { url } = body;
    if (!url) {
      return NextResponse.json({ error: '削除する画像URLを指定してください' }, { status: 400 });
    }

    const complaint = await prisma.complaint.findUnique({
      where: { id: complaintId },
      select: { id: true, title: true, imageUrls: true },
    });
    if (!complaint) {
      return NextResponse.json({ error: 'クレームが見つかりません' }, { status: 404 });
    }

    const currentUrls = parseImageUrls(complaint.imageUrls);
    const updatedUrls = currentUrls.filter((u) => u !== url);

    if (currentUrls.length === updatedUrls.length) {
      return NextResponse.json({ error: '指定された画像がクレームに登録されていません' }, { status: 404 });
    }

    // S3から削除
    const s3Key = extractS3Key(url);
    if (s3Key) {
      try {
        await deleteFromS3(s3Key);
      } catch (err) {
        console.error('S3 delete failed (continuing):', err);
      }
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    await prisma.$transaction(async (tx) => {
      await tx.complaint.update({
        where: { id: complaintId },
        data: {
          imageUrls: updatedUrls.length > 0 ? JSON.stringify(updatedUrls) : null,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'Complaint',
        targetId: complaintId,
        beforeData: { imageUrls: currentUrls },
        afterData: { imageUrls: updatedUrls },
        ipAddress: ip,
        description: `クレーム「${complaint.title}」から画像を削除`,
        tx,
      });
    });

    return NextResponse.json({ imageUrls: updatedUrls });
  } catch (error) {
    console.error('Complaint Image Delete Error:', error);
    return NextResponse.json({ error: '画像の削除に失敗しました' }, { status: 500 });
  }
}
