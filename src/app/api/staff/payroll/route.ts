import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';


// GET /api/staff/payroll?year=YYYY&month=MM
// ログイン中スタッフの給与レコード一覧
export async function GET(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    // その月に periodStart がある週を対象（前後の週もカバーするため少し広めに）
    const startRange = new Date(year, month - 2, 1); // 1ヶ月前から
    const endRange = new Date(year, month + 1, 0);   // 1ヶ月後まで

    const records = await prisma.distributorPayrollRecord.findMany({
      where: {
        distributorId: distributor.id,
        periodStart: { gte: startRange, lte: endRange },
      },
      include: {
        items: { orderBy: { date: 'asc' } },
      },
      orderBy: { periodStart: 'desc' },
    });

    // 次の金曜に支払われる給与を取得（対象: 前週の日曜〜土曜）
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 次の金曜（金曜当日は今日）
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7; // 0 if today is Friday
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + daysUntilFriday);
    // 支払い対象週の日曜 = 金曜 - 12日
    const paymentWeekSunday = new Date(nextFriday);
    paymentWeekSunday.setDate(nextFriday.getDate() - 12);

    const upcomingRecord = await prisma.distributorPayrollRecord.findUnique({
      where: {
        distributorId_periodStart: {
          distributorId: distributor.id,
          periodStart: paymentWeekSunday,
        },
      },
    });

    return NextResponse.json({ records, upcomingRecord: upcomingRecord || null });
  } catch (error) {
    console.error('Staff Payroll GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
