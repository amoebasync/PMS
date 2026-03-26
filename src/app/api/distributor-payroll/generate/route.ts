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

    // 配布員情報取得（レート + 交通費設定 + 研修日）
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
        defaultDailyTransportation: true,
        trainingAllowance: true,
        joinDate: true,
        excludeFromPayroll: true,
      },
    });

    if (!distributor) {
      return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
    }

    if (distributor.excludeFromPayroll) {
      return NextResponse.json({ error: '給与計算対象外の配布員です' }, { status: 400 });
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

      const areaUnitPrice = schedule.areaUnitPrice ?? 0;
      const sizeUnitPrice = schedule.sizeUnitPrice ?? 0;

      // ティア制計算: 枚数を昇順ソートし、段階的に種類数を減らして計算
      const counts = validItems.map((i) => i.actualCount ?? 0).sort((a, b) => a - b);
      const totalTypes = Math.min(counts.length, 6);
      let earnedAmount = 0;
      let prev = 0;
      for (let i = 0; i < counts.length; i++) {
        const band = counts[i] - prev;
        if (band > 0) {
          const typesInBand = Math.min(counts.length - i, 6);
          const tierRate = rates[typesInBand] ?? 0;
          earnedAmount += band * (tierRate + areaUnitPrice + sizeUnitPrice);
        }
        prev = counts[i];
      }
      earnedAmount = Math.floor(earnedAmount);

      // 表示用: 最大種類数・最大枚数・最大種類数の基本レートを保存
      const flyerTypeCount = totalTypes;
      const baseRate = rates[flyerTypeCount] ?? 0;
      const unitPrice = baseRate + areaUnitPrice + sizeUnitPrice;
      const actualCount = Math.max(...counts);

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

    // 研修手当（初日研修がこの期間に含まれる場合）
    let trainingPay = 0;
    const trainingAmount = parseInt(distributor.trainingAllowance || '1000') || 1000;
    if (distributor.joinDate) {
      const joinDateStr = new Date(distributor.joinDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      const periodStartStr = periodStart.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      const periodEndStr = periodEnd.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      if (joinDateStr >= periodStartStr && joinDateStr <= periodEndStr) {
        trainingPay = trainingAmount;
        // 研修日もpayrollItemsに追加（表示用）
        payrollItems.push({
          date: new Date(distributor.joinDate),
          scheduleId: 0,
          flyerTypeCount: 0,
          baseRate: 0,
          areaUnitPrice: 0,
          sizeUnitPrice: 0,
          unitPrice: 0,
          actualCount: 0,
          earnedAmount: trainingPay,
        });
        // 日付順に再ソート
        payrollItems.sort((a, b) => a.date.getTime() - b.date.getTime());
      }
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

    // 交通費未記入の出勤日にデフォルト日額を自動適用
    const defaultDaily = distributor.defaultDailyTransportation ?? 500;
    const dailyExpenses: Record<string, number> = {};
    for (const expense of expenses) {
      const dateKey = expense.date.toISOString().split('T')[0];
      dailyExpenses[dateKey] = (dailyExpenses[dateKey] || 0) + expense.amount;
    }
    // 出勤日（actualCount > 0 のスケジュールがある日）で交通費未記入の日にデフォルト額を補填
    for (const dateKey of Object.keys(scheduleFlyerCounts)) {
      if (scheduleFlyerCounts[dateKey] > 0 && !dailyExpenses[dateKey]) {
        dailyExpenses[dateKey] = defaultDaily;
      }
    }

    let expensePay = 0;
    if (isFull) {
      for (const amount of Object.values(dailyExpenses)) {
        expensePay += amount;
      }
    } else {
      for (const [dateKey, totalAmount] of Object.entries(dailyExpenses)) {
        const flyerCount = scheduleFlyerCounts[dateKey] || 0;
        const dailyCap = flyerCount === 1
          ? Math.min(personalCap, personal1TypeCap)
          : personalCap;
        expensePay += Math.min(totalAmount, dailyCap);
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
