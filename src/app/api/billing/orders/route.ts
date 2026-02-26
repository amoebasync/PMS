// 請求対象となりうる受注を取得
// クエリ: customerId（必須）, month（任意 "2026-02"）, excludeStatementId（任意）
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId          = searchParams.get('customerId');
    const month               = searchParams.get('month');      // "2026-02"
    const excludeStatementId  = searchParams.get('excludeStatementId');

    if (!customerId) return NextResponse.json({ error: 'customerId required' }, { status: 400 });

    // 月フィルタ用の日付範囲
    let dateFilter: { orderDate?: { gte: Date; lte: Date } } = {};
    if (month) {
      const [y, m] = month.split('-').map(Number);
      dateFilter = {
        orderDate: {
          gte: new Date(y, m - 1, 1),
          lte: new Date(y, m, 0, 23, 59, 59),
        },
      };
    }

    const orders = await prisma.order.findMany({
      where: {
        customerId: parseInt(customerId),
        // 未請求（billingItem が null）または指定した請求まとめに含まれるもの
        OR: [
          { billingItem: null },
          ...(excludeStatementId
            ? [{ billingItem: { billingStatementId: parseInt(excludeStatementId) } }]
            : []),
        ],
        ...dateFilter,
        status: { notIn: ['DRAFT', 'CANCELED'] },
      },
      select: {
        id: true, orderNo: true, title: true,
        orderDate: true, status: true, totalAmount: true,
        billingItem: { select: { billingStatementId: true } },
      },
      orderBy: { orderDate: 'asc' },
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Billing orders error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
