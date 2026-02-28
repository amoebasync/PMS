import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/prohibited-properties
// 管理者: 配布禁止物件一覧（検索・フィルタ・ページネーション対応）
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const prefecture = searchParams.get('prefecture');
    const city = searchParams.get('city');
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');
    const customerId = searchParams.get('customerId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));

    const where: Prisma.ProhibitedPropertyWhereInput = {};

    if (prefecture) {
      where.prefectureId = parseInt(prefecture);
    }
    if (city) {
      where.cityId = parseInt(city);
    }
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (customerId) {
      where.customerId = parseInt(customerId);
    }
    if (search) {
      where.OR = [
        { address: { contains: search } },
        { buildingName: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.prohibitedProperty.findMany({
        where,
        include: {
          prefecture: true,
          city: true,
          area: true,
          customer: { select: { id: true, name: true, customerCode: true } },
          prohibitedReason: true,
          complaint: { select: { id: true, title: true, status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.prohibitedProperty.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error('ProhibitedProperty Fetch Error:', error);
    return NextResponse.json({ error: '配布禁止物件の取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/prohibited-properties
// 管理者: 配布禁止物件を作成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    if (!body.address) {
      return NextResponse.json({ error: '住所は必須です' }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const property = await tx.prohibitedProperty.create({
        data: {
          prefectureId: body.prefectureId ? Number(body.prefectureId) : null,
          cityId: body.cityId ? Number(body.cityId) : null,
          areaId: body.areaId ? Number(body.areaId) : null,
          postalCode: body.postalCode || null,
          address: body.address,
          buildingName: body.buildingName || null,
          roomNumber: body.roomNumber || null,
          latitude: body.latitude ? Number(body.latitude) : null,
          longitude: body.longitude ? Number(body.longitude) : null,
          boundaryGeojson: body.boundaryGeojson || null,
          unitCount: body.unitCount ? Number(body.unitCount) : null,
          severity: body.severity !== undefined && body.severity !== null && body.severity !== '' ? Number(body.severity) : 3,
          customerId: body.customerId ? Number(body.customerId) : null,
          prohibitedReasonId: body.prohibitedReasonId ? Number(body.prohibitedReasonId) : null,
          reasonDetail: body.reasonDetail || null,
          originalCode: body.originalCode || null,
          externalCustomerCode: body.externalCustomerCode || null,
          imageUrls: body.imageUrls || null,
          isActive: body.isActive !== false,
          complaintId: body.complaintId ? Number(body.complaintId) : null,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'ProhibitedProperty',
        targetId: property.id,
        afterData: property as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布禁止物件「${property.address}${property.buildingName ? ' ' + property.buildingName : ''}」を作成`,
        tx,
      });

      return property;
    });

    return NextResponse.json(created);
  } catch (error) {
    console.error('ProhibitedProperty Create Error:', error);
    return NextResponse.json({ error: '配布禁止物件の作成に失敗しました' }, { status: 500 });
  }
}

// PUT /api/prohibited-properties?id=X
// 管理者: 配布禁止物件を更新
export async function PUT(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.prohibitedProperty.findUnique({ where: { id } });
    if (!beforeData) {
      return NextResponse.json({ error: '配布禁止物件が見つかりません' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const property = await tx.prohibitedProperty.update({
        where: { id },
        data: {
          prefectureId: body.prefectureId !== undefined ? (body.prefectureId ? Number(body.prefectureId) : null) : undefined,
          cityId: body.cityId !== undefined ? (body.cityId ? Number(body.cityId) : null) : undefined,
          areaId: body.areaId !== undefined ? (body.areaId ? Number(body.areaId) : null) : undefined,
          postalCode: body.postalCode !== undefined ? (body.postalCode || null) : undefined,
          address: body.address !== undefined ? body.address : undefined,
          buildingName: body.buildingName !== undefined ? (body.buildingName || null) : undefined,
          roomNumber: body.roomNumber !== undefined ? (body.roomNumber || null) : undefined,
          latitude: body.latitude !== undefined ? (body.latitude ? Number(body.latitude) : null) : undefined,
          longitude: body.longitude !== undefined ? (body.longitude ? Number(body.longitude) : null) : undefined,
          boundaryGeojson: body.boundaryGeojson !== undefined ? (body.boundaryGeojson || null) : undefined,
          unitCount: body.unitCount !== undefined ? (body.unitCount ? Number(body.unitCount) : null) : undefined,
          severity: body.severity !== undefined ? (body.severity !== null && body.severity !== '' ? Number(body.severity) : null) : undefined,
          customerId: body.customerId !== undefined ? (body.customerId ? Number(body.customerId) : null) : undefined,
          prohibitedReasonId: body.prohibitedReasonId !== undefined ? (body.prohibitedReasonId ? Number(body.prohibitedReasonId) : null) : undefined,
          reasonDetail: body.reasonDetail !== undefined ? (body.reasonDetail || null) : undefined,
          originalCode: body.originalCode !== undefined ? (body.originalCode || null) : undefined,
          externalCustomerCode: body.externalCustomerCode !== undefined ? (body.externalCustomerCode || null) : undefined,
          imageUrls: body.imageUrls !== undefined ? (body.imageUrls || null) : undefined,
          isActive: body.isActive !== undefined ? body.isActive : undefined,
          deactivatedAt: body.deactivatedAt !== undefined ? (body.deactivatedAt ? new Date(body.deactivatedAt) : null) : undefined,
          deactivateReason: body.deactivateReason !== undefined ? (body.deactivateReason || null) : undefined,
          complaintId: body.complaintId !== undefined ? (body.complaintId ? Number(body.complaintId) : null) : undefined,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'UPDATE',
        targetModel: 'ProhibitedProperty',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: property as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布禁止物件「${property.address}${property.buildingName ? ' ' + property.buildingName : ''}」を更新`,
        tx,
      });

      return property;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('ProhibitedProperty Update Error:', error);
    return NextResponse.json({ error: '配布禁止物件の更新に失敗しました' }, { status: 500 });
  }
}

// DELETE /api/prohibited-properties?id=X
// 管理者: 配布禁止物件を論理削除（isActive=false）
export async function DELETE(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '');
    if (!id) return NextResponse.json({ error: 'IDが必要です' }, { status: 400 });

    let deactivateReason: string | null = null;
    try {
      const body = await request.json();
      deactivateReason = body.deactivateReason || null;
    } catch {
      // body is optional for DELETE
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const beforeData = await prisma.prohibitedProperty.findUnique({ where: { id } });
    if (!beforeData) {
      return NextResponse.json({ error: '配布禁止物件が見つかりません' }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const property = await tx.prohibitedProperty.update({
        where: { id },
        data: {
          isActive: false,
          deactivatedAt: new Date(),
          deactivateReason,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'DELETE',
        targetModel: 'ProhibitedProperty',
        targetId: id,
        beforeData: beforeData as unknown as Record<string, unknown>,
        afterData: property as unknown as Record<string, unknown>,
        ipAddress: ip,
        description: `配布禁止物件「${beforeData.address}${beforeData.buildingName ? ' ' + beforeData.buildingName : ''}」を無効化`,
        tx,
      });

      return property;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('ProhibitedProperty Delete Error:', error);
    return NextResponse.json({ error: '配布禁止物件の削除に失敗しました' }, { status: 500 });
  }
}
