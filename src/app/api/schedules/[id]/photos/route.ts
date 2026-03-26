import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { uploadToS3 } from '@/lib/s3';

/**
 * POST /api/schedules/[id]/photos
 * 管理者がスケジュールに写真をアップロード
 * FormData: photo (file), type (FLYER | MAP | COMPLETION)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const scheduleId = parseInt(id);
    if (isNaN(scheduleId)) {
      return NextResponse.json({ error: 'Invalid schedule ID' }, { status: 400 });
    }

    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });
    if (!schedule) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const photo = formData.get('photo') as File | null;
    const photoType = (formData.get('type') as string) || 'FLYER';

    if (!photo) {
      return NextResponse.json({ error: 'photo is required' }, { status: 400 });
    }

    const ext = photo.name?.split('.').pop() || 'jpg';
    const key = `uploads/schedule-photos/${scheduleId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());
    const photoUrl = await uploadToS3(buffer, key, photo.type || 'image/jpeg');

    const saved = await prisma.schedulePhoto.create({
      data: { scheduleId, photoUrl, type: photoType, source: 'ADMIN' },
    });

    // チラシ写真 → checkFlyerPhoto、地図写真 → checkMapPhoto を自動ON
    const checkField = photoType === 'FLYER' ? 'checkFlyerPhoto' : photoType === 'MAP' ? 'checkMapPhoto' : null;
    if (checkField) {
      await prisma.distributionSchedule.update({
        where: { id: scheduleId },
        data: { [checkField]: true },
      });
    }

    return NextResponse.json({ success: true, photo: saved });
  } catch (err) {
    console.error('POST /api/schedules/[id]/photos error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
