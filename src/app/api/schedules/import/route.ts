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

/** チラシの一致判定用キーを生成（flyerCodeのソート済みリスト） */
function buildFlyerKey(items: { flyerName?: string | null; flyerCode?: string | null }[]): string {
  return items
    .filter(i => i.flyerName)
    .map(i => (i.flyerCode || i.flyerName || '').trim())
    .sort()
    .join('|');
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
    const isLastChunk: boolean = Array.isArray(body) ? true : (body.isLastChunk !== false);
    const keepIdsFromPrev: number[] = (!Array.isArray(body) && body.keepIds) || [];

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: true, count: 0, newDistributorCount: 0, matchedIds: [], createdIds: [] });
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

    // ── マスタデータを並列取得 ──
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

    // ── 既存スケジュールの取得（配布員+エリア+チラシで一致判定） ──
    const importDates = Array.from(new Set((schedules as any[]).map(s => String(s.date)).filter(d => d && d !== 'undefined')));
    const existingSchedulesWithItems = importDates.length > 0
      ? await prisma.distributionSchedule.findMany({
          where: { date: { in: importDates.map((d: string) => new Date(d)) } },
          include: {
            items: { select: { flyerName: true, flyerCode: true } },
            session: { select: { id: true, finishedAt: true } },
          },
        })
      : [];

    // distributorId_areaId → 既存スケジュールリスト（同じ配布員+エリアで複数ある可能性）
    const existingByDistArea = new Map<string, typeof existingSchedulesWithItems>();
    for (const es of existingSchedulesWithItems) {
      if (es.distributorId != null && es.areaId != null) {
        const key = `${es.distributorId}_${es.areaId}`;
        const list = existingByDistArea.get(key) || [];
        list.push(es);
        existingByDistArea.set(key, list);
      }
    }

    // ── トランザクションで一括処理 ──
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

      const matchedIds: number[] = [];
      const createdIds: number[] = [];
      const allItemsData: any[] = [];
      const pendingSessions: { scheduleId: number; distributorId: number; startedAt: Date; finishedAt: Date | null; milestones: { count: number; time: string | null }[]; dateStr: string }[] = [];
      let importedCount = 0;
      let updatedCount = 0;
      const importedDates = new Set<string>();

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

            if (baseDate) {
              importedDates.add(baseDate.toISOString().split('T')[0]);
            }

            const distributorId = distributor?.id || null;
            const areaId = area?.id || null;

            // ── 既存スケジュールとの一致判定 ──
            // 同じ配布員 + 同じエリアの既存スケジュールを検索
            let matchedExisting: (typeof existingSchedulesWithItems)[0] | null = null;
            let flyersMatch = false;

            if (distributorId && areaId) {
              const daKey = `${distributorId}_${areaId}`;
              const candidates = existingByDistArea.get(daKey) || [];
              const importFlyerKey = buildFlyerKey(s.items || []);

              for (const candidate of candidates) {
                const existingFlyerKey = buildFlyerKey(candidate.items);
                if (importFlyerKey === existingFlyerKey) {
                  matchedExisting = candidate;
                  flyersMatch = true;
                  break;
                }
              }
              // チラシが違っても同じ配布員+エリアなら既存を更新（セッション保持）
              if (!matchedExisting && candidates.length > 0) {
                matchedExisting = candidates[0];
                flyersMatch = false;
              }
            }

            if (matchedExisting) {
              if (flyersMatch) {
                // ── 完全一致: 配布員+エリア+チラシ全て同じ → 更新せずに残す ──
                if (importStatus === 'COMPLETED') {
                  // 完了インポート時のみステータスを更新
                  await tx.distributionSchedule.update({
                    where: { id: matchedExisting.id },
                    data: { status: 'COMPLETED', jobNumber: s.jobNumber || undefined },
                  });
                }
                matchedIds.push(matchedExisting.id);
                return { type: 'matched' as const, scheduleId: matchedExisting.id, source: s, distributor, baseDate };
              } else {
                // ── 部分一致: 配布員+エリアは同じだがチラシが違う → チラシだけ更新、セッション保持 ──
                const hasActiveSession = matchedExisting.session && !matchedExisting.session.finishedAt;
                const updateData: any = {
                  jobNumber: s.jobNumber || null,
                  branchId: branch?.id || null,
                  cityId: city?.id || null,
                  areaUnitPrice: s.areaUnitPrice != null ? Number(s.areaUnitPrice) : undefined,
                  sizeUnitPrice: s.sizeUnitPrice != null ? Number(s.sizeUnitPrice) : undefined,
                  remarks: s.remarks || undefined,
                };
                // ステータス更新: COMPLETED インポート時は常に更新、それ以外は配布中なら維持
                if (importStatus === 'COMPLETED') {
                  updateData.status = 'COMPLETED';
                } else if (!hasActiveSession) {
                  updateData.status = importStatus;
                }

                await tx.distributionSchedule.update({
                  where: { id: matchedExisting.id },
                  data: updateData,
                });
                // チラシだけ入れ替え（セッション・GPSはそのまま）
                await tx.distributionItem.deleteMany({ where: { scheduleId: matchedExisting.id } });
                matchedIds.push(matchedExisting.id);
                return { type: 'updated' as const, scheduleId: matchedExisting.id, source: s, distributor, baseDate };
              }
            } else {
              // ── 一致なし: 新規作成 ──
              const schedule = await tx.distributionSchedule.create({
                data: {
                  jobNumber: s.jobNumber || null,
                  date: baseDate,
                  distributorId,
                  branchId: branch?.id || null,
                  cityId: city?.id || null,
                  areaId,
                  areaUnitPrice: s.areaUnitPrice != null ? Number(s.areaUnitPrice) : undefined,
                  sizeUnitPrice: s.sizeUnitPrice != null ? Number(s.sizeUnitPrice) : undefined,
                  remarks: s.remarks || undefined,
                  status: importStatus,
                },
              });
              createdIds.push(schedule.id);
              return { type: 'created' as const, scheduleId: schedule.id, source: s, distributor, baseDate };
            }
          })
        );

        for (const r of results) {
          const { source: s, distributor, baseDate, scheduleId } = r;

          // matched（完全一致）の場合はアイテム作成不要（既存のまま）
          if (r.type === 'matched') {
            updatedCount++;
            continue;
          }

          // updated / created の場合はアイテムを作成
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

          // セッション作成（新規 + COMPLETED インポート + startTime あり）
          if (r.type === 'created' && s.startTime && distributor && importStatus === 'COMPLETED') {
            const startedAt = new Date(`${s.date}T${s.startTime}:00+09:00`);
            const finishedAt = s.endTime ? new Date(`${s.date}T${s.endTime}:00+09:00`) : null;
            pendingSessions.push({
              scheduleId,
              distributorId: distributor.id,
              startedAt,
              finishedAt,
              milestones: s.milestones || [],
              dateStr: s.date,
            });
          }

          if (r.type === 'updated') updatedCount++; else importedCount++;
        }
      }

      // DistributionItem 一括作成
      if (allItemsData.length > 0) {
        await tx.distributionItem.createMany({ data: allItemsData });
      }

      // DistributionSession + ProgressEvent 一括作成（新規作成分のみ）
      if (pendingSessions.length > 0) {
        const allProgressData: any[] = [];

        for (let i = 0; i < pendingSessions.length; i += BATCH) {
          const batch = pendingSessions.slice(i, i + BATCH);
          const sessions = await Promise.all(
            batch.map(async sess => {
              const existing = await tx.distributionSession.findUnique({
                where: { scheduleId: sess.scheduleId },
                select: { id: true },
              });
              if (existing) return existing;
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

      // ── クリーンアップ（最後のチャンクでのみ実行） ──
      // その日のスケジュールを置き換える: マッチしなかったスケジュールを削除
      // ただし配布中（アクティブセッション）のスケジュールは絶対に削除しない
      let cleanedCount = 0;
      if (isLastChunk && importedDates.size > 0) {
        const allKeepIds = new Set([...keepIdsFromPrev, ...matchedIds, ...createdIds]);

        for (const dateStr of importedDates) {
          const candidates = await tx.distributionSchedule.findMany({
            where: {
              date: new Date(dateStr),
              id: { notIn: [...allKeepIds] },
            },
            select: { id: true, status: true, session: { select: { id: true, finishedAt: true } } },
          });

          for (const old of candidates) {
            // 配布中のスケジュールは絶対に削除しない
            const hasActiveSession = old.session && !old.session.finishedAt;
            if (old.status === 'DISTRIBUTING' || hasActiveSession) {
              continue;
            }

            // セッション・関連データを削除（カスケードで GPS/Progress/Skip も消える）
            if (old.session) {
              await tx.distributionSession.delete({ where: { id: old.session.id } });
            }
            await tx.distributionItem.deleteMany({ where: { scheduleId: old.id } });
            await tx.distributionSchedule.delete({ where: { id: old.id } });
            cleanedCount++;
          }
        }
      }

      return { importedCount, updatedCount, matchedIds, createdIds, cleanedCount, createdOrder };
    }, { timeout: 120000 });

    return NextResponse.json({
      success: true,
      count: result.importedCount,
      updatedCount: result.updatedCount,
      matchedCount: result.matchedIds.length,
      cleanedCount: result.cleanedCount,
      matchedIds: result.matchedIds,
      createdIds: result.createdIds,
      newDistributorCount,
      ...(result.createdOrder ? { orderNo: result.createdOrder.orderNo, orderId: result.createdOrder.id } : {}),
    });
  } catch (error) {
    console.error('Import Error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to import data';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
