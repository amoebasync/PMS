import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// PUT /api/alerts/[id]/resolve
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const alertId = parseInt(id);
    if (!alertId) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.alert.findUnique({ where: { id: alertId } });
    if (!beforeData) {
      return NextResponse.json({ error: 'アラートが見つかりません' }, { status: 404 });
    }

    if (beforeData.status === 'RESOLVED') {
      return NextResponse.json({ error: 'このアラートは既に対応済みです' }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const alert = await tx.alert.update({
        where: { id: alertId },
        data: {
          status: 'RESOLVED',
          resolvedById: actorId,
          resolvedAt: new Date(),
          resolvedNote: body.note || null,
        },
        include: {
          category: true,
          resolvedBy: {
            select: { id: true, lastNameJa: true, firstNameJa: true },
          },
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'Alert',
        targetId: alertId,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: alert as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `アラート「${alert.title}」を対応済みに変更`,
        tx,
      });

      return alert;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Alert Resolve Error:', error);
    return NextResponse.json({ error: 'アラートの対応処理に失敗しました' }, { status: 500 });
  }
}
