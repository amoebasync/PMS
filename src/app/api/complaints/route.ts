import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { Prisma } from '@prisma/client';

// 期限計算: 18時前=当日末、18時以降=翌日末（JST基準）
function calcDueDate(): Date {
  const now = new Date();
  const jstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const jstHour = jstNow.getHours();
  const due = new Date(now);
  if (jstHour >= 18) {
    due.setDate(due.getDate() + 1);
  }
  due.setHours(23, 59, 59, 999);
  return due;
}

// GET /api/complaints
// クレーム一覧取得（検索・フィルタ・ページネーション対応）
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const distributorId = searchParams.get('distributorId');
    const branchId = searchParams.get('branchId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const search = searchParams.get('search');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where: Prisma.ComplaintWhereInput = {};

    // ステータスフィルタ
    if (status) {
      where.status = status as Prisma.EnumComplaintStatusFilter;
    }

    // 顧客フィルタ
    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    // 配布員フィルタ
    if (distributorId) {
      where.distributorId = parseInt(distributorId);
    }

    // 支店フィルタ
    if (branchId) {
      where.branchId = parseInt(branchId);
    }

    // 日付範囲フィルタ（occurredAt）
    if (dateFrom || dateTo) {
      where.occurredAt = {};
      if (dateFrom) {
        where.occurredAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.occurredAt.lte = new Date(dateTo);
      }
    }

    // テキスト検索（title, address, description）
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { address: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        include: {
          complaintType: true,
          customer: true,
          distributor: true,
          branch: true,
          assignee: {
            select: { id: true, lastNameJa: true, firstNameJa: true },
          },
          sourcePartner: {
            select: { id: true, name: true },
          },
          _count: {
            select: { responses: true, prohibitedProperties: true, tasks: true },
          },
        },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.complaint.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error('Complaint List Error:', error);
    return NextResponse.json({ error: 'クレーム一覧の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/complaints
// クレーム新規作成（タスク自動作成対応）
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const {
      occurredAt,
      complaintTypeId,
      customerId,
      distributorId,
      scheduleId,
      branchId,
      address,
      buildingName,
      roomNumber,
      latitude,
      longitude,
      title,
      description,
      assigneeId,
      imageUrls,
      // 新フィールド: クレーム元
      source,
      sourceContactName,
      sourceContactPhone,
      sourcePartnerId,
      // タスク連携
      needsResponse,
      needsCustomerReport,
      responseTaskAssigneeId,
      responseTaskContent,
      customerReportAssigneeId,
      customerReportContent,
      customerReportCustomerId,
    } = body;

    if (!occurredAt || !address || !title || !description) {
      return NextResponse.json(
        { error: '必須項目（occurredAt, address, title, description）を入力してください' },
        { status: 400 }
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      // 1. クレーム作成
      const complaint = await tx.complaint.create({
        data: {
          occurredAt: new Date(occurredAt),
          complaintTypeId: complaintTypeId ? Number(complaintTypeId) : null,
          customerId: customerId ? Number(customerId) : null,
          distributorId: distributorId ? Number(distributorId) : null,
          scheduleId: scheduleId ? Number(scheduleId) : null,
          branchId: branchId ? Number(branchId) : null,
          address,
          buildingName: buildingName || null,
          roomNumber: roomNumber || null,
          latitude: latitude != null ? Number(latitude) : null,
          longitude: longitude != null ? Number(longitude) : null,
          title,
          description,
          assigneeId: assigneeId ? Number(assigneeId) : null,
          imageUrls: imageUrls ? JSON.stringify(imageUrls) : null,
          // 新フィールド
          source: source || null,
          sourceContactName: sourceContactName || null,
          sourceContactPhone: sourceContactPhone || null,
          sourcePartnerId: sourcePartnerId ? Number(sourcePartnerId) : null,
          needsResponse: !!needsResponse,
          needsCustomerReport: !!needsCustomerReport,
        },
        include: {
          complaintType: true,
          customer: true,
          distributor: true,
          branch: true,
          assignee: {
            select: { id: true, lastNameJa: true, firstNameJa: true },
          },
          sourcePartner: {
            select: { id: true, name: true },
          },
        },
      });

      // 2. タスク自動作成: 「クレーム対応が必要」
      if (needsResponse && responseTaskContent && responseTaskAssigneeId) {
        const complaintCategory = await tx.taskCategoryMaster.findFirst({
          where: { code: 'COMPLAINT' },
        });
        await tx.task.create({
          data: {
            title: `【クレーム対応】${title}`,
            description: responseTaskContent,
            dueDate: calcDueDate(),
            priority: 'HIGH',
            assigneeId: Number(responseTaskAssigneeId),
            complaintId: complaint.id,
            categoryId: complaintCategory?.id || null,
            createdById: actorId,
          },
        });
      }

      // 3. タスク自動作成: 「顧客報告が必要」
      if (needsCustomerReport && customerReportContent && customerReportAssigneeId) {
        const complaintCategory = await tx.taskCategoryMaster.findFirst({
          where: { code: 'COMPLAINT' },
        });
        const reportCustomerId = customerReportCustomerId
          ? Number(customerReportCustomerId)
          : (customerId ? Number(customerId) : null);
        await tx.task.create({
          data: {
            title: `【顧客報告】${title}`,
            description: customerReportContent,
            dueDate: calcDueDate(),
            priority: 'HIGH',
            customerId: reportCustomerId,
            assigneeId: Number(customerReportAssigneeId),
            complaintId: complaint.id,
            categoryId: complaintCategory?.id || null,
            createdById: actorId,
          },
        });
      }

      // 4. 監査ログ
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'Complaint',
        targetId: complaint.id,
        afterData: complaint as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `クレーム「${complaint.title}」を登録`,
        tx,
      });

      return complaint;
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Complaint Create Error:', error);
    return NextResponse.json({ error: 'クレームの登録に失敗しました' }, { status: 500 });
  }
}
