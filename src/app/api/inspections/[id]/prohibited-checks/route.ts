import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { uploadToS3 } from '@/lib/s3';

// POST /api/inspections/[id]/prohibited-checks
// 配布禁止物件チェックを記録
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
    const prohibitedPropertyId = formData.get('prohibitedPropertyId') as string | null;
    const latitude = formData.get('latitude') as string | null;
    const longitude = formData.get('longitude') as string | null;
    const address = formData.get('address') as string | null;
    const result = formData.get('result') as string;
    const note = formData.get('note') as string | null;
    const photoFile = formData.get('photo') as File | null;

    if (!result) {
      return NextResponse.json({ error: 'result は必須です' }, { status: 400 });
    }

    if (!['COMPLIANT', 'VIOLATION', 'UNABLE_TO_CHECK'].includes(result)) {
      return NextResponse.json(
        { error: 'result は COMPLIANT, VIOLATION, UNABLE_TO_CHECK のいずれかです' },
        { status: 400 }
      );
    }

    // 写真アップロード
    let photoUrl: string | null = null;
    if (photoFile) {
      const buffer = Buffer.from(await photoFile.arrayBuffer());
      const ext = photoFile.name.split('.').pop() || 'jpg';
      const timestamp = Date.now();
      const s3Key = `uploads/inspections/${inspectionId}/prohibited/${timestamp}.${ext}`;
      photoUrl = await uploadToS3(buffer, s3Key, photoFile.type);
    }

    const parsedPropId = prohibitedPropertyId ? parseInt(prohibitedPropertyId) : null;

    // 既存チェックがあれば更新（upsert）
    const existing = parsedPropId
      ? await prisma.inspectionProhibitedCheck.findFirst({
          where: { inspectionId, prohibitedPropertyId: parsedPropId },
        })
      : null;

    const data = {
      result: result as 'COMPLIANT' | 'VIOLATION' | 'UNABLE_TO_CHECK',
      ...(photoUrl && { photoUrl }),
      note: note || null,
      checkedAt: new Date(),
    };

    let prohibitedCheck;
    if (existing) {
      prohibitedCheck = await prisma.inspectionProhibitedCheck.update({
        where: { id: existing.id },
        data,
      });
    } else {
      prohibitedCheck = await prisma.inspectionProhibitedCheck.create({
        data: {
          inspectionId,
          prohibitedPropertyId: parsedPropId,
          latitude: latitude ? parseFloat(latitude) : null,
          longitude: longitude ? parseFloat(longitude) : null,
          address: address || null,
          ...data,
        },
      });
    }

    return NextResponse.json(prohibitedCheck, { status: existing ? 200 : 201 });
  } catch (err) {
    console.error('POST /api/inspections/[id]/prohibited-checks error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
