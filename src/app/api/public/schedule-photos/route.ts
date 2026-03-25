import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-northeast-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});
const BUCKET = process.env.AWS_S3_BUCKET || '';

/**
 * GET /api/public/schedule-photos?lineUserId=xxx
 * LINE User ID から当日のスケジュール一覧を取得
 */
export async function GET(request: NextRequest) {
  const lineUserId = request.nextUrl.searchParams.get('lineUserId');
  if (!lineUserId) {
    return NextResponse.json({ error: 'lineUserId is required' }, { status: 400 });
  }

  // LINE User → Distributor
  const lineUser = await prisma.lineUser.findUnique({
    where: { lineUserId },
    select: { distributorId: true, distributor: { select: { name: true, staffId: true } } },
  });

  if (!lineUser?.distributorId) {
    return NextResponse.json({ error: 'Distributor not linked' }, { status: 404 });
  }

  // 当日のスケジュール
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
  const schedules = await prisma.distributionSchedule.findMany({
    where: {
      distributorId: lineUser.distributorId,
      date: {
        gte: new Date(`${todayStr}T00:00:00+09:00`),
        lte: new Date(`${todayStr}T23:59:59+09:00`),
      },
    },
    include: {
      area: {
        select: {
          chome_name: true, town_name: true,
          prefecture: { select: { name: true } },
          city: { select: { name: true } },
        },
      },
      items: { orderBy: { slotIndex: 'asc' }, select: { flyerName: true, plannedCount: true } },
      photos: { select: { id: true, photoUrl: true, type: true, createdAt: true }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { id: 'asc' },
  });

  return NextResponse.json({
    distributor: lineUser.distributor,
    schedules: schedules.map(s => ({
      id: s.id,
      areaName: s.area ? `${s.area.prefecture?.name || ''}${s.area.city?.name || ''}${s.area.chome_name || s.area.town_name}` : '-',
      items: s.items,
      photos: s.photos,
    })),
  });
}

/**
 * POST /api/public/schedule-photos
 * チラシ写真をアップロード
 * FormData: scheduleId, lineUserId, photo (file)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const scheduleId = parseInt(formData.get('scheduleId') as string || '');
    const lineUserId = formData.get('lineUserId') as string || '';
    const photoType = (formData.get('type') as string || 'FLYER'); // FLYER or MAP
    const photo = formData.get('photo') as File | null;

    if (!scheduleId || !lineUserId || !photo) {
      return NextResponse.json({ error: 'scheduleId, lineUserId, photo are required' }, { status: 400 });
    }

    // LINE User → Distributor 確認
    const lineUser = await prisma.lineUser.findUnique({
      where: { lineUserId },
      select: { distributorId: true },
    });
    if (!lineUser?.distributorId) {
      return NextResponse.json({ error: 'Distributor not linked' }, { status: 404 });
    }

    // スケジュールが本人のものか確認
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: scheduleId },
      select: { distributorId: true },
    });
    if (!schedule || schedule.distributorId !== lineUser.distributorId) {
      return NextResponse.json({ error: 'Schedule not found' }, { status: 404 });
    }

    // S3 アップロード
    const ext = photo.name.split('.').pop() || 'jpg';
    const key = `uploads/schedule-photos/${scheduleId}/${Date.now()}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: photo.type || 'image/jpeg',
    }));

    const photoUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION || 'ap-northeast-1'}.amazonaws.com/${key}`;

    // DB 保存 + コンプライアンスチェック自動更新
    const saved = await prisma.schedulePhoto.create({
      data: { scheduleId, photoUrl, type: photoType, source: 'LINE' },
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
    console.error('POST /api/public/schedule-photos error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
