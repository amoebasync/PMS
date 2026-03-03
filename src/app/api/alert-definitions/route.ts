import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// GET /api/alert-definitions — アラート定義一覧
export async function GET() {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session');
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const definitions = await prisma.alertDefinition.findMany({
      include: { category: true },
      orderBy: { id: 'asc' },
    });

    return NextResponse.json(definitions);
  } catch (error) {
    console.error('Alert Definitions GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
