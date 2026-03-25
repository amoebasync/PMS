import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { Prisma } from '@prisma/client';

export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const branchId = searchParams.get('branchId');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where: Prisma.DistributorExpenseWhereInput = {};

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    if (branchId) {
      where.distributor = { branchId: parseInt(branchId) };
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      const searchCondition: Prisma.FlyerDistributorWhereInput = {
        OR: [
          { name: { contains: search } },
          { staffId: { contains: search } },
        ],
      };
      if (where.distributor) {
        where.distributor = { AND: [where.distributor, searchCondition] };
      } else {
        where.distributor = searchCondition;
      }
    }

    const [data, total] = await Promise.all([
      prisma.distributorExpense.findMany({
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
        orderBy: [
          { date: 'desc' },
          { distributor: { name: 'asc' } },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.distributorExpense.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('DistributorExpense List Error:', error);
    return NextResponse.json({ error: '経費一覧の取得に失敗しました' }, { status: 500 });
  }
}
