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
    const schedules = await request.json();
    let importedCount = 0;

    const branches = await prisma.branch.findMany();
    const distributors = await prisma.flyerDistributor.findMany();
    const cities = await prisma.city.findMany();
    const areas = await prisma.area.findMany();
    const customers = await prisma.customer.findMany();

    // インポート中に新規作成した配布員をキャッシュ（同一staffIdの重複作成防止）
    const newDistributorCache = new Map<string, { id: number }>();
    let newDistributorCount = 0;

    for (const s of schedules) {
      // マスタとの紐付け（安全に文字列同士で比較）
      const branch = branches.find(b => b.nameJa.includes(s.branchName) || s.branchName.includes(b.nameJa));
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

      for (const item of s.items) {
        const customer = customers.find(c => String(c.customerCode) === String(item.customerCode));

        await prisma.distributionItem.create({
          data: {
            scheduleId: createdSchedule.id,
            slotIndex: item.slotIndex,
            flyerName: item.flyerName,
            flyerCode: item.flyerCode,
            customerId: customer?.id || null,
            startDate: baseDate ? parseDayString(s.date, item.startDateStr) : null,
            endDate: baseDate ? parseDayString(s.date, item.endDateStr) : null,
            spareDate: baseDate ? parseDayString(s.date, item.spareDateStr) : null,
            method: item.method,
            plannedCount: item.plannedCount,
            actualCount: item.actualCount,
          }
        });
      }

      // DistributionSession + ProgressEvent 作成
      if (s.startTime && distributor) {
        const startedAt = new Date(`${s.date}T${s.startTime}:00+09:00`);
        const finishedAt = s.endTime ? new Date(`${s.date}T${s.endTime}:00+09:00`) : null;

        const session = await prisma.distributionSession.create({
          data: {
            scheduleId: createdSchedule.id,
            distributorId: distributor.id,
            startedAt,
            finishedAt,
          }
        });

        // ProgressEvent（500〜2500枚マイルストーン）
        if (s.milestones && Array.isArray(s.milestones)) {
          for (const m of s.milestones) {
            if (m.time) {
              await prisma.progressEvent.create({
                data: {
                  sessionId: session.id,
                  mailboxCount: m.count,
                  timestamp: new Date(`${s.date}T${m.time}:00+09:00`),
                }
              });
            }
          }
        }
      }

      importedCount++;
    }

    return NextResponse.json({ success: true, count: importedCount, newDistributorCount });
  } catch (error) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}
