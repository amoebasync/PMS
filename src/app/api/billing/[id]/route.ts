// 月次まとめ請求 詳細取得 / 更新 / 削除
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcLineItems } from '@/lib/pdf/calculator';

// GET: 詳細（受注明細付き）
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const stmt = await prisma.billingStatement.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: {
          select: {
            id: true, name: true, customerCode: true,
            postalCode: true, address: true,
            invoiceRegistrationNumber: true,
            billingCutoffDay: true, paymentMonthDelay: true, paymentDay: true,
            contacts: { where: { isBillingContact: true }, take: 1,
              select: { firstName: true, lastName: true, department: true } },
          },
        },
        items: {
          include: {
            order: {
              select: {
                id: true, orderNo: true, title: true, totalAmount: true,
                orderDate: true, status: true,
              },
            },
          },
          orderBy: { orderId: 'asc' },
        },
      },
    });
    if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(stmt);
  } catch (error) {
    console.error('Billing get error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// PUT: ステータス更新・メモ更新・受注追加/削除
// body: { status?, note?, paymentDueDate?, paymentMethod?, addOrderIds?, removeOrderIds? }
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const stmtId = parseInt(id);
    const body = await req.json();

    const current = await prisma.billingStatement.findUnique({
      where: { id: stmtId },
      include: { items: true },
    });
    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // DRAFT 以外は受注の追加/削除不可
    if (current.status !== 'DRAFT' && (body.addOrderIds?.length || body.removeOrderIds?.length)) {
      return NextResponse.json({ error: '確定済みの請求まとめは受注を変更できません' }, { status: 400 });
    }

    // 受注削除
    if (body.removeOrderIds?.length) {
      await prisma.billingStatementItem.deleteMany({
        where: { billingStatementId: stmtId, orderId: { in: body.removeOrderIds } },
      });
    }

    // 受注追加
    if (body.addOrderIds?.length) {
      const orders = await prisma.order.findMany({
        where: { id: { in: body.addOrderIds } },
        include: {
          distributions:    { include: { flyer: true } },
          printings:        { include: { flyer: true } },
          newspaperInserts: true,
          designs:          true,
          billingItem:      true,
        },
      });
      const alreadyBilled = orders.filter(o => o.billingItem !== null);
      if (alreadyBilled.length > 0) {
        return NextResponse.json({
          error: `受注 ${alreadyBilled.map(o => o.orderNo).join(', ')} はすでに別の請求まとめに含まれています`,
        }, { status: 409 });
      }
      for (const order of orders) {
        const calc = calcLineItems(order);
        await prisma.billingStatementItem.create({
          data: {
            billingStatementId: stmtId,
            orderId:    order.id,
            subtotal:   calc.subtotal,
            taxAmount:  calc.taxAmount,
            amount:     calc.totalAmount,
          },
        });
      }
    }

    // 金額を再集計
    const allItems = await prisma.billingStatementItem.findMany({ where: { billingStatementId: stmtId } });
    const subtotal    = allItems.reduce((s, i) => s + i.subtotal,  0);
    const taxAmount   = allItems.reduce((s, i) => s + i.taxAmount, 0);
    const totalAmount = allItems.reduce((s, i) => s + i.amount,    0);

    // ステータス変更時のタイムスタンプ
    const now = new Date();
    const timestamps: Record<string, Date | null> = {};
    if (body.status === 'CONFIRMED' && current.status === 'DRAFT')     timestamps.confirmedAt = now;
    if (body.status === 'SENT'      && current.status === 'CONFIRMED') timestamps.sentAt      = now;
    if (body.status === 'PAID'      && current.status === 'SENT')      timestamps.paidAt      = now;

    const updated = await prisma.billingStatement.update({
      where: { id: stmtId },
      data: {
        ...(body.status        !== undefined ? { status:        body.status }                          : {}),
        ...(body.note          !== undefined ? { note:          body.note }                            : {}),
        ...(body.paymentDueDate !== undefined ? { paymentDueDate: body.paymentDueDate ? new Date(body.paymentDueDate) : null } : {}),
        ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod }                   : {}),
        subtotal,
        taxAmount,
        totalAmount,
        ...timestamps,
      },
      include: {
        customer: { select: { id: true, name: true } },
        items:    { include: { order: { select: { id: true, orderNo: true, title: true, status: true } } } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Billing update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE: DRAFT のみ削除可
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const stmt = await prisma.billingStatement.findUnique({ where: { id: parseInt(id) } });
    if (!stmt) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (stmt.status !== 'DRAFT') {
      return NextResponse.json({ error: '下書き状態の請求まとめのみ削除できます' }, { status: 400 });
    }
    await prisma.billingStatement.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Billing delete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
