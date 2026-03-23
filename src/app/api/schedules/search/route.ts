import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

// GET /api/schedules/search?q=keyword&date=YYYY-MM-DD&limit=10
// 配布員名・スタッフIDでスケジュールを検索（現地巡回割り当て用）
export async function GET(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const date = searchParams.get('date');
    const limit = Math.min(20, parseInt(searchParams.get('limit') || '10'));

    if (q.length < 2) {
      return NextResponse.json([]);
    }

    const where: any = {
      OR: [
        { distributor: { name: { contains: q } } },
        { distributor: { staffId: { contains: q } } },
      ],
      distributorId: { not: null },
    };

    if (date) {
      where.date = new Date(date);
    }

    const schedules = await prisma.distributionSchedule.findMany({
      where,
      include: {
        distributor: { select: { id: true, name: true, staffId: true } },
        area: {
          select: {
            town_name: true,
            chome_name: true,
            prefecture: { select: { name: true } },
            city: { select: { name: true } },
          },
        },
        branch: { select: { nameJa: true } },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    const data = schedules.map(s => ({
      id: s.id,
      date: s.date,
      status: s.status,
      distributor: s.distributor,
      area: s.area ? {
        name: `${s.area.prefecture?.name || ''}${s.area.city?.name || ''}${s.area.chome_name || s.area.town_name || ''}`,
      } : null,
      branch: s.branch?.nameJa || null,
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/schedules/search error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
