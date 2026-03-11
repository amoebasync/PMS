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

    const branches = await prisma.branch.findMany();
    const distributors = await prisma.flyerDistributor.findMany();
    const cities = await prisma.city.findMany();
    const areas = await prisma.area.findMany();
    const customers = await prisma.customer.findMany();

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

    // バッチ用の配列: アイテムとプログレスイベントをまとめて createMany で一括挿入
    const allItemsData: any[] = [];
    const pendingSessions: { scheduleId: number; distributorId: number; startedAt: Date; finishedAt: Date | null; milestones: { count: number; time: string | null }[]; dateStr: string }[] = [];

    for (const s of schedules) {
      // マスタとの紐付け（安全に文字列同士で比較）
      const branch = s.branchName
        ? branches.find(b => b.nameJa.includes(s.branchName) || s.branchName.includes(b.nameJa))
        : null;
      let distributor = distributors.find(d => String(d.staffId) === String(s.distributorStaffId));

      // 配布員が見つからない場合、staffId + staffName で自動登録
      if (!distributor && s.distributorStaffId) {
        const cachedDist = newDistributorCache.get(String(s.distributorStaffId));
        if (cachedDist) {
          distributor = cachedDist as any;
        } else {
          const newDist = await prisma.flyerDistributor.create({
            data: {
              staffId: String(s.distributorStaffId),
              name: s.staffName || `スタッフ${s.distributorStaffId}`,
              branchId: branch?.id || null,
            }
          });
          newDistributorCache.set(String(s.distributorStaffId), newDist);
          distributor = newDist as any;
          newDistributorCount++;
        }
      }

      // cityName from CSV or fallback to area lookup
      const city = s.cityName
        ? cities.find(c => String(c.name) === String(s.cityName))
        : null;

      const area = areas.find(a => String(a.address_code) === String(s.areaCode));

      const baseDate = s.date ? new Date(s.date) : null;

      const createdSchedule = await prisma.distributionSchedule.create({
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

      // アイテムデータを収集（後で一括挿入）
      for (const item of s.items) {
        const customer = customers.find(c => String(c.customerCode) === String(item.customerCode));

        // パートナー案件時: 単価ルックアップ
        let billingUnitPrice: number | null = null;
        if (isPartnerImport && flyerPrices.length > 0 && item.flyerName) {
          const fn = String(item.flyerName).trim();
          const cc = item.customerCode ? String(item.customerCode).trim() : null;
          const fc = item.flyerCode ? String(item.flyerCode).trim() : null;
          // 優先1: flyerName + customerCode + flyerCode 完全一致
          let match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === fc);
          // 優先2: flyerName + customerCode（flyerCode=null）
          if (!match && cc) {
            match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === null);
          }
          // 優先3: flyerName のみ（customerCode=null, flyerCode=null）
          if (!match) {
            match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === null && p.flyerCode === null);
          }
          if (match) billingUnitPrice = match.unitPrice;
        }

        allItemsData.push({
          scheduleId: createdSchedule.id,
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

      // セッション情報を収集（後でまとめて処理）
      if (s.startTime && distributor) {
        const startedAt = new Date(`${s.date}T${s.startTime}:00+09:00`);
        const finishedAt = s.endTime ? new Date(`${s.date}T${s.endTime}:00+09:00`) : null;
        pendingSessions.push({
          scheduleId: createdSchedule.id,
          distributorId: distributor.id,
          startedAt,
          finishedAt,
          milestones: s.milestones || [],
          dateStr: s.date,
        });
      }

      importedCount++;
    }

    // ── 一括挿入フェーズ ──

    // DistributionItem を一括作成（数百件を1クエリで処理）
    if (allItemsData.length > 0) {
      await prisma.distributionItem.createMany({ data: allItemsData });
    }

    // DistributionSession + ProgressEvent を処理
    if (pendingSessions.length > 0) {
      const allProgressData: any[] = [];

      for (const sess of pendingSessions) {
        const session = await prisma.distributionSession.create({
          data: {
            scheduleId: sess.scheduleId,
            distributorId: sess.distributorId,
            startedAt: sess.startedAt,
            finishedAt: sess.finishedAt,
          }
        });

        // ProgressEvent データを収集
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
      }

      // ProgressEvent を一括作成
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
