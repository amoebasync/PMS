import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import polyline from '@mapbox/polyline';

interface ImportRow {
  PROHIBITED_CD?: string;
  CLIENT_CD?: string;
  POSTAL_CD?: string;
  ADDRESS_CD?: string;
  ADDRESS?: string;
  BUILDING_NM?: string;
  ROOM_NO?: string;
  LATITUDE?: number;
  LONGITUDE?: number;
  POLYLINE_PATH?: string;
  REMARK?: string;
}

/**
 * polyline エンコード文字列を GeoJSON Polygon に変換する
 */
function polylineToGeojson(encoded: string): string {
  const coords = polyline.decode(encoded); // returns [[lat, lng], ...]
  // GeoJSON uses [lng, lat] order
  const ring = coords.map(([lat, lng]: [number, number]) => [lng, lat]);
  // Close the ring
  if (ring.length > 0 && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
    ring.push(ring[0]);
  }
  const geojson = {
    type: 'Polygon',
    coordinates: [ring],
  };
  return JSON.stringify(geojson);
}

// POST /api/prohibited-properties/import
// 管理者: CSVインポート（パース済みの行配列を受け取る）
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const rows: ImportRow[] = body.rows;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'インポートデータが空です' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    let success = 0;
    let skipped = 0;
    const errors: { row: number; message: string }[] = [];

    // 顧客コードのキャッシュ（同一バッチ内で重複ルックアップを避ける）
    const customerCache = new Map<string, number | null>();
    // エリアコードのキャッシュ
    const areaCache = new Map<string, { areaId: number; prefectureId: number; cityId: number } | null>();

    // 100件ずつ処理
    const CHUNK_SIZE = 100;
    for (let chunkStart = 0; chunkStart < rows.length; chunkStart += CHUNK_SIZE) {
      const chunk = rows.slice(chunkStart, chunkStart + CHUNK_SIZE);

      for (let i = 0; i < chunk.length; i++) {
        const rowIndex = chunkStart + i + 1; // 1-based row number
        const row = chunk[i];

        try {
          if (!row.ADDRESS) {
            errors.push({ row: rowIndex, message: 'ADDRESS（住所）が空です' });
            skipped++;
            continue;
          }

          // 顧客IDの解決
          let customerId: number | null = null;
          if (row.CLIENT_CD) {
            if (customerCache.has(row.CLIENT_CD)) {
              customerId = customerCache.get(row.CLIENT_CD) ?? null;
            } else {
              const customer = await prisma.customer.findFirst({
                where: { customerCode: row.CLIENT_CD },
                select: { id: true },
              });
              customerId = customer?.id ?? null;
              customerCache.set(row.CLIENT_CD, customerId);
            }
          }
          // CLIENT_CDが空の場合: customerId = null（全顧客禁止）

          // エリア・都道府県・市区町村の解決
          let prefectureId: number | null = null;
          let cityId: number | null = null;
          let areaId: number | null = null;

          if (row.ADDRESS_CD && row.ADDRESS_CD.length >= 5) {
            if (areaCache.has(row.ADDRESS_CD)) {
              const cached = areaCache.get(row.ADDRESS_CD);
              if (cached) {
                areaId = cached.areaId;
                prefectureId = cached.prefectureId;
                cityId = cached.cityId;
              }
            } else {
              // ADDRESS_CDが11桁のエリアコードの場合
              const area = await prisma.area.findFirst({
                where: { address_code: row.ADDRESS_CD },
                select: { id: true, prefecture_id: true, city_id: true },
              });

              if (area) {
                areaId = area.id;
                prefectureId = area.prefecture_id;
                cityId = area.city_id;
                areaCache.set(row.ADDRESS_CD, { areaId: area.id, prefectureId: area.prefecture_id, cityId: area.city_id });
              } else {
                // エリアが見つからない場合、都道府県・市区町村コードから解決を試みる
                const prefCode = parseInt(row.ADDRESS_CD.substring(0, 2));
                const cityCode = row.ADDRESS_CD.substring(0, 5);

                if (!isNaN(prefCode)) {
                  const pref = await prisma.prefecture.findUnique({
                    where: { id: prefCode },
                    select: { id: true },
                  });
                  if (pref) prefectureId = pref.id;
                }

                const city = await prisma.city.findFirst({
                  where: { code: cityCode },
                  select: { id: true },
                });
                if (city) cityId = city.id;

                areaCache.set(row.ADDRESS_CD, null);
              }
            }
          }

          // ポリライン→GeoJSON変換
          let boundaryGeojson: string | null = null;
          if (row.POLYLINE_PATH) {
            try {
              boundaryGeojson = polylineToGeojson(row.POLYLINE_PATH);
            } catch (err) {
              console.error(`Row ${rowIndex}: Polyline decode error:`, err);
              // ポリライン変換失敗でもレコードは作成する
            }
          }

          await prisma.prohibitedProperty.create({
            data: {
              originalCode: row.PROHIBITED_CD || null,
              externalCustomerCode: row.CLIENT_CD || null,
              postalCode: row.POSTAL_CD || null,
              address: row.ADDRESS,
              buildingName: row.BUILDING_NM || null,
              roomNumber: row.ROOM_NO || null,
              latitude: row.LATITUDE ? Number(row.LATITUDE) : null,
              longitude: row.LONGITUDE ? Number(row.LONGITUDE) : null,
              boundaryGeojson,
              customerId,
              prefectureId,
              cityId,
              areaId,
              reasonDetail: row.REMARK || null,
              isActive: true,
              importedAt: new Date(),
            },
          });

          success++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ row: rowIndex, message });
          skipped++;
        }
      }
    }

    // インポート全体の監査ログ（トランザクション外）
    await writeAuditLog({
      actorType: 'EMPLOYEE',
      actorId,
      actorName,
      action: 'CREATE',
      targetModel: 'ProhibitedProperty',
      ipAddress: ip,
      afterData: {
        importType: 'CSV_BATCH',
        totalRows: rows.length,
        success,
        skipped,
        errorCount: errors.length,
      },
      description: `配布禁止物件CSVインポート: ${success}件成功, ${skipped}件スキップ, ${errors.length}件エラー`,
    });

    return NextResponse.json({ success, skipped, errors });
  } catch (error) {
    console.error('ProhibitedProperty Import Error:', error);
    return NextResponse.json({ error: 'CSVインポートに失敗しました' }, { status: 500 });
  }
}
