import { NextResponse } from 'next/server';
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

    // パートナー案件かどうか判定（配列 = 通常、オブジェクト = パートナー案件）
    const isPartnerImport = !Array.isArray(body) && body.partnerId;
    const schedules = isPartnerImport ? body.schedules : body;
    let importedCount = 0;

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

    // パートナー案件時: 受注を自動作成
    let createdOrder: { id: number; orderNo: string } | null = null;
    if (isPartnerImport) {
      const orderNo = `ORD-${Date.now()}`;
      createdOrder = await prisma.order.create({
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

    // インポート中に新規作成した配布員をキャッシュ（同一staffIdの重複作成防止）
    const newDistributorCache = new Map<string, { id: number }>();
    let newDistributorCount = 0;

    // ── スケジュールをバッチ作成（20件ずつ並列） ──
    const allItemsData: any[] = [];
    const pendingSessions: { scheduleId: number; distributorId: number; startedAt: Date; finishedAt: Date | null; milestones: { count: number; time: string | null }[]; dateStr: string }[] = [];

    // 新規配布員の事前一括作成（ループ内のawaitを削減）
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
    // 新規配布員を一括作成
    for (const sd of staffIdsToCreate) {
      const newDist = await prisma.flyerDistributor.create({
        data: sd,
        select: { id: true, staffId: true },
      });
      newDistributorCache.set(sd.staffId, newDist);
      newDistributorCount++;
    }

    // スケジュールを20件ずつバッチ処理
    const BATCH_SIZE = 20;
    for (let i = 0; i < schedules.length; i += BATCH_SIZE) {
      const batch = schedules.slice(i, i + BATCH_SIZE);
      const createdSchedules = await Promise.all(
        batch.map(async (s: any) => {
          const branch = s.branchName
            ? branches.find(b => b.nameJa.includes(s.branchName) || s.branchName.includes(b.nameJa))
            : null;
          const distributor = s.distributorStaffId
            ? (distributorMap.get(String(s.distributorStaffId)) || newDistributorCache.get(String(s.distributorStaffId)) || null)
            : null;
          const city = s.cityName ? cityMap.get(String(s.cityName)) || null : null;
          const area = s.areaCode ? areaMap.get(String(s.areaCode)) || null : null;
          const baseDate = s.date ? new Date(s.date) : null;

          const created = await prisma.distributionSchedule.create({
            data: {
              jobNumber: s.jobNumber,
              date: baseDate,
              distributorId: distributor?.id || null,
              branchId: branch?.id || null,
              cityId: city?.id || null,
              areaId: area?.id || null,
              areaUnitPrice: s.areaUnitPrice != null ? s.areaUnitPrice : undefined,
              sizeUnitPrice: s.sizeUnitPrice != null ? s.sizeUnitPrice : undefined,
              remarks: s.remarks || undefined,
              status: 'COMPLETED',
            }
          });
          return { schedule: created, source: s, distributor, baseDate };
        })
      );

      // バッチ結果からアイテムとセッションデータを収集
      for (const { schedule, source: s, distributor, baseDate } of createdSchedules) {
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
            scheduleId: schedule.id,
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

        if (s.startTime && distributor) {
          const startedAt = new Date(`${s.date}T${s.startTime}:00+09:00`);
          const finishedAt = s.endTime ? new Date(`${s.date}T${s.endTime}:00+09:00`) : null;
          pendingSessions.push({
            scheduleId: schedule.id,
            distributorId: distributor.id,
            startedAt,
            finishedAt,
            milestones: s.milestones || [],
            dateStr: s.date,
          });
        }
      }

      importedCount += createdSchedules.length;
    }

    // ── 一括挿入フェーズ ──

    // DistributionItem を一括作成
    if (allItemsData.length > 0) {
      await prisma.distributionItem.createMany({ data: allItemsData });
    }

    // DistributionSession を20件ずつ並列作成 + ProgressEvent を一括作成
    if (pendingSessions.length > 0) {
      const allProgressData: any[] = [];

      for (let i = 0; i < pendingSessions.length; i += BATCH_SIZE) {
        const batch = pendingSessions.slice(i, i + BATCH_SIZE);
        const sessions = await Promise.all(
          batch.map(sess =>
            prisma.distributionSession.create({
              data: {
                scheduleId: sess.scheduleId,
                distributorId: sess.distributorId,
                startedAt: sess.startedAt,
                finishedAt: sess.finishedAt,
              },
              select: { id: true },
            })
          )
        );

        sessions.forEach((session, idx) => {
          const sess = batch[idx];
          if (sess.milestones && Array.isArray(sess.milestones)) {
            for (const m of sess.milestones) {
              if (m.time) {
                allProgressData.push({
                  sessionId: session.id,
                  mailboxCount: m.count,
                  timestamp: new Date(`${sess.dateStr}T${m.time}:00+09:00`),
                });
              }
            }
          }
        });
      }

      if (allProgressData.length > 0) {
        await prisma.progressEvent.createMany({ data: allProgressData });
      }
    }

    return NextResponse.json({
      success: true,
      count: importedCount,
      newDistributorCount,
      ...(createdOrder ? { orderNo: createdOrder.orderNo, orderId: createdOrder.id } : {}),
    });
  } catch (error) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}
