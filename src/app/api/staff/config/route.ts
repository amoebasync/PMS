import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// GET /api/staff/config — アプリ設定パラメータ取得
export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    // SystemSetting から GPS 設定を取得
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ['gpsTrackingInterval', 'progressMilestone'] },
      },
    });

    const settingMap: Record<string, string> = {};
    for (const s of settings) {
      settingMap[s.key] = s.value;
    }

    return NextResponse.json({
      gpsTrackingIntervalSeconds: parseInt(settingMap.gpsTrackingInterval || '10'),
      progressMilestone: parseInt(settingMap.progressMilestone || '500'),
    });
  } catch (error) {
    console.error('Staff Config Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
