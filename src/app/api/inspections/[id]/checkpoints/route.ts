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
    const checkpointType = formData.get('checkpointType') as string || 'CHECKPOINT';

    if (!targetLat || !targetLng || !result) {
      return NextResponse.json(
        { error: 'targetLat, targetLng, result は必須です' },
        { status: 400 }
      );
    }

    if (!['CONFIRMED', 'NOT_FOUND', 'UNABLE_TO_CHECK', 'UNABLE'].includes(result)) {
      return NextResponse.json(
        { error: 'result は CONFIRMED, NOT_FOUND のいずれかです' },
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
        checkpointType: checkpointType as any,
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

// PUT /api/inspections/[id]/checkpoints?checkpointId=xxx
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const checkpointId = parseInt(request.nextUrl.searchParams.get('checkpointId') || '');
    if (isNaN(checkpointId)) {
      return NextResponse.json({ error: '無効なcheckpointId' }, { status: 400 });
    }

    const formData = await request.formData();
    const result = formData.get('result') as string;
    const note = formData.get('note') as string | null;
    const photoFile = formData.get('photo') as File | null;

    const updateData: any = {};
    if (result) updateData.result = result;
    if (note !== null) updateData.note = note || null;

    if (photoFile) {
      const { id } = await params;
      const buffer = Buffer.from(await photoFile.arrayBuffer());
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const s3Key = `uploads/inspections/${id}/checkpoints/${Date.now()}.${ext}`;
      updateData.photoUrl = await uploadToS3(buffer, s3Key, photoFile.type);
    }

    const updated = await prisma.inspectionCheckpoint.update({
      where: { id: checkpointId },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('PUT /api/inspections/[id]/checkpoints error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/inspections/[id]/checkpoints?checkpointId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const checkpointId = parseInt(request.nextUrl.searchParams.get('checkpointId') || '');
    if (isNaN(checkpointId)) {
      return NextResponse.json({ error: '無効なcheckpointId' }, { status: 400 });
    }

    await prisma.inspectionCheckpoint.delete({ where: { id: checkpointId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/inspections/[id]/checkpoints error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
