// 月次まとめ請求 一覧取得 & 新規作成
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcLineItems } from '@/lib/pdf/calculator';
import { requireAdminSession } from '@/lib/adminAuth';

// 採番: BS-202602-0001
async function generateStatementNo(month: string): Promise<string> {
  const prefix = `BS-${month.replace('-', '')}-`;
  const last = await prisma.billingStatement.findFirst({
    where: { statementNo: { startsWith: prefix } },
    orderBy: { statementNo: 'desc' },
  });
  const seq = last ? parseInt(last.statementNo.split('-').pop() ?? '0') + 1 : 1;
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

// GET: 一覧（フィルタ: month, customerId, status）
export async function GET(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { searchParams } = new URL(req.url);
    const month      = searchParams.get('month');      // "2026-02"
    const customerId = searchParams.get('customerId');
    const status     = searchParams.get('status');

    const statements = await prisma.billingStatement.findMany({
      where: {
        ...(month      ? { billingMonth: month }                    : {}),
        ...(customerId ? { customerId: parseInt(customerId) }       : {}),
        ...(status     ? { status: status as any }                  : {}),
      },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        items:    { select: { id: true, orderId: true, amount: true } },
      },
      orderBy: [{ billingMonth: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(statements);
  } catch (error) {
    console.error('Billing list error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: 新規まとめ請求を作成
// body: { customerId, billingMonth, orderIds: number[], note?, paymentDueDate? }
export async function POST(req: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const body = await req.json();
    const { customerId, billingMonth, orderIds, note, paymentDueDate } = body;

    if (!customerId || !billingMonth || !Array.isArray(orderIds) || orderIds.length === 0) {
      return NextResponse.json({ error: '顧客・請求月・受注を指定してください' }, { status: 400 });
    }

    // 対象受注を取得して金額計算
    const orders = await prisma.order.findMany({
      where: { id: { in: orderIds }, customerId: parseInt(customerId) },
      include: {
        distributions:    { include: { flyer: true } },
        printings:        { include: { flyer: true } },
        newspaperInserts: true,
        designs:          true,
        billingItem:      true,
      },
    });

    // すでに他の請求まとめに含まれている受注を除外チェック
    const alreadyBilled = orders.filter(o => o.billingItem !== null);
    if (alreadyBilled.length > 0) {
      return NextResponse.json({
        error: `受注 ${alreadyBilled.map(o => o.orderNo).join(', ')} はすでに請求まとめに含まれています`,
      }, { status: 409 });
    }

    // 各受注の金額を計算して合計
    let totalSubtotal  = 0;
    let totalTax       = 0;
    let totalAmount    = 0;
    const itemsData: { orderId: number; subtotal: number; taxAmount: number; amount: number }[] = [];

    for (const order of orders) {
      const calc = calcLineItems(order);
      totalSubtotal += calc.subtotal;
      totalTax      += calc.taxAmount;
      totalAmount   += calc.totalAmount;
      itemsData.push({
        orderId:   order.id,
        subtotal:  calc.subtotal,
        taxAmount: calc.taxAmount,
        amount:    calc.totalAmount,
      });
    }

    const statementNo = await generateStatementNo(billingMonth);

    const statement = await prisma.billingStatement.create({
      data: {
        statementNo,
        customerId:    parseInt(customerId),
        billingMonth,
        status:        'DRAFT',
        subtotal:      totalSubtotal,
        taxAmount:     totalTax,
        totalAmount,
        note:          note ?? null,
        paymentDueDate: paymentDueDate ? new Date(paymentDueDate) : null,
        items: { create: itemsData },
      },
      include: {
        customer: { select: { id: true, name: true } },
        items:    true,
      },
    });

    return NextResponse.json(statement, { status: 201 });
  } catch (error) {
    console.error('Billing create error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
