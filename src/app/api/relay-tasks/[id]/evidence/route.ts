import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { uploadToS3, deleteFromS3, getMimeType } from '@/lib/s3';
import { getAdminActorInfo } from '@/lib/audit';

// POST /api/relay-tasks/[id]/evidence — エビデンス写真アップロード
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actorId } = await getAdminActorInfo();
    if (!actorId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const task = await prisma.relayTask.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 });
    }

    const formData = await request.formData();
    const files = formData.getAll('photos') as File[];

    if (!files.length) {
      return NextResponse.json({ error: '写真ファイルが必要です' }, { status: 400 });
    }

    const existingUrls: string[] = Array.isArray(task.evidenceUrls) ? (task.evidenceUrls as string[]) : [];
    const newUrls: string[] = [];
    const timestamp = Date.now();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const key = `uploads/relay-tasks/${taskId}/${timestamp}_${i}.${ext}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const contentType = getMimeType(ext);
      const proxyUrl = await uploadToS3(buffer, key, contentType);
      newUrls.push(proxyUrl);
    }

    const allUrls = [...existingUrls, ...newUrls];
    const updated = await prisma.relayTask.update({
      where: { id: taskId },
      data: { evidenceUrls: allUrls },
    });

    return NextResponse.json({ evidenceUrls: updated.evidenceUrls });
  } catch (error) {
    console.error('POST /api/relay-tasks/[id]/evidence error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/relay-tasks/[id]/evidence — エビデンス写真削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { actorId } = await getAdminActorInfo();
    if (!actorId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const task = await prisma.relayTask.findUnique({ where: { id: taskId } });
    if (!task) {
      return NextResponse.json({ error: 'タスクが見つかりません' }, { status: 404 });
    }

    const { url } = await request.json();
    if (!url) {
      return NextResponse.json({ error: 'url が必要です' }, { status: 400 });
    }

    // S3キーを抽出してS3から削除
    const keyMatch = url.match(/[?&]key=([^&]+)/);
    if (keyMatch) {
      const s3Key = decodeURIComponent(keyMatch[1]);
      try {
        await deleteFromS3(s3Key);
      } catch { /* S3削除失敗は無視 */ }
    }

    const existingUrls: string[] = Array.isArray(task.evidenceUrls) ? (task.evidenceUrls as string[]) : [];
    const filteredUrls = existingUrls.filter(u => u !== url);

    const updated = await prisma.relayTask.update({
      where: { id: taskId },
      data: { evidenceUrls: filteredUrls.length > 0 ? filteredUrls : null },
    });

    return NextResponse.json({ evidenceUrls: updated.evidenceUrls });
  } catch (error) {
    console.error('DELETE /api/relay-tasks/[id]/evidence error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
