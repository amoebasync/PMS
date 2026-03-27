import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { fetchAreaHistory, isPostingSystemConfigured } from '@/lib/posting-system';

// GET /api/posting-system/area-history?streetNumber=xxx&limit=50
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
    const streetNumber = searchParams.get('streetNumber');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!streetNumber) {
      return NextResponse.json({ error: 'streetNumber は必須です' }, { status: 400 });
    }

    const history = await fetchAreaHistory(streetNumber, limit);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Area History API Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
