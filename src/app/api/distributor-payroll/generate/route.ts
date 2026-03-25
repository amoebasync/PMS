import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';


// POST /api/distributor-payroll/generate
// Body: { distributorId: number, weekStart: string (ISO, Sunday) }
// 週次給与を計算して DB に保存（既存レコードは上書き）
export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { distributorId, weekStart } = await request.json();
    if (!distributorId || !weekStart) {
      return NextResponse.json({ error: 'distributorId と weekStart は必須です' }, { status: 400 });
    }

    const periodStart = new Date(weekStart); // Sunday
    periodStart.setHours(0, 0, 0, 0);

    const periodEnd = new Date(periodStart);
    periodEnd.setDate(periodEnd.getDate() + 6); // Saturday
    periodEnd.setHours(23, 59, 59, 999);

    // 翌週金曜日を支払日とする
    const paymentDate = new Date(periodEnd);
    paymentDate.setDate(paymentDate.getDate() + 6); // 土曜の6日後 = 翌週金曜
    paymentDate.setHours(0, 0, 0, 0);

    // 配布員情報取得（レート + 交通費設定）
    const distributor = await prisma.flyerDistributor.findUnique({
      where: { id: parseInt(distributorId) },
      select: {
        id: true,
        rate1Type: true,
        rate2Type: true,
        rate3Type: true,
        rate4Type: true,
        rate5Type: true,
        rate6Type: true,
        transportationFee: true,
        transportationFee1Type: true,
      },
    });

    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    const rates: (number | null)[] = [
      null,                    // index 0 (unused)
      distributor.rate1Type,   // 1 type
      distributor.rate2Type,   // 2 types
      distributor.rate3Type,   // 3 types
      distributor.rate4Type,   // 4 types
      distributor.rate5Type,   // 5 types
      distributor.rate6Type,   // 6 types
    ];

    // 期間内のスケジュール取得（配布アイテム含む）
    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        distributorId: distributor.id,
        date: { gte: periodStart, lte: periodEnd },
      },
      include: {
        items: true,
      },
      orderBy: { date: 'asc' },
    });

    // スケジュール単位で計算
    const payrollItems: {
      date: Date;
      scheduleId: number;
      flyerTypeCount: number;
      baseRate: number;
      areaUnitPrice: number;
      sizeUnitPrice: number;
      unitPrice: number;
      actualCount: number;
      earnedAmount: number;
    }[] = [];

    for (const schedule of schedules) {
      // actualCount が入力されているアイテムのみ対象
      const validItems = schedule.items.filter(
        (item) => item.actualCount !== null && item.actualCount > 0
      );
      if (validItems.length === 0) continue;

      const flyerTypeCount = Math.min(validItems.length, 6);
      const baseRate = rates[flyerTypeCount] ?? 0;
      const areaUnitPrice = schedule.areaUnitPrice ?? 0;
      const sizeUnitPrice = schedule.sizeUnitPrice ?? 0;
      const unitPrice = baseRate + areaUnitPrice + sizeUnitPrice;

      // 投函ポスト数 = 有効アイテムの actualCount の最大値（同エリアへの同時配布）
      const actualCount = Math.max(...validItems.map((i) => i.actualCount ?? 0));
      const earnedAmount = Math.floor(unitPrice * actualCount);

      payrollItems.push({
        date: schedule.date!,
        scheduleId: schedule.id,
        flyerTypeCount,
        baseRate,
        areaUnitPrice,
        sizeUnitPrice,
        unitPrice,
        actualCount,
        earnedAmount,
      });
    }

    // 期間内の承認済み交通費を日別に集計（キャップ適用）
    const expenses = await prisma.distributorExpense.findMany({
      where: {
        distributorId: distributor.id,
        date: { gte: periodStart, lte: periodEnd },
        status: { in: ['APPROVED', 'PENDING'] },
      },
    });

    // 交通費キャップ計算
    const feeSetting = distributor.transportationFee || '1000';
    const fee1TypeSetting = distributor.transportationFee1Type || '500';
    const isFull = feeSetting === 'FULL';
    const personalCap = isFull ? Infinity : parseInt(feeSetting) || 1000;
    const personal1TypeCap = fee1TypeSetting === 'FULL' ? Infinity : parseInt(fee1TypeSetting) || 500;

    // 日別のスケジュール種別数を取得（1種 vs 複数種）
    const scheduleFlyerCounts: Record<string, number> = {};
    for (const schedule of schedules) {
      const dateKey = schedule.date!.toISOString().split('T')[0];
      const itemCount = schedule.items.filter(i => i.actualCount !== null && i.actualCount > 0).length;
      // 同日に複数スケジュールがある場合は最大種別数を採用
      scheduleFlyerCounts[dateKey] = Math.max(scheduleFlyerCounts[dateKey] || 0, itemCount);
    }

    let expensePay = 0;
    for (const expense of expenses) {
      if (isFull) {
        expensePay += expense.amount;
      } else {
        const dateKey = expense.date.toISOString().split('T')[0];
        const flyerCount = scheduleFlyerCounts[dateKey] || 0;
        // 1種配布: 個人設定 or デフォルト500、複数種: 個人設定 or デフォルト1000
        const dailyCap = flyerCount === 1
          ? Math.min(personalCap, personal1TypeCap)
          : personalCap;
        expensePay += Math.min(expense.amount, dailyCap);
      }
    }

    const schedulePay = payrollItems.reduce((sum, item) => sum + item.earnedAmount, 0);
    const grossPay = schedulePay + expensePay;

    // upsert（同一週は上書き）
    const record = await prisma.$transaction(async (tx) => {
      // 既存レコード確認
      const existing = await tx.distributorPayrollRecord.findUnique({
        where: { distributorId_periodStart: { distributorId: distributor.id, periodStart } },
      });

      let payrollRecord;
      if (existing) {
        // 既存の明細行を削除して再生成
        await tx.distributorPayrollItem.deleteMany({ where: { payrollId: existing.id } });
        payrollRecord = await tx.distributorPayrollRecord.update({
          where: { id: existing.id },
          data: { periodEnd, paymentDate, schedulePay, expensePay, grossPay, status: 'DRAFT' },
        });
      } else {
        payrollRecord = await tx.distributorPayrollRecord.create({
          data: {
            distributorId: distributor.id,
            periodStart,
            periodEnd,
            paymentDate,
            schedulePay,
            expensePay,
            grossPay,
            status: 'DRAFT',
          },
        });
      }

      // 明細行を挿入
      if (payrollItems.length > 0) {
        await tx.distributorPayrollItem.createMany({
          data: payrollItems.map((item) => ({
            payrollId: payrollRecord.id,
            ...item,
          })),
        });
      }

      return payrollRecord;
    });

    return NextResponse.json({ record, itemCount: payrollItems.length });
  } catch (error) {
    console.error('Payroll Generate Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
