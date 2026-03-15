import { NextResponse } from 'next/server';
import { ScheduleStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';


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
    const { error } = await requireAdminSession();
    if (error) return error;

    const body = await request.json();

    // パートナー案件かどうか判定（配列 = 通常（後方互換）、オブジェクト = 新形式 or パートナー案件）
    const isPartnerImport = !Array.isArray(body) && body.partnerId;
    const schedules = Array.isArray(body) ? body : body.schedules;
    const importStatus = ((!Array.isArray(body) && body.importStatus) || 'COMPLETED') as ScheduleStatus;

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: true, count: 0, newDistributorCount: 0 });
    }

    // ── インポートデータから必要なキーを事前収集 ──
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

    if (staffIdsToCreate.length > 0) {
      await prisma.flyerDistributor.createMany({ data: staffIdsToCreate, skipDuplicates: true });
      const newDists = await prisma.flyerDistributor.findMany({
        where: { staffId: { in: staffIdsToCreate.map(s => s.staffId) } },
        select: { id: true, staffId: true },
      });
      for (const nd of newDists) {
        newDistributorCache.set(String(nd.staffId), { id: nd.id });
      }
      newDistributorCount = newDists.length;
    }

    // ── 既存スケジュールの検索（date + jobNumber で upsert 判定） ──
    const jobDatePairs: { jobNumber: string; date: string }[] = [];
    for (const s of schedules) {
      if (s.jobNumber && s.date) {
        jobDatePairs.push({ jobNumber: String(s.jobNumber), date: s.date });
      }
    }

    const existingSchedules = jobDatePairs.length > 0
      ? await prisma.distributionSchedule.findMany({
          where: {
            OR: jobDatePairs.map(p => ({
              jobNumber: p.jobNumber,
              date: new Date(p.date),
            })),
          },
          select: { id: true, jobNumber: true, date: true },
        })
      : [];

    // date+jobNumber → existing schedule id のマップ
    const existingMap = new Map<string, number>();
    for (const es of existingSchedules) {
      if (es.jobNumber && es.date) {
        const key = `${es.date.toISOString().split('T')[0]}_${es.jobNumber}`;
        existingMap.set(key, es.id);
      }
    }

    // ── トランザクションで一括処理（upsert対応） ──
    const result = await prisma.$transaction(async (tx) => {
      // パートナー案件時: 受注を作成 or 既存IDを使用（チャンク送信対応）
      let createdOrder: { id: number; orderNo: string } | null = null;
      if (isPartnerImport) {
        if (body.orderId) {
          const existing = await tx.order.findUnique({ where: { id: body.orderId }, select: { id: true, orderNo: true } });
          createdOrder = existing;
        } else {
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

      // ── スケジュール作成/更新（10件ずつ並列） ──
      const allItemsData: any[] = [];
      const pendingSessions: { scheduleId: number; distributorId: number; startedAt: Date; finishedAt: Date | null; milestones: { count: number; time: string | null }[]; dateStr: string }[] = [];
      let importedCount = 0;
      let updatedCount = 0;

      // インポートで作成/更新したスケジュールIDを追跡（後のクリーンアップ用）
      const importedScheduleIds = new Set<number>();
      // 配布員+日付の組み合わせを追跡（古いスケジュールのクリーンアップ用）
      const distributorDatePairs = new Map<string, { distributorId: number; date: Date }>();

      const BATCH = 10;
      for (let i = 0; i < schedules.length; i += BATCH) {
        const batch = schedules.slice(i, i + BATCH);
        const results = await Promise.all(
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

            const scheduleData = {
              jobNumber: s.jobNumber || null,
              date: baseDate,
              distributorId: distributor?.id || null,
              branchId: branch?.id || null,
              cityId: city?.id || null,
              areaId: area?.id || null,
              areaUnitPrice: s.areaUnitPrice != null ? Number(s.areaUnitPrice) : undefined,
              sizeUnitPrice: s.sizeUnitPrice != null ? Number(s.sizeUnitPrice) : undefined,
              remarks: s.remarks || undefined,
              status: importStatus,
            };

            // upsert 判定: date + jobNumber で既存レコードを検索
            const lookupKey = s.jobNumber && s.date ? `${s.date}_${s.jobNumber}` : null;
            const existingId = lookupKey ? existingMap.get(lookupKey) : null;

            let schedule: { id: number };
            let isUpdate = false;

            if (existingId) {
              // ── 既存スケジュールを更新（エリア・チラシ含む全フィールド） ──
              const existing = await tx.distributionSchedule.findUnique({
                where: { id: existingId },
                select: { id: true, status: true },
              });
              const isDistributing = existing?.status === 'DISTRIBUTING';
              if (isDistributing) {
                // 配布中のスケジュールはステータスを上書きしない
                delete (scheduleData as any).status;
              }
              schedule = await tx.distributionSchedule.update({
                where: { id: existingId },
                data: scheduleData,
                select: { id: true },
              });

              // チラシ（items）は常に削除→再作成（配布中でも最新データに更新）
              await tx.distributionItem.deleteMany({ where: { scheduleId: existingId } });

              if (!isDistributing) {
                // 配布中でない場合: セッションを更新（削除せず残す）
                const oldSession = await tx.distributionSession.findUnique({ where: { scheduleId: existingId }, select: { id: true } });
                if (oldSession) {
                  // セッションの時間を更新、progressは再作成
                  await tx.progressEvent.deleteMany({ where: { sessionId: oldSession.id } });
                }
              }
              isUpdate = true;
            } else {
              // ── 新規作成 ──
              schedule = await tx.distributionSchedule.create({ data: scheduleData });
            }

            // 追跡用に記録
            importedScheduleIds.add(schedule.id);
            if (distributor?.id && baseDate) {
              const pairKey = `${distributor.id}_${baseDate.toISOString().split('T')[0]}`;
              distributorDatePairs.set(pairKey, { distributorId: distributor.id, date: baseDate });
            }

            return { schedule, source: s, distributor, baseDate, isUpdate };
          })
        );

        for (const { schedule, source: s, distributor, baseDate, isUpdate } of results) {
          for (const item of s.items || []) {
            const customer = item.customerCode ? customerMap.get(String(item.customerCode)) || null : null;

            let billingUnitPrice: number | null = null;
            if (isPartnerImport && flyerPrices.length > 0 && item.flyerName) {
              const fn = String(item.flyerName).trim();
              const cc = item.customerCode ? String(item.customerCode).trim() : null;
              const fc = item.flyerCode ? String(item.flyerCode).trim() : null;
              let match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === fc);
              if (!match && cc) match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === null);
              if (!match) match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === null && p.flyerCode === null);
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

          // 配布中(DISTRIBUTING)のスケジュールや既存セッションが残っている場合はスキップ
          if (s.startTime && distributor && importStatus === 'COMPLETED') {
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

          if (isUpdate) updatedCount++; else importedCount++;
        }
      }

      // DistributionItem 一括作成
      if (allItemsData.length > 0) {
        await tx.distributionItem.createMany({ data: allItemsData });
      }

      // DistributionSession upsert + ProgressEvent 一括作成
      if (pendingSessions.length > 0) {
        const allProgressData: any[] = [];

        for (let i = 0; i < pendingSessions.length; i += BATCH) {
          const batch = pendingSessions.slice(i, i + BATCH);
          const sessions = await Promise.all(
            batch.map(async sess => {
              // 既存セッションがある場合は時間を更新（配布中はそのまま、完了済みも保持）
              const existing = await tx.distributionSession.findUnique({
                where: { scheduleId: sess.scheduleId },
                select: { id: true },
              });
              if (existing) {
                // 配布中でなければ時間を更新
                const schedule = await tx.distributionSchedule.findUnique({
                  where: { id: sess.scheduleId },
                  select: { status: true },
                });
                if (schedule?.status !== 'DISTRIBUTING') {
                  await tx.distributionSession.update({
                    where: { id: existing.id },
                    data: {
                      startedAt: sess.startedAt,
                      finishedAt: sess.finishedAt,
                    },
                  });
                }
                return existing;
              }
              return tx.distributionSession.create({
                data: {
                  scheduleId: sess.scheduleId,
                  distributorId: sess.distributorId,
                  startedAt: sess.startedAt,
                  finishedAt: sess.finishedAt,
                },
                select: { id: true },
              });
            })
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
          await tx.progressEvent.createMany({ data: allProgressData });
        }
      }

      // ── 古いスケジュールのクリーンアップ ──
      // 同じ配布員+日付で、今回のインポートに含まれない古いスケジュールを削除
      // （エリア変更等で jobNumber が変わった場合、古いスケジュールが残るのを防ぐ）
      let cleanedCount = 0;
      if (distributorDatePairs.size > 0) {
        for (const { distributorId, date } of distributorDatePairs.values()) {
          const oldSchedules = await tx.distributionSchedule.findMany({
            where: {
              distributorId,
              date,
              id: { notIn: [...importedScheduleIds] },
              status: { not: 'DISTRIBUTING' },
            },
            select: { id: true },
          });

          for (const old of oldSchedules) {
            // 関連データを削除してからスケジュールを削除
            const oldSession = await tx.distributionSession.findUnique({ where: { scheduleId: old.id }, select: { id: true } });
            if (oldSession) {
              await tx.progressEvent.deleteMany({ where: { sessionId: oldSession.id } });
              await tx.distributionSession.delete({ where: { id: oldSession.id } });
            }
            await tx.distributionItem.deleteMany({ where: { scheduleId: old.id } });
            await tx.distributionSchedule.delete({ where: { id: old.id } });
            cleanedCount++;
          }
        }
      }

      return { importedCount, updatedCount, cleanedCount, createdOrder };
    }, { timeout: 120000 });

    return NextResponse.json({
      success: true,
      count: result.importedCount,
      updatedCount: result.updatedCount,
      cleanedCount: result.cleanedCount,
      newDistributorCount,
      ...(result.createdOrder ? { orderNo: result.createdOrder.orderNo, orderId: result.createdOrder.id } : {}),
    });
  } catch (error) {
    console.error('Import Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to import data';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
