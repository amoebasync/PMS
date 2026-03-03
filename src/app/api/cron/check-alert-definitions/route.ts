import { NextResponse } from 'next/server';
import { runAlertDefinitionChecks } from '@/lib/alert-definitions';

// GET /api/cron/check-alert-definitions — CRONアラート定義チェック
export async function GET(request: Request) {
  try {
    // Bearer CRON_SECRET 認証
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const result = await runAlertDefinitionChecks();

    console.log(`[check-alert-definitions] checked=${result.checked}, created=${result.alertsCreated}, errors=${result.errors.length}`);
    if (result.errors.length > 0) {
      console.error('[check-alert-definitions] Errors:', result.errors);
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('check-alert-definitions Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
