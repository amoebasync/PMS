import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

// GET /api/alerts/summary
export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const [total, bySeverity, byCategory] = await Promise.all([
      prisma.alert.count({ where: { status: 'OPEN' } }),
      prisma.alert.groupBy({
        by: ['severity'],
        where: { status: 'OPEN' },
        _count: { id: true },
      }),
      prisma.alert.groupBy({
        by: ['categoryId'],
        where: { status: 'OPEN' },
        _count: { id: true },
      }),
    ]);

    const categories = await prisma.alertCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    const severityMap: Record<string, number> = {};
    bySeverity.forEach((s) => { severityMap[s.severity] = s._count.id; });

    const categoryMap = byCategory.map((c) => {
      const cat = categories.find((cat) => cat.id === c.categoryId);
      return {
        categoryId: c.categoryId,
        name: cat?.name || '不明',
        icon: cat?.icon,
        colorCls: cat?.colorCls,
        count: c._count.id,
      };
    });

    return NextResponse.json({
      total,
      bySeverity: {
        INFO: severityMap['INFO'] || 0,
        WARNING: severityMap['WARNING'] || 0,
        CRITICAL: severityMap['CRITICAL'] || 0,
      },
      byCategory: categoryMap,
    });
  } catch (error) {
    console.error('Alert Summary Error:', error);
    return NextResponse.json({ error: 'アラートサマリーの取得に失敗しました' }, { status: 500 });
  }
}
