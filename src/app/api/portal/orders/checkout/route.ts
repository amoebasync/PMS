import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    // 1. セッションとユーザー情報の確認
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const customerId = contact.customerId;
    const { items, paymentMethod, isDraft } = await request.json();

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // 2. ステータスの判定
    // 新フロー:
    //   PRINT_AND_POSTING → PENDING_SUBMISSION (支払い方法によらず入稿待ち)
    //   POSTING_ONLY → PENDING_PAYMENT (入金待ち)
    const defaultIndustry = await prisma.industry.findFirst();
    const orderIds: { cartItemId: string, orderId: number }[] = [];

    // 3. トランザクションによる一括保存処理
    await prisma.$transaction(async (tx) => {
      for (const item of items) {

        // すでに一時保存されていた場合は、古い関連データを安全に削除して上書きする
        if (item.savedOrderId) {
          await tx.payment.deleteMany({ where: { orderId: item.savedOrderId } });
          await tx.orderDistribution.deleteMany({ where: { orderId: item.savedOrderId } });
          await tx.orderPrinting.deleteMany({ where: { orderId: item.savedOrderId } });
          await tx.order.delete({ where: { id: item.savedOrderId } });
        }

        const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
        const orderNo = `WEB-${timestamp}-${Math.floor(Math.random() * 1000)}`;
        const orderTotalAmount = Math.floor(item.price * 1.1);

        const pName = item.projectName || '名称未設定';
        const isPrintAndPosting = item.type === 'PRINT_AND_POSTING';

        // ステータス決定
        let initialStatus: string;
        if (isDraft) {
          initialStatus = 'DRAFT';
        } else if (isPrintAndPosting) {
          initialStatus = 'PENDING_SUBMISSION'; // 印刷あり → 入稿待ち
        } else {
          initialStatus = 'PENDING_PAYMENT'; // 配布のみ → 入金待ち
        }

        // 3-A. 受注ヘッダの作成
        const order = await tx.order.create({
          data: {
            orderNo,
            title: pName,
            customerId,
            orderSource: 'WEB_EC',
            paymentMethod: paymentMethod === 'CREDIT' || paymentMethod === 'CREDIT_CARD' ? 'クレジットカード' : '銀行振込',
            orderDate: new Date(),
            totalAmount: orderTotalAmount,
            status: initialStatus as any,
            remarks: isDraft ? 'カートからの下書き保存' : 'ECサイトからの発注',
          }
        });

        orderIds.push({ cartItemId: item.id, orderId: order.id });

        // 3-B. 決済データの作成
        const isCredit = paymentMethod === 'CREDIT' || paymentMethod === 'CREDIT_CARD';
        await tx.payment.create({
          data: {
            orderId: order.id,
            amount: orderTotalAmount,
            method: isCredit ? 'CREDIT_CARD' : 'BANK_TRANSFER',
            status: isDraft ? 'PENDING' : (isCredit && !isPrintAndPosting ? 'COMPLETED' : 'PENDING'),
            paidAt: (!isDraft && isCredit && !isPrintAndPosting) ? new Date() : null,
          }
        });

        // 3-C. チラシ枠の確保・紐付け
        let targetFlyerId = item.flyerId;
        if (!targetFlyerId || targetFlyerId === 'NEW') {
          const flyerSize = await tx.flyerSize.findUnique({ where: { name: item.size } });
          const newFlyer = await tx.flyer.create({
            data: {
              name: `(未入稿) ${pName} 用`,
              customerId,
              industryId: defaultIndustry?.id || 1,
              sizeId: flyerSize?.id || 1,
              startDate: item.startDate ? new Date(item.startDate) : null,
              endDate: item.endDate ? new Date(item.endDate) : null,
              foldStatus: 'NO_FOLDING_REQUIRED',
            }
          });
          targetFlyerId = newFlyer.id;
        } else {
          targetFlyerId = parseInt(targetFlyerId);
        }

        // 3-D. 配布手配データの作成
        const distribution = await tx.orderDistribution.create({
          data: {
            orderId: order.id,
            flyerId: targetFlyerId,
            method: item.method,
            plannedCount: item.totalCount,
            startDate: item.startDate ? new Date(item.startDate) : null,
            endDate: item.endDate ? new Date(item.endDate) : null,
            spareDate: item.spareDate ? new Date(item.spareDate) : null,
            status: 'UNSTARTED',
          }
        });

        // 3-E. 選択されたエリアの紐付け
        if (item.selectedAreas && item.selectedAreas.length > 0) {
          const areaData = item.selectedAreas.map((a: any) => ({
            orderDistributionId: distribution.id,
            areaId: a.id,
          }));
          await tx.orderDistributionArea.createMany({ data: areaData });
        }

        // 3-F. 印刷ありプランの場合は印刷手配データも作成（発注時に仕様確定）
        if (isPrintAndPosting) {
          await tx.orderPrinting.create({
            data: {
              orderId: order.id,
              flyerId: targetFlyerId,
              printCount: item.printCount || item.totalCount,
              status: 'UNORDERED',
              paperType: item.paperType || 'コート紙',
              paperWeight: item.paperWeight || '73kg (標準)',
              colorType: item.colorType || '両面カラー',
              foldingOption: item.foldingTypeName || 'なし',
              foldingTypeId: item.foldingTypeId || null,
              foldingUnitPrice: item.foldingUnitPrice || null,
            }
          });
        }
      }
    });

    return NextResponse.json({ success: true, orderIds });
  } catch (error) {
    console.error('Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
