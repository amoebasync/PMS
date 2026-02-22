import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const { id } = await params;
    const orderId = parseInt(id);

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== contact.customerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // キャンセル可能なステータスかチェック
    const cancelableStatuses = ['DRAFT', 'PLANNING', 'PENDING_PAYMENT', 'PENDING_SUBMISSION', 'PENDING_REVIEW', 'ADJUSTING'];
    if (!cancelableStatuses.includes(order.status)) {
      return NextResponse.json({ error: '手配が進行しているため、システムからのキャンセルはできません。お問い合わせください。' }, { status: 400 });
    }

    // ステータスをキャンセルに更新
    await prisma.order.update({
      where: { id: orderId },
      data: { status: 'CANCELED' }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Cancel Order Error:', error);
    return NextResponse.json({ error: 'Failed to cancel order' }, { status: 500 });
  }
}