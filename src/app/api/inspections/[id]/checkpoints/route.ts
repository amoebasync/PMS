import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { uploadToS3 } from '@/lib/s3';

// POST /api/inspections/[id]/checkpoints
// チェックポイント（配布確認）を記録
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const inspectionId = parseInt(id);
    if (isNaN(inspectionId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    // 現地確認の存在確認
    const inspection = await prisma.fieldInspection.findUnique({
      where: { id: inspectionId },
    });

    if (!inspection) {
      return NextResponse.json({ error: '現地確認が見つかりません' }, { status: 404 });
    }

    const formData = await request.formData();
    const targetLat = formData.get('targetLat') as string;
    const targetLng = formData.get('targetLng') as string;
    const targetAddress = formData.get('targetAddress') as string | null;
    const actualLat = formData.get('actualLat') as string | null;
    const actualLng = formData.get('actualLng') as string | null;
    const result = formData.get('result') as string;
    const note = formData.get('note') as string | null;
    const photoFile = formData.get('photo') as File | null;

    if (!targetLat || !targetLng || !result) {
      return NextResponse.json(
        { error: 'targetLat, targetLng, result は必須です' },
        { status: 400 }
      );
    }

    if (!['CONFIRMED', 'NOT_FOUND', 'UNABLE_TO_CHECK'].includes(result)) {
      return NextResponse.json(
        { error: 'result は CONFIRMED, NOT_FOUND, UNABLE_TO_CHECK のいずれかです' },
        { status: 400 }
      );
    }

    // 写真アップロード
    let photoUrl: string | null = null;
    if (photoFile) {
      const buffer = Buffer.from(await photoFile.arrayBuffer());
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const s3Key = `uploads/inspections/${inspectionId}/checkpoints/${timestamp}.${ext}`;
      photoUrl = await uploadToS3(buffer, s3Key, photoFile.type);
    }

    const checkpoint = await prisma.inspectionCheckpoint.create({
      data: {
        inspectionId,
        targetLat: parseFloat(targetLat),
        targetLng: parseFloat(targetLng),
        targetAddress: targetAddress || null,
        actualLat: actualLat ? parseFloat(actualLat) : null,
        actualLng: actualLng ? parseFloat(actualLng) : null,
        result: result as 'CONFIRMED' | 'NOT_FOUND' | 'UNABLE_TO_CHECK',
        photoUrl,
        note: note || null,
        checkedAt: new Date(),
      },
    });

    return NextResponse.json(checkpoint, { status: 201 });
  } catch (err) {
    console.error('POST /api/inspections/[id]/checkpoints error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
