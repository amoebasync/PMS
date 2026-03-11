import { NextResponse } from 'next/server';
import { Prisma, ScheduleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';


// "16日(月)" や "2026-02-18" などを適切に処理して Date型を作る
function parseDayString(baseDateStr: string, dayStr: string) {
  if (!dayStr || !baseDateStr) return null;

  if (dayStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return new Date(dayStr);
  }

  const match = dayStr.match(/(\d+)日/);
  if (match) {
    const day = parseInt(match[1], 10);
    const baseDate = new Date(baseDateStr);
    return new Date(baseDate.getFullYear(), baseDate.getMonth(), day);
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // パートナー案件かどうか判定（配列 = 通常（後方互換）、オブジェクト = 新形式 or パートナー案件）
    const isPartnerImport = !Array.isArray(body) && body.partnerId;
    const schedules = Array.isArray(body) ? body : body.schedules;
    const importStatus = ((!Array.isArray(body) && body.importStatus) || 'COMPLETED') as ScheduleStatus;

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: true, count: 0, newDistributorCount: 0 });
    }

    // ── インポートデータから必要なキーを事前収集（必要なレコードだけ取得するため） ──
    const uniqueAreaCodes = new Set<string>();
    const uniqueStaffIds = new Set<string>();
    const uniqueCityNames = new Set<string>();
    const uniqueCustomerCodes = new Set<string>();
    for (const s of schedules) {
      if (s.areaCode) uniqueAreaCodes.add(String(s.areaCode));
      if (s.distributorStaffId) uniqueStaffIds.add(String(s.distributorStaffId));
      if (s.cityName) uniqueCityNames.add(String(s.cityName));
      for (const item of s.items || []) {
        if (item.customerCode) uniqueCustomerCodes.add(String(item.customerCode));
      }
    }

    // ── マスタデータを並列取得（必要な列・レコードのみ） ──
    const [branches, distributors, cities, areas, customers] = await Promise.all([
      prisma.branch.findMany({ select: { id: true, nameJa: true } }),
      uniqueStaffIds.size > 0
        ? prisma.flyerDistributor.findMany({
            where: { staffId: { in: [...uniqueStaffIds] } },
            select: { id: true, staffId: true },
          })
        : Promise.resolve([]),
      uniqueCityNames.size > 0
        ? prisma.city.findMany({
            where: { name: { in: [...uniqueCityNames] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      uniqueAreaCodes.size > 0
        ? prisma.area.findMany({
            where: { address_code: { in: [...uniqueAreaCodes] } },
            select: { id: true, address_code: true },
          })
        : Promise.resolve([]),
      uniqueCustomerCodes.size > 0
        ? prisma.customer.findMany({
            where: { customerCode: { in: [...uniqueCustomerCodes] } },
            select: { id: true, customerCode: true },
          })
        : Promise.resolve([]),
    ]);

    // ルックアップ用Map（O(1)検索）
    const distributorMap = new Map(distributors.map(d => [String(d.staffId), d]));
    const cityMap = new Map(cities.map(c => [String(c.name), c]));
    const areaMap = new Map(areas.map(a => [String(a.address_code), a]));
    const customerMap = new Map(customers.map(c => [String(c.customerCode), c]));

    // パートナー案件時: 単価マスタを取得
    let flyerPrices: { flyerName: string; customerCode: string | null; flyerCode: string | null; unitPrice: number }[] = [];
    if (isPartnerImport) {
      flyerPrices = await prisma.partnerFlyerPrice.findMany({
        where: { partnerId: body.partnerId },
        select: { flyerName: true, customerCode: true, flyerCode: true, unitPrice: true },
      });
    }

    // ── 新規配布員の事前一括作成 ──
    const newDistributorCache = new Map<string, { id: number }>();
    let newDistributorCount = 0;

    const staffIdsToCreate: { staffId: string; name: string; branchId: number | null }[] = [];
    for (const s of schedules) {
      if (s.distributorStaffId && !distributorMap.has(String(s.distributorStaffId))) {
        const sid = String(s.distributorStaffId);
        if (!newDistributorCache.has(sid) && !staffIdsToCreate.find(x => x.staffId === sid)) {
          const branch = s.branchName
            ? branches.find(b => b.nameJa.includes(s.branchName) || s.branchName.includes(b.nameJa))
            : null;
          staffIdsToCreate.push({
            staffId: sid,
            name: s.staffName || `スタッフ${s.distributorStaffId}`,
            branchId: branch?.id || null,
          });
        }
      }
    }

    // 新規配布員を一括作成 → findManyでID取得（createManyはMySQLでIDを返さないため）
    if (staffIdsToCreate.length > 0) {
      await prisma.flyerDistributor.createMany({
        data: staffIdsToCreate,
        skipDuplicates: true,
      });
      const newDists = await prisma.flyerDistributor.findMany({
        where: { staffId: { in: staffIdsToCreate.map(s => s.staffId) } },
        select: { id: true, staffId: true },
      });
      for (const nd of newDists) {
        newDistributorCache.set(String(nd.staffId), { id: nd.id });
      }
      newDistributorCount = newDists.length;
    }

    // ── トランザクションで一括挿入（bulk INSERT + LAST_INSERT_ID） ──
    const result = await prisma.$transaction(async (tx) => {
      // パートナー案件時: 受注を作成 or 既存IDを使用（チャンク送信対応）
      let createdOrder: { id: number; orderNo: string } | null = null;
      if (isPartnerImport) {
        if (body.orderId) {
          // 2回目以降のチャンク: 既存受注IDを使用
          const existing = await tx.order.findUnique({ where: { id: body.orderId }, select: { id: true, orderNo: true } });
          createdOrder = existing;
        } else {
          // 1回目のチャンク: 受注を新規作成
          const orderNo = `ORD-${Date.now()}`;
          createdOrder = await tx.order.create({
            data: {
              orderNo,
              title: body.orderTitle || null,
              orderSource: 'PARTNER_IMPORT',
              partnerId: body.partnerId,
              orderDate: new Date(),
              status: 'COMPLETED',
            },
            select: { id: true, orderNo: true },
          });
        }
      }

      // スケジュールデータを事前準備
      const prepared = schedules.map((s: any) => {
        const branch = s.branchName
          ? branches.find(b => b.nameJa.includes(s.branchName) || s.branchName.includes(b.nameJa))
          : null;
        const distributor = s.distributorStaffId
          ? (distributorMap.get(String(s.distributorStaffId)) || newDistributorCache.get(String(s.distributorStaffId)) || null)
          : null;
        const city = s.cityName ? cityMap.get(String(s.cityName)) || null : null;
        const area = s.areaCode ? areaMap.get(String(s.areaCode)) || null : null;
        const baseDate = s.date ? new Date(s.date) : null;
        return { source: s, branch, distributor, city, area, baseDate };
      });

      // ── スケジュール bulk INSERT ──
      const schedValues = prepared.map(p =>
        Prisma.sql`(${p.source.jobNumber || null}, ${p.baseDate}, ${p.distributor?.id ?? null}, ${p.branch?.id ?? null}, ${p.city?.id ?? null}, ${p.area?.id ?? null}, ${p.source.areaUnitPrice != null ? Number(p.source.areaUnitPrice) : null}, ${p.source.sizeUnitPrice != null ? Number(p.source.sizeUnitPrice) : null}, ${p.source.remarks || null}, ${importStatus}, NOW(), NOW())`
      );

      await tx.$executeRaw(Prisma.sql`
        INSERT INTO distribution_schedules (job_number, \`date\`, distributor_id, branch_id, city_id, area_id, area_unit_price, size_unit_price, remarks, status, created_at, updated_at)
        VALUES ${Prisma.join(schedValues)}
      `);

      // LAST_INSERT_ID() で先頭IDを取得 → auto_increment連番でマッピング
      const [{ fid }] = await tx.$queryRaw<[{ fid: bigint }]>(
        Prisma.sql`SELECT LAST_INSERT_ID() AS fid`
      );
      const firstScheduleId = Number(fid);

      // ── アイテム・セッションデータを収集 ──
      const allItemsData: any[] = [];
      const sessionPrep: {
        scheduleId: number; distributorId: number;
        startedAt: Date; finishedAt: Date | null;
        milestones: { count: number; time: string | null }[];
        dateStr: string;
      }[] = [];

      for (let i = 0; i < prepared.length; i++) {
        const scheduleId = firstScheduleId + i;
        const { source: s, distributor, baseDate } = prepared[i];

        for (const item of s.items || []) {
          const customer = item.customerCode ? customerMap.get(String(item.customerCode)) || null : null;

          let billingUnitPrice: number | null = null;
          if (isPartnerImport && flyerPrices.length > 0 && item.flyerName) {
            const fn = String(item.flyerName).trim();
            const cc = item.customerCode ? String(item.customerCode).trim() : null;
            const fc = item.flyerCode ? String(item.flyerCode).trim() : null;
            let match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === fc);
            if (!match && cc) {
              match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === null);
            }
            if (!match) {
              match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === null && p.flyerCode === null);
            }
            if (match) billingUnitPrice = match.unitPrice;
          }

          allItemsData.push({
            scheduleId,
            slotIndex: item.slotIndex,
            flyerName: item.flyerName,
            flyerCode: item.flyerCode,
            customerId: customer?.id || null,
            orderId: createdOrder?.id || null,
            startDate: baseDate ? parseDayString(s.date, item.startDateStr) : null,
            endDate: baseDate ? parseDayString(s.date, item.endDateStr) : null,
            spareDate: baseDate ? parseDayString(s.date, item.spareDateStr) : null,
            method: item.method,
            plannedCount: item.plannedCount,
            actualCount: item.actualCount,
            billingUnitPrice,
          });
        }

        if (s.startTime && distributor && importStatus === 'COMPLETED') {
          const startedAt = new Date(`${s.date}T${s.startTime}:00+09:00`);
          const finishedAt = s.endTime ? new Date(`${s.date}T${s.endTime}:00+09:00`) : null;
          sessionPrep.push({
            scheduleId,
            distributorId: distributor.id,
            startedAt,
            finishedAt,
            milestones: s.milestones || [],
            dateStr: s.date,
          });
        }
      }

      // ── DistributionItem 一括作成 ──
      if (allItemsData.length > 0) {
        await tx.distributionItem.createMany({ data: allItemsData });
      }

      // ── DistributionSession bulk INSERT + ProgressEvent 一括作成 ──
      if (sessionPrep.length > 0) {
        const sessValues = sessionPrep.map(s =>
          Prisma.sql`(${s.scheduleId}, ${s.distributorId}, ${s.startedAt}, ${s.finishedAt}, NOW(), NOW())`
        );

        await tx.$executeRaw(Prisma.sql`
          INSERT INTO distribution_sessions (schedule_id, distributor_id, started_at, finished_at, created_at, updated_at)
          VALUES ${Prisma.join(sessValues)}
        `);

        const [{ fid: firstSessId }] = await tx.$queryRaw<[{ fid: bigint }]>(
          Prisma.sql`SELECT LAST_INSERT_ID() AS fid`
        );
        const firstSessionId = Number(firstSessId);

        const allProgressData: any[] = [];
        for (let i = 0; i < sessionPrep.length; i++) {
          const sessionId = firstSessionId + i;
          for (const m of sessionPrep[i].milestones) {
            if (m.time) {
              allProgressData.push({
                sessionId,
                mailboxCount: m.count,
                timestamp: new Date(`${sessionPrep[i].dateStr}T${m.time}:00+09:00`),
              });
            }
          }
        }

        if (allProgressData.length > 0) {
          await tx.progressEvent.createMany({ data: allProgressData });
        }
      }

      return { importedCount: prepared.length, createdOrder };
    }, { timeout: 120000 }); // 2分タイムアウト

    return NextResponse.json({
      success: true,
      count: result.importedCount,
      newDistributorCount,
      ...(result.createdOrder ? { orderNo: result.createdOrder.orderNo, orderId: result.createdOrder.id } : {}),
    });
  } catch (error) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}
