import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    
    const customerId = contact.customerId;
    const { items, paymentMethod } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // クレカなら即確定、請求書なら審査中
    const initialStatus = paymentMethod === 'CREDIT' ? 'CONFIRMED' : 'PENDING_REVIEW';
    const defaultIndustry = await prisma.industry.findFirst();

    // トランザクションでアイテムごとに個別の受注（Order）と決済（Payment）を作成する
    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        
        const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
        const orderNo = `WEB-${timestamp}-${Math.floor(Math.random() * 1000)}`;
        const orderTotalAmount = Math.floor(item.price * 1.1); // 税込

        // 1. 受注ヘッダの作成
        const order = await tx.order.create({
          data: {
            orderNo,
            title: item.projectName,
            customerId,
            orderSource: 'WEB_EC',
            paymentMethod: paymentMethod === 'CREDIT' ? 'クレジットカード' : '請求書払い',
            orderDate: new Date(),
            totalAmount: orderTotalAmount,
            status: initialStatus,
            remarks: 'ECサイトからの発注',
          }
        });

        // 2. 決済 (Payment) データの作成 ★ここが追加部分
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: orderTotalAmount,
            method: paymentMethod === 'CREDIT' ? 'CREDIT_CARD' : 'INVOICE',
            // クレカなら即入金済み、請求書なら未入金扱い
            status: paymentMethod === 'CREDIT' ? 'COMPLETED' : 'PENDING',
            paidAt: paymentMethod === 'CREDIT' ? new Date() : null,
          }
        });

        // 3. チラシの紐付け処理
        let targetFlyerId = item.flyerId;
        if (targetFlyerId === 'NEW') {
          const flyerSize = await tx.flyerSize.findUnique({ where: { name: item.size } });
          const newFlyer = await tx.flyer.create({
            data: {
              name: `(未入稿) ${item.projectName} 用`,
              customerId,
              industryId: defaultIndustry?.id || 1,
              sizeId: flyerSize?.id || 1,
              startDate: new Date(item.startDate),
              endDate: new Date(item.endDate),
              foldStatus: 'NO_FOLDING_REQUIRED',
            }
          });
          targetFlyerId = newFlyer.id;
        } else {
          targetFlyerId = parseInt(targetFlyerId);
        }

        // 4. 配布依頼の作成
        const distribution = await tx.orderDistribution.create({
          data: {
            orderId: order.id,
            flyerId: targetFlyerId,
            method: item.method,
            plannedCount: item.totalCount,
            startDate: new Date(item.startDate),
            endDate: new Date(item.endDate),
            spareDate: item.spareDate ? new Date(item.spareDate) : null,
            status: 'UNSTARTED',
          }
        });

        // 5. エリアの紐付け
        if (item.selectedAreas && item.selectedAreas.length > 0) {
          const areaData = item.selectedAreas.map((a: any) => ({
            orderDistributionId: distribution.id,
            areaId: a.id,
          }));
          await tx.orderDistributionArea.createMany({ data: areaData });
        }

        // 6. 印刷ありプランなら印刷依頼も作成
        if (item.type === 'PRINT_AND_POSTING') {
          await tx.orderPrinting.create({
            data: {
              orderId: order.id,
              flyerId: targetFlyerId,
              printCount: item.totalCount,
              status: 'UNORDERED',
              paperType: 'コート紙(EC標準)',
              colorType: '両面カラー',
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}