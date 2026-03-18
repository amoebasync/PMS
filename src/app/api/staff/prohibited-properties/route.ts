import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// GET /api/staff/prohibited-properties?areaId=X&customerIds=1,2,3
// 配布エリア内の配布禁止物件一覧を取得
// customerIds: 配布するチラシのクライアントID（カンマ区切り）
//   → customerId IS NULL（全顧客禁止）+ customerId IN (指定ID) の物件を返す
//   → 未指定の場合は全禁止物件を返す（後方互換）
export async function GET(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const url = new URL(request.url);
    const areaIdParam = url.searchParams.get('areaId');

    if (!areaIdParam) {
      return NextResponse.json({ error: 'areaId は必須です' }, { status: 400 });
    }

    const areaId = parseInt(areaIdParam);
    if (isNaN(areaId)) {
      return NextResponse.json({ error: 'areaId が不正です' }, { status: 400 });
    }

    // customerIds フィルタ（オプション）
    const customerIdsParam = url.searchParams.get('customerIds');
    const customerIds = customerIdsParam
      ? customerIdsParam.split(',').map(Number).filter((n) => !isNaN(n))
      : null;

    const properties = await prisma.prohibitedProperty.findMany({
      where: {
        areaId: areaId,
        isActive: true,
        // customerIds 指定時: 全顧客禁止(null) + 指定クライアント限定の禁止物件
        ...(customerIds && customerIds.length > 0
          ? { OR: [{ customerId: null }, { customerId: { in: customerIds } }] }
          : {}),
      },
      select: {
        id: true,
        address: true,
        buildingName: true,
        latitude: true,
        longitude: true,
        boundaryGeojson: true,
        prohibitedReason: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    // Map to flat response structure for the mobile app
    const result = properties.map((p) => ({
      id: p.id,
      address: p.address,
      buildingName: p.buildingName,
      latitude: p.latitude,
      longitude: p.longitude,
      boundaryGeojson: p.boundaryGeojson,
      pinColorHex: '#FF0000',
      reasonName: p.prohibitedReason?.name ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('Prohibited Properties Staff API Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
