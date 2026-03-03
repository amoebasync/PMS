import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

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
    const distributorId = searchParams.get('distributorId');
    const search = searchParams.get('search');
    const status = searchParams.get('status');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where: Prisma.DistributorShiftWhereInput = {};

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) where.date.lte = new Date(dateTo);
    }

    if (branchId) {
      where.distributor = { branchId: parseInt(branchId) };
    }

    if (distributorId) {
      where.distributorId = parseInt(distributorId);
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
      prisma.distributorShift.findMany({
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
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.distributorShift.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('DistributorShift List Error:', error);
    return NextResponse.json({ error: 'シフト一覧の取得に失敗しました' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { distributorId, date, note } = body;

    if (!distributorId || !date) {
      return NextResponse.json({ error: '配布員IDと日付は必須です' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const created = await prisma.$transaction(async (tx) => {
      const shift = await tx.distributorShift.create({
        data: {
          distributorId: parseInt(distributorId),
          date: new Date(date),
          status: 'WORKING',
          note: note || null,
        },
        include: {
          distributor: {
            select: { id: true, name: true, staffId: true, branch: { select: { id: true, nameJa: true } } },
          },
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'DistributorShift',
        targetId: shift.id,
        afterData: shift as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布員シフト作成: ${shift.distributor.name} (${new Date(date).toISOString().split('T')[0]})`,
        tx,
      });

      return shift;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'この配布員はこの日付に既にシフトが登録されています' }, { status: 409 });
    }
    console.error('DistributorShift Create Error:', error);
    return NextResponse.json({ error: 'シフトの作成に失敗しました' }, { status: 500 });
  }
}
