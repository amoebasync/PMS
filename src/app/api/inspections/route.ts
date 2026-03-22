import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { Prisma } from '@prisma/client';

// GET /api/inspections
// 現地確認一覧取得（フィルタ・ページネーション対応）
export async function GET(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const searchParams = request.nextUrl.searchParams;
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const inspectorId = searchParams.get('inspectorId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '20')));

    const where: Prisma.FieldInspectionWhereInput = {};

    if (date) {
      where.inspectedAt = {
        gte: new Date(`${date}T00:00:00`),
        lt: new Date(`${date}T23:59:59.999`),
      };
    }

    if (status) {
      where.status = status as Prisma.EnumFieldInspectionStatusFilter;
    }

    if (category) {
      where.category = category as Prisma.EnumInspectionCategoryFilter;
    }

    if (inspectorId) {
      where.inspectorId = parseInt(inspectorId);
    }

    const [data, total] = await Promise.all([
      prisma.fieldInspection.findMany({
        where,
        include: {
          distributor: {
            select: { id: true, name: true, staffId: true },
          },
          inspector: {
            select: { id: true, lastNameJa: true, firstNameJa: true },
          },
          schedule: {
            select: {
              id: true,
              date: true,
              area: {
                include: {
                  prefecture: { select: { name: true } },
                  city: { select: { name: true } },
                },
              },
            },
          },
          _count: {
            select: { checkpoints: true, prohibitedChecks: true },
          },
        },
        orderBy: { inspectedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.fieldInspection.count({ where }),
    ]);

    return NextResponse.json({
      data,
      total,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error('GET /api/inspections error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST /api/inspections
// スケジュールから現地確認を作成
export async function POST(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const body = await request.json();
    const { scheduleId, inspectorId, category, inspectedAt } = body;

    if (!scheduleId || !inspectorId) {
      return NextResponse.json(
        { error: 'scheduleId と inspectorId は必須です' },
        { status: 400 }
      );
    }

    // スケジュールから配布員IDを取得
    const schedule = await prisma.distributionSchedule.findUnique({
      where: { id: parseInt(scheduleId) },
      select: { id: true, distributorId: true },
    });

    if (!schedule) {
      return NextResponse.json({ error: 'スケジュールが見つかりません' }, { status: 404 });
    }

    if (!schedule.distributorId) {
      return NextResponse.json({ error: 'このスケジュールには配布員が割り当てられていません' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const inspection = await prisma.$transaction(async (tx) => {
      const created = await tx.fieldInspection.create({
        data: {
          scheduleId: schedule.id,
          distributorId: schedule.distributorId!,
          inspectorId: parseInt(inspectorId),
          category: category || 'CHECK',
          inspectedAt: inspectedAt ? new Date(inspectedAt) : new Date(),
          status: 'PENDING',
        },
        include: {
          distributor: { select: { id: true, name: true, staffId: true } },
          inspector: { select: { id: true, lastNameJa: true, firstNameJa: true } },
          schedule: {
            select: {
              id: true,
              date: true,
              area: {
                include: {
                  prefecture: { select: { name: true } },
                  city: { select: { name: true } },
                },
              },
            },
          },
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'FieldInspection',
        targetId: created.id,
        afterData: created as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `現地確認を作成（配布員: ${created.distributor.name}）`,
        tx,
      });

      return created;
    });

    return NextResponse.json(inspection, { status: 201 });
  } catch (err) {
    console.error('POST /api/inspections error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
