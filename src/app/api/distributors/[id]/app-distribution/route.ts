import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { addBetaTester } from '@/lib/appstore-connect';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/distributors/[id]/app-distribution
// 配信履歴取得
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const logs = await prisma.appDistributionLog.findMany({
      where: { distributorId },
      include: {
        sentBy: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('App Distribution Log Error:', error);
    return NextResponse.json({ error: '配信履歴の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/distributors/[id]/app-distribution
// TestFlight / Android ベータテスター招待送信
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const distributorId = parseInt(id);
    if (isNaN(distributorId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { platform, email } = body;

    // バリデーション
    if (!platform || !['APPLE', 'ANDROID'].includes(platform)) {
      return NextResponse.json({ error: 'プラットフォームを選択してください' }, { status: 400 });
    }
    if (platform === 'ANDROID') {
      return NextResponse.json({ error: 'Android配信は準備中です' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 });
    }

    // 配布員確認
    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: distributorId },
      select: { id: true, name: true, email: true },
    });
    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 1. ログを PENDING で作成（外部API呼び出し前）
    const log = await prisma.appDistributionLog.create({
      data: {
        distributorId,
        platform,
        email,
        status: 'PENDING',
        sentById: actorId,
      },
    });

    // 2. Apple TestFlight 招待送信
    let result: { success: boolean; error?: string; alreadyExists?: boolean };

    if (platform === 'APPLE') {
      // 配布員の名前を firstName/lastName に分割（スペースで分割）
      const nameParts = distributor.name.trim().split(/\s+/);
      const lastName = nameParts.length > 1 ? nameParts[0] : undefined;
      const firstName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];

      result = await addBetaTester(email, firstName, lastName);
    } else {
      result = { success: false, error: 'Android配信は準備中です' };
    }

    // 3. ログを最終ステータスに更新
    const updatedLog = await prisma.appDistributionLog.update({
      where: { id: log.id },
      data: {
        status: result.success ? 'SENT' : 'FAILED',
        sentAt: result.success ? new Date() : null,
        errorMessage: result.error || null,
      },
      include: {
        sentBy: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
      },
    });

    // 4. 監査ログ
    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'CREATE',
      targetModel: 'AppDistributionLog',
      targetId: log.id,
      afterData: updatedLog as unknown as Record<string, unknown>,
      ipAddress: ip,
      description: result.success
        ? `配布スタッフ「${distributor.name}」にTestFlight招待を送信（${email}）${result.alreadyExists ? '（既に登録済み）' : ''}`
        : `配布スタッフ「${distributor.name}」へのTestFlight招待送信に失敗（${email}）: ${result.error}`,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || '送信に失敗しました',
          log: updatedLog,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: result.alreadyExists
        ? 'このメールアドレスは既にTestFlightに登録されています'
        : 'TestFlight招待を送信しました',
      alreadyExists: result.alreadyExists || false,
      log: updatedLog,
    });
  } catch (error) {
    console.error('App Distribution Error:', error);
    return NextResponse.json({ error: 'アプリ配信に失敗しました' }, { status: 500 });
  }
}
