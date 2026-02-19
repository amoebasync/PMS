import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

    for (const s of schedules) {
      // マスタとの紐付け（安全に文字列同士で比較）
      const branch = branches.find(b => b.nameJa.includes(s.branchName) || s.branchName.includes(b.nameJa));
      const distributor = distributors.find(d => String(d.staffId) === String(s.distributorStaffId));
      const city = cities.find(c => String(c.name) === String(s.cityName));
      
      // ★ ここが原因でした！ a.addressCode ではなく a.address_code で比較します
      const area = areas.find(a => String(a.address_code) === String(s.areaCode));

      const hasActual = s.items.some((item: any) => item.actualCount !== null);
      const status = hasActual ? 'COMPLETED' : 'UNSTARTED';

      const baseDate = s.date ? new Date(s.date) : null;

      const createdSchedule = await prisma.distributionSchedule.create({
        data: {
          jobNumber: s.jobNumber,
          date: baseDate,
          distributorId: distributor?.id || null,
          branchId: branch?.id || null,
          cityId: city?.id || null,
          areaId: area?.id || null, // ★ これでバッチリIDが入るようになります！
          areaUnitPrice: s.areaUnitPrice,
          sizeUnitPrice: s.sizeUnitPrice,
          remarks: s.remarks,
          status: status, 
        }
      });

      for (const item of s.items) {
        // 顧客コードも安全に文字列で比較
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
      importedCount++;
    }

    return NextResponse.json({ success: true, count: importedCount });
  } catch (error) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: 'Failed to import data' }, { status: 500 });
  }
}