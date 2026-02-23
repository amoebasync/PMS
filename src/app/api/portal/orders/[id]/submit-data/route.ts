import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const customerId = contact.customerId;

    const { id } = await params;
    const orderId = parseInt(id);
    const body = await request.json();

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.customerId !== customerId) {
        throw new Error('Unauthorized');
      }

      // 入稿完了 → 入金待ちへ遷移
      await tx.order.update({
        where: { id: orderId },
        data: { status: 'PENDING_PAYMENT' }
      });

      // 入稿データのみ更新（印刷仕様はチェックアウト時に確定済み）
      const printData: Record<string, unknown> = {
        frontDesignUrl: body.frontDesignUrl || null,
        backDesignUrl: body.backDesignUrl || null,
        remarks: body.remarks || null,
      };
      // サンプル送付情報
      if (body.sampleRequired !== undefined) {
        printData.sampleRequired = !!body.sampleRequired;
      }
      if (body.sampleShippingAddress !== undefined) {
        printData.sampleShippingAddress = body.sampleShippingAddress || null;
      }

      const existingPrinting = await tx.orderPrinting.findFirst({ where: { orderId } });
      if (existingPrinting) {
        await tx.orderPrinting.update({
          where: { id: existingPrinting.id },
          data: printData
        });
      } else {
        await tx.orderPrinting.create({
          data: {
            orderId,
            ...printData,
            printCount: 0,
            status: 'UNORDERED'
          }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Submit Data Error:', error);
    return NextResponse.json({ error: 'Failed to submit data' }, { status: 500 });
  }
}
