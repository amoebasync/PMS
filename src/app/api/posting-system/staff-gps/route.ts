import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchStaffGps, isPostingSystemConfigured } from '@/lib/posting-system';

// GET /api/posting-system/staff-gps?staffId=xxx&date=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    if (!cookieStore.get('pms_session')) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    if (!isPostingSystemConfigured()) {
      return NextResponse.json({ error: 'POSTING_SYSTEM_API_URL が設定されていません' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const staffId = searchParams.get('staffId');
    const date = searchParams.get('date');

    if (!staffId || !date) {
      return NextResponse.json({ error: 'staffId と date は必須です' }, { status: 400 });
    }

    const gpsPoints = await fetchStaffGps(staffId, date);
    return NextResponse.json({ gpsPoints, totalCount: gpsPoints.length });
  } catch (error) {
    console.error('Staff GPS API Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
