import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET /api/distributor-payroll?distributorId=X&year=YYYY&month=MM
// または ?weekStart=YYYY-MM-DD
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const distributorId = searchParams.get('distributorId');
    const weekStart = searchParams.get('weekStart'); // ISO date (Sunday)
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    const where: any = {};

    if (distributorId) {
      where.distributorId = parseInt(distributorId);
    }

    if (weekStart) {
      where.periodStart = new Date(weekStart);
    } else if (year && month) {
      const y = parseInt(year);
      const m = parseInt(month);
      where.periodStart = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0),
      };
    }

    const records = await prisma.distributorPayrollRecord.findMany({
      where,
      include: {
        distributor: { select: { id: true, staffId: true, name: true } },
        items: { orderBy: { date: 'asc' } },
      },
      orderBy: [{ periodStart: 'desc' }, { distributorId: 'asc' }],
    });

    return NextResponse.json({ records });
  } catch (error) {
    console.error('Payroll GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
