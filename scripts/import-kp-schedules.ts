/**
 * ケイ・アンド・パートナーズ スケジュール一括インポート
 * - 日付ごとに受注(Order)を作成
 * - 新規配布員は isActive=false で登録
 * - 単価マスタがあれば billingUnitPrice を自動セット
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const fs = require('fs');

const FILE_PATH = '/Users/kuenheekim/Downloads/ケイ・アンド・パートナーズインポートスケジュール';
const PARTNER_ID = 3;

// Column indices (from header)
const COL = {
  BRANCH: 4, DATE: 7, STAFF_CODE: 10, STAFF_NAME: 11,
  JOB_NUMBER: 19, CITY_NAME: 20, AREA_CODE: 22,
  AREA_UNIT_PRICE: 5, SIZE_UNIT_PRICE: 6,
  REMARKS: 26,
  START_TIME: 81, END_TIME: 87,
  MILESTONES: [82, 83, 84, 85, 86], // 500,1000,1500,2000,2500
};
const FLYER_STARTS = [27, 36, 45, 54, 63, 72]; // チラシ1〜6

function parseDateStr(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = dateStr.replace(/\//g, '-');
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseDayString(baseDateStr: string, dayStr: string): Date | null {
  if (!dayStr || !baseDateStr) return null;
  if (dayStr.match(/^\d{4}[\/-]\d{2}[\/-]\d{2}$/)) {
    return new Date(dayStr.replace(/\//g, '-'));
  }
  const match = dayStr.match(/(\d+)日/);
  if (match) {
    const day = parseInt(match[1], 10);
    const base = new Date(baseDateStr.replace(/\//g, '-'));
    return new Date(base.getFullYear(), base.getMonth(), day);
  }
  return null;
}

function parseTime(val: string | undefined): string | null {
  if (!val) return null;
  const s = val.trim();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s;
  return null;
}

function parseFloat2(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseFloat(val.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function parseInt2(val: string | undefined): number | null {
  if (!val || val.trim() === '') return null;
  const n = parseInt(val.replace(/,/g, ''), 10);
  return isNaN(n) ? null : n;
}

async function main() {
  const content = fs.readFileSync(FILE_PATH, 'utf-8') as string;
  const lines = content.split('\n');
  const header = lines[0].split('\t');
  const dataLines = lines.slice(1).filter((l: string) => l.trim());

  console.log(`Header columns: ${header.length}`);
  console.log(`Data rows: ${dataLines.length}`);

  // Load master data
  const branches = await prisma.branch.findMany();
  const distributors = await prisma.flyerDistributor.findMany();
  const cities = await prisma.city.findMany();
  const areas = await prisma.area.findMany({ select: { id: true, address_code: true } });
  const customers = await prisma.customer.findMany({ select: { id: true, customerCode: true } });
  const flyerPrices = await prisma.partnerFlyerPrice.findMany({
    where: { partnerId: PARTNER_ID },
  });

  console.log(`Master: ${branches.length} branches, ${distributors.length} distributors, ${areas.length} areas, ${customers.length} customers, ${flyerPrices.length} prices`);

  // Parse all rows
  type ParsedRow = {
    date: string;
    branchName: string | null;
    staffCode: string | null;
    staffName: string | null;
    jobNumber: string | null;
    cityName: string | null;
    areaCode: string | null;
    areaUnitPrice: number | null;
    sizeUnitPrice: number | null;
    remarks: string | null;
    startTime: string | null;
    endTime: string | null;
    milestones: { count: number; time: string | null }[];
    items: {
      slotIndex: number;
      flyerName: string;
      customerCode: string | null;
      flyerCode: string | null;
      startDateStr: string | null;
      endDateStr: string | null;
      spareDateStr: string | null;
      method: string | null;
      plannedCount: number | null;
      actualCount: number | null;
    }[];
  };

  const parsedRows: ParsedRow[] = [];
  let skipped = 0;

  for (const line of dataLines) {
    const cols = line.split('\t');
    const dateStr = cols[COL.DATE]?.trim();
    if (!dateStr || !/^\d{4}\//.test(dateStr)) {
      skipped++;
      continue;
    }

    const items: ParsedRow['items'] = [];
    for (let i = 0; i < FLYER_STARTS.length; i++) {
      const fi = FLYER_STARTS[i];
      const flyerName = cols[fi]?.trim();
      if (flyerName) {
        items.push({
          slotIndex: i + 1,
          flyerName,
          customerCode: cols[fi + 1]?.trim() || null,
          flyerCode: cols[fi + 2]?.trim() || null,
          startDateStr: cols[fi + 3]?.trim() || null,
          endDateStr: cols[fi + 4]?.trim() || null,
          spareDateStr: cols[fi + 5]?.trim() || null,
          method: cols[fi + 6]?.trim() || null,
          plannedCount: parseInt2(cols[fi + 7]),
          actualCount: parseInt2(cols[fi + 8]),
        });
      }
    }

    const milestones = COL.MILESTONES.map((mi, idx) => ({
      count: (idx + 1) * 500,
      time: parseTime(cols[mi]),
    }));

    parsedRows.push({
      date: dateStr,
      branchName: cols[COL.BRANCH]?.trim() || null,
      staffCode: cols[COL.STAFF_CODE]?.trim() || null,
      staffName: cols[COL.STAFF_NAME]?.trim() || null,
      jobNumber: cols[COL.JOB_NUMBER]?.trim() || null,
      cityName: cols[COL.CITY_NAME]?.trim() || null,
      areaCode: cols[COL.AREA_CODE]?.trim() || null,
      areaUnitPrice: parseFloat2(cols[COL.AREA_UNIT_PRICE]),
      sizeUnitPrice: parseFloat2(cols[COL.SIZE_UNIT_PRICE]),
      remarks: cols[COL.REMARKS]?.trim() || null,
      startTime: parseTime(cols[COL.START_TIME]),
      endTime: parseTime(cols[COL.END_TIME]),
      milestones,
      items,
    });
  }

  console.log(`Parsed: ${parsedRows.length} rows, skipped: ${skipped} rows`);

  // Group by date
  const byDate = new Map<string, ParsedRow[]>();
  for (const row of parsedRows) {
    const group = byDate.get(row.date) || [];
    group.push(row);
    byDate.set(row.date, group);
  }
  console.log(`Unique dates: ${byDate.size}`);

  // Cache for newly created distributors
  const newDistributorCache = new Map<string, { id: number }>();
  let newDistributorCount = 0;
  let totalSchedules = 0;
  let totalItems = 0;
  let orderCount = 0;

  // Price lookup function
  function lookupPrice(flyerName: string, customerCode: string | null, flyerCode: string | null): number | null {
    if (flyerPrices.length === 0) return null;
    const fn = flyerName.trim();
    const cc = customerCode?.trim() || null;
    const fc = flyerCode?.trim() || null;
    let match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === fc);
    if (!match && cc) {
      match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === null);
    }
    if (!match) {
      match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === null && p.flyerCode === null);
    }
    return match ? match.unitPrice : null;
  }

  // Process each date
  for (const [dateStr, rows] of Array.from(byDate.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const dateFormatted = dateStr.replace(/\//g, '-');

    // Create Order for this date
    const orderNo = `ORD-KP-${dateFormatted}`;
    const order = await prisma.order.create({
      data: {
        orderNo,
        title: `株式会社ケイ・アンド・パートナーズ ${dateStr}`,
        orderSource: 'PARTNER_IMPORT',
        partnerId: PARTNER_ID,
        orderDate: new Date(dateFormatted),
        status: 'COMPLETED',
      },
    });
    orderCount++;

    for (const s of rows) {
      // Branch lookup
      const branch = s.branchName
        ? branches.find(b => b.nameJa.includes(s.branchName!) || s.branchName!.includes(b.nameJa))
        : null;

      // Distributor lookup
      let distributor = s.staffCode
        ? distributors.find(d => String(d.staffId) === s.staffCode)
        : null;

      // Create new distributor if not found (inactive)
      if (!distributor && s.staffCode) {
        const cached = newDistributorCache.get(s.staffCode);
        if (cached) {
          distributor = cached as any;
        } else {
          const newDist = await prisma.flyerDistributor.create({
            data: {
              staffId: s.staffCode,
              name: s.staffName || `スタッフ${s.staffCode}`,
              ...(branch ? { branch: { connect: { id: branch.id } } } : {}),
              leaveDate: new Date('2025-01-01'),
              note: 'パートナーインポートで自動登録（無効）',
            },
          });
          newDistributorCache.set(s.staffCode, newDist);
          distributor = newDist as any;
          newDistributorCount++;
        }
      }

      // City/Area lookup
      const city = s.cityName ? cities.find(c => c.name === s.cityName) : null;
      const area = s.areaCode ? areas.find(a => a.address_code === s.areaCode) : null;

      const baseDate = parseDateStr(s.date);

      // Create DistributionSchedule
      const schedule = await prisma.distributionSchedule.create({
        data: {
          jobNumber: s.jobNumber,
          date: baseDate,
          distributorId: (distributor as any)?.id || null,
          branchId: branch?.id || null,
          cityId: city?.id || null,
          areaId: area?.id || null,
          areaUnitPrice: s.areaUnitPrice ?? undefined,
          sizeUnitPrice: s.sizeUnitPrice ?? undefined,
          remarks: s.remarks || undefined,
          status: 'COMPLETED',
        },
      });
      totalSchedules++;

      // Create DistributionItems
      for (const item of s.items) {
        const customer = item.customerCode
          ? customers.find(c => String(c.customerCode) === item.customerCode)
          : null;

        const billingUnitPrice = lookupPrice(item.flyerName, item.customerCode, item.flyerCode);

        await prisma.distributionItem.create({
          data: {
            scheduleId: schedule.id,
            slotIndex: item.slotIndex,
            flyerName: item.flyerName,
            flyerCode: item.flyerCode,
            customerId: customer?.id || null,
            orderId: order.id,
            startDate: baseDate ? parseDayString(s.date, item.startDateStr) : null,
            endDate: baseDate ? parseDayString(s.date, item.endDateStr) : null,
            spareDate: baseDate ? parseDayString(s.date, item.spareDateStr) : null,
            method: item.method,
            plannedCount: item.plannedCount,
            actualCount: item.actualCount,
            billingUnitPrice,
          },
        });
        totalItems++;
      }

      // Create DistributionSession + ProgressEvents
      if (s.startTime && distributor) {
        const startedAt = new Date(`${s.date.replace(/\//g, '-')}T${s.startTime}:00+09:00`);
        const finishedAtRaw = s.endTime ? new Date(`${s.date.replace(/\//g, '-')}T${s.endTime}:00+09:00`) : null;
        const finishedAt = finishedAtRaw && !isNaN(finishedAtRaw.getTime()) ? finishedAtRaw : null;

        if (isNaN(startedAt.getTime())) continue; // skip invalid time

        const session = await prisma.distributionSession.create({
          data: {
            scheduleId: schedule.id,
            distributorId: (distributor as any).id,
            startedAt,
            finishedAt,
          },
        });

        for (const m of s.milestones) {
          if (m.time) {
            const ts = new Date(`${s.date.replace(/\//g, '-')}T${m.time}:00+09:00`);
            if (!isNaN(ts.getTime())) {
              await prisma.progressEvent.create({
                data: {
                  sessionId: session.id,
                  mailboxCount: m.count,
                  timestamp: ts,
                },
              });
            }
          }
        }
      }
    }

    if (orderCount % 20 === 0) {
      console.log(`  Progress: ${orderCount} orders, ${totalSchedules} schedules...`);
    }
  }

  console.log('\n=== Import Complete ===');
  console.log(`Orders created: ${orderCount}`);
  console.log(`Schedules created: ${totalSchedules}`);
  console.log(`Items created: ${totalItems}`);
  console.log(`New distributors (inactive): ${newDistributorCount}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
