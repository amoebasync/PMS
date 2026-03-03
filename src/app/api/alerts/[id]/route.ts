import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET /api/alerts/[id]
export async function GET(
  _request: Request,
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

    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        category: true,
        resolvedBy: {
          select: { id: true, lastNameJa: true, firstNameJa: true },
        },
      },
    });

    if (!alert) {
      return NextResponse.json({ error: 'アラートが見つかりません' }, { status: 404 });
    }

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Alert Detail Error:', error);
    return NextResponse.json({ error: 'アラート詳細の取得に失敗しました' }, { status: 500 });
  }
}
