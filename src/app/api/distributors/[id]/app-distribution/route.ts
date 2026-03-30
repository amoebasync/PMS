import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { addBetaTester } from '@/lib/appstore-connect';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { sendAndroidOpenTestEmail, sendTestFlightPublicLinkEmail } from '@/lib/mailer';

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

    // 1. ログを PENDING で作成
    const log = await prisma.appDistributionLog.create({
      data: {
        distributorId,
        platform,
        email,
        status: 'PENDING',
        sentById: actorId,
      },
    });

    // 2. プラットフォーム別処理
    let result: { success: boolean; error?: string; alreadyExists?: boolean; fallbackToPublicLink?: boolean };

    if (platform === 'APPLE') {
      // iOS: TestFlight 招待送信
      const nameParts = distributor.name.trim().split(/\s+/);
      const lastName = nameParts.length > 1 ? nameParts[0] : undefined;
      const firstName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0];
      result = await addBetaTester(email, firstName, lastName);

      // API招待が失敗してパブリックリンク送信にフォールバック
      if (result.fallbackToPublicLink) {
        try {
          await sendTestFlightPublicLinkEmail(email, distributor.name);
          console.log(`[AppDist] Sent TestFlight public link email to ${email}`);
        } catch (mailErr: any) {
          console.error('[AppDist] Failed to send public link email:', mailErr);
          result = { success: false, error: 'TestFlightリンクメール送信に失敗しました' };
        }
      }
    } else {
      // Android: オープンテスト案内メール送信（Googleグループ追加不要）
      try {
        await sendAndroidOpenTestEmail(email, distributor.name);
        result = { success: true };
      } catch (mailErr: any) {
        console.error('[AppDist] Failed to send Android open test email:', mailErr);
        result = { success: false, error: mailErr.message || 'メール送信に失敗しました' };
      }
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
      description: (() => {
        const platformLabel = platform === 'APPLE' ? 'TestFlight招待' : 'Google Playアプリ案内';
        return result.success
          ? `配布スタッフ「${distributor.name}」に${platformLabel}を送信（${email}）`
          : `配布スタッフ「${distributor.name}」への${platformLabel}送信に失敗（${email}）: ${result.error}`;
      })(),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '送信に失敗しました', log: updatedLog },
        { status: 500 },
      );
    }

    const message = platform === 'APPLE'
      ? (result.fallbackToPublicLink
        ? 'TestFlightパブリックリンクをメールで送信しました'
        : result.alreadyExists ? 'TestFlight招待を再送信しました' : 'TestFlight招待を送信しました')
      : 'アプリインストール案内メールを送信しました';

    return NextResponse.json({
      message,
      alreadyExists: result.alreadyExists || false,
      log: updatedLog,
    });
  } catch (error) {
    console.error('App Distribution Error:', error);
    return NextResponse.json({ error: 'アプリ配信に失敗しました' }, { status: 500 });
  }
}
