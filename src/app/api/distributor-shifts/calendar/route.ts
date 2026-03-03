import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const branchId = searchParams.get('branchId');

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ error: 'dateFrom, dateTo は必須です' }, { status: 400 });
    }

    const where: Prisma.DistributorShiftWhereInput = {
      date: {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      },
    };

    if (branchId) {
      where.distributor = { branchId: parseInt(branchId) };
    }

    const shifts = await prisma.distributorShift.findMany({
      where,
      include: {
        distributor: {
          select: {
            id: true,
            name: true,
            staffId: true,
            branch: { select: { id: true, nameJa: true } },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { distributor: { name: 'asc' } }],
    });

    return NextResponse.json({ data: shifts });
  } catch (error) {
    console.error('DistributorShift Calendar Error:', error);
    return NextResponse.json({ error: 'カレンダーデータの取得に失敗しました' }, { status: 500 });
  }
}
