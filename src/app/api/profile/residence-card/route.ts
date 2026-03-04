import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { getPresignedPutUrl, toProxyUrl } from '@/lib/s3';
import { triggerAutoVerification } from '@/lib/residence-card-verification';

// GET: プリサインドURL生成
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = parseInt(sessionId);

    const { searchParams } = new URL(request.url);
    const side = searchParams.get('side');
    if (side !== 'front' && side !== 'back') {
      return NextResponse.json({ error: 'side パラメータは front または back を指定してください' }, { status: 400 });
    }

    const s3Key = `uploads/residence-cards/employee-${employeeId}-residence-card-${side}-${Date.now()}.jpg`;
    const uploadUrl = await getPresignedPutUrl(s3Key, 'image/jpeg');

    return NextResponse.json({ uploadUrl, s3Key });
  } catch (error) {
    console.error('Presign Error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `プリサインURL生成に失敗しました: ${detail}` }, { status: 500 });
  }
}

// POST: S3アップロード完了後にDB更新
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employeeId = parseInt(sessionId);

    const body = await request.json();
    const { s3Key, side } = body;

    if (side !== 'front' && side !== 'back') {
      return NextResponse.json({ error: 'side パラメータは front または back を指定してください' }, { status: 400 });
    }
    if (!s3Key || !s3Key.startsWith('uploads/residence-cards/')) {
      return NextResponse.json({ error: '無効なS3キーです' }, { status: 400 });
    }

    const url = toProxyUrl(s3Key);
    const updateData = side === 'front'
      ? { residenceCardFrontUrl: url, hasResidenceCard: true }
      : { residenceCardBackUrl: url, hasResidenceCard: true };

    await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
    });

    // Fire-and-forget auto verification when front side is uploaded
    if (side === 'front') {
      triggerAutoVerification('Employee', employeeId).catch(() => {});
    }

    return NextResponse.json({ url, side });
  } catch (error) {
    console.error('Residence Card Update Error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `更新に失敗しました: ${detail}` }, { status: 500 });
  }
}
