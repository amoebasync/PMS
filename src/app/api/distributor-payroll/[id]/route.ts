import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { pushMessage, isLineConfigured } from '@/lib/line';


// GET /api/distributor-payroll/[id] — 明細含む詳細取得
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { id } = await params;
    const record = await prisma.distributorPayrollRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        distributor: { select: { id: true, staffId: true, name: true } },
        items: { orderBy: { date: 'asc' } },
      },
    });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// PATCH /api/distributor-payroll/[id] — ステータス更新
// Body: { status: 'DRAFT' | 'CONFIRMED' | 'PAID', note?: string }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();

    const data: any = {};
    if (body.status !== undefined) data.status = body.status;
    if (body.note !== undefined) data.note = body.note;

    const record = await prisma.distributorPayrollRecord.update({
      where: { id: parseInt(id) },
      data,
      include: { distributor: { select: { id: true, paymentMethod: true } } },
    });

    // PAID に変更された場合、現金払い配布員にLINE通知を送信
    if (body.status === 'PAID' && record.distributor.paymentMethod === '現金') {
      sendCashReceiptLineNotification(record.distributorId, record.grossPay, record.id).catch(err => {
        console.error('LINE cash receipt notification error:', err);
      });
    }

    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

// DELETE /api/distributor-payroll/[id] — レコード削除
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { id } = await params;
    await prisma.distributorPayrollRecord.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/** 現金受取確認のLINE通知を送信 */
async function sendCashReceiptLineNotification(distributorId: number, grossPay: number, payrollId: number) {
  if (!isLineConfigured()) return;

  const lineUser = await prisma.lineUser.findUnique({
    where: { distributorId },
    select: { lineUserId: true },
  });
  if (!lineUser) return;

  const baseUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
  const staffUrl = `${baseUrl}/staff/payroll?confirm=${payrollId}`;

  await pushMessage(lineUser.lineUserId, [
    {
      type: 'flex',
      altText: `給与 ¥${grossPay.toLocaleString()} の受取確認をお願いします`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '💰 給与受取確認', weight: 'bold', size: 'lg', color: '#333333' },
            { type: 'separator', margin: 'lg' },
            { type: 'text', text: '現金で給与をお支払いしました。', size: 'sm', margin: 'lg', color: '#555555', wrap: true },
            {
              type: 'box', layout: 'horizontal', margin: 'lg',
              contents: [
                { type: 'text', text: '支給額', size: 'sm', color: '#888888', flex: 2 },
                { type: 'text', text: `¥${grossPay.toLocaleString()}`, size: 'lg', weight: 'bold', color: '#10B981', align: 'end', flex: 3 },
              ],
            },
            { type: 'separator', margin: 'lg' },
            { type: 'text', text: '下のボタンから受取確認（署名）をお願いします。', size: 'xs', margin: 'lg', color: '#888888', wrap: true },
          ],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'button',
              action: { type: 'uri', label: '受取確認する', uri: staffUrl },
              style: 'primary',
              color: '#10B981',
            },
          ],
        },
      },
    },
  ]);
}
