// 受注に紐づく帳票の一覧取得 & 新規発行
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calcLineItems } from '@/lib/pdf/calculator';

const DOC_PREFIX: Record<string, string> = {
  ESTIMATE: 'EST',
  INVOICE:  'INV',
  DELIVERY: 'DEL',
  RECEIPT:  'REC',
};

// 帳票番号を採番: EST-20260226-0001 形式
async function generateDocumentNo(type: string): Promise<string> {
  const prefix = DOC_PREFIX[type] ?? 'DOC';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  // 同日・同種別の最大連番を取得
  const like = `${prefix}-${dateStr}-%`;
  const last = await prisma.document.findFirst({
    where: { documentNo: { startsWith: `${prefix}-${dateStr}-` } },
    orderBy: { documentNo: 'desc' },
  });
  const seq = last
    ? parseInt(last.documentNo.split('-').pop() ?? '0') + 1
    : 1;
  return `${prefix}-${dateStr}-${String(seq).padStart(4, '0')}`;
}

// GET: 受注の帳票一覧
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const docs = await prisma.document.findMany({
      where:   { orderId: parseInt(id) },
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(docs);
  } catch (error) {
    console.error('Documents fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: 帳票を新規発行（レコードを作成してIDを返す）
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const body = await request.json();

    const typeMap: Record<string, 'ESTIMATE' | 'INVOICE' | 'DELIVERY' | 'RECEIPT'> = {
      ESTIMATE: 'ESTIMATE', INVOICE: 'INVOICE', DELIVERY: 'DELIVERY', RECEIPT: 'RECEIPT',
    };
    const documentType = typeMap[body.documentType];
    if (!documentType) {
      return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 });
    }

    // 受注データを取得して金額計算
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        distributions: { include: { flyer: true } },
        printings:      { include: { flyer: true } },
        newspaperInserts: true,
        designs: true,
      },
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const { subtotal, taxAmount, totalAmount } = calcLineItems(order);
    const documentNo = await generateDocumentNo(documentType);

    const doc = await prisma.document.create({
      data: {
        orderId,
        documentType,
        documentNo,
        issuedAt:       new Date(),
        subtotal,
        taxAmount,
        totalAmount,
        note:           body.note ?? null,
        paymentDueDate: body.paymentDueDate ? new Date(body.paymentDueDate) : null,
      },
    });
    return NextResponse.json(doc, { status: 201 });
  } catch (error) {
    console.error('Document create error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
