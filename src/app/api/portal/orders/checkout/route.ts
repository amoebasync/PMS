import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { sendOrderConfirmationEmail } from '@/lib/mailer';


// サーバー側で価格を再計算してクライアント送信値と照合する
async function validateItemPrice(item: any): Promise<{ valid: boolean; serverPrice: number }> {
  // 1. エリアランク加重平均単価
  let areaRankUnitPrice = 5.0;
  if (item.selectedAreas && item.selectedAreas.length > 0) {
    const areaIds = item.selectedAreas.map((a: any) => a.id);
    const areas = await prisma.area.findMany({
      where: { id: { in: areaIds } },
      include: { areaRank: true },
    });

    // 配布方法の取得（capacityType が必要）
    const distMethod = await prisma.distributionMethod.findFirst({ where: { name: item.method } });
    const capacityType = distMethod?.capacityType || 'all';

    const getCapacity = (area: any) => {
      const dtd = area.door_to_door_count || 0;
      const mf = area.multi_family_count || 0;
      if (capacityType === 'apartment') return mf;
      if (capacityType === 'detached') return Math.floor(Math.max(0, dtd - mf) * 0.5);
      return dtd; // 'all'
    };

    const totalCap = areas.reduce((sum: number, a: any) => sum + getCapacity(a), 0);
    if (totalCap > 0) {
      const weighted = areas.reduce((sum: number, a: any) => {
        const cap = getCapacity(a);
        const rankPrice = a.areaRank?.postingUnitPrice ?? 5.0;
        return sum + cap * rankPrice;
      }, 0);
      areaRankUnitPrice = weighted / totalCap;
    }
  }

  // 2. サイズ加算
  const flyerSize = await prisma.flyerSize.findFirst({ where: { name: item.size } });
  const sizeAddon = flyerSize?.basePriceAddon ?? 0;

  // 3. 期間加算
  let periodAddon = 0;
  if (item.startDate && item.endDate) {
    const start = new Date(item.startDate);
    const end = new Date(item.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (days > 0) {
      const periodPrices = await prisma.distributionPeriodPrice.findMany({ orderBy: { minDays: 'asc' } });
      const match = periodPrices.find((p: any) => days >= p.minDays && days <= p.maxDays);
      periodAddon = match?.priceAddon ?? 0;
    }
  }

  // 4. 配布方法加算
  const distMethod = await prisma.distributionMethod.findFirst({ where: { name: item.method } });
  const methodPriceAddon = distMethod?.priceAddon ?? 0;
  const capacityType = distMethod?.capacityType || 'all';

  // 5. 配布単価
  const postingUnitPrice = areaRankUnitPrice + sizeAddon + periodAddon + methodPriceAddon;

  // 6. 請求枚数
  let totalAreaCapacity = 0;
  if (item.selectedAreas && item.selectedAreas.length > 0) {
    const areaIds = item.selectedAreas.map((a: any) => a.id);
    const areas = await prisma.area.findMany({ where: { id: { in: areaIds } } });
    totalAreaCapacity = areas.reduce((sum: number, a: any) => {
      const dtd = a.door_to_door_count || 0;
      const mf = a.multi_family_count || 0;
      if (capacityType === 'apartment') return sum + mf;
      if (capacityType === 'detached') return sum + Math.floor(Math.max(0, dtd - mf) * 0.5);
      return sum + dtd;
    }, 0);
  }
  const billingCount = totalAreaCapacity > 0 ? Math.min(totalAreaCapacity, item.totalCount || 0) : 0;
  const totalPosting = billingCount * postingUnitPrice;

  // 7. 印刷単価（PRINT_AND_POSTING の場合のみ）
  let totalPrint = 0;
  if (item.type === 'PRINT_AND_POSTING') {
    const printBase = flyerSize?.printUnitPrice ?? 3.0;
    let foldingUnit = 0;
    if (item.foldingTypeId) {
      const foldingType = await prisma.foldingType.findUnique({ where: { id: item.foldingTypeId } });
      foldingUnit = foldingType?.unitPrice ?? 0;
    }
    const printUnitPrice = printBase + foldingUnit;
    const printCount = item.printCount || item.totalCount || 0;
    totalPrint = printCount * printUnitPrice;
  }

  // 8. 合計（税抜）
  const serverPrice = Math.floor(totalPosting + totalPrint);

  // 許容誤差: 浮動小数点の丸め差を考慮して ±1円まで許容
  const clientPrice = item.price || 0;
  const valid = Math.abs(serverPrice - clientPrice) <= 1;

  return { valid, serverPrice };
}


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

    // ★ サーバー側で価格を再計算・検証（下書き保存時も検証する）
    for (const item of items) {
      const { valid, serverPrice } = await validateItemPrice(item);
      if (!valid) {
        console.error(`Price mismatch: client=${item.price}, server=${serverPrice}, item=${item.projectName}`);
        return NextResponse.json(
          { error: '価格の検証に失敗しました。ページを再読み込みしてやり直してください。' },
          { status: 400 }
        );
      }
      // クライアント価格ではなくサーバー計算価格を使用
      item.price = serverPrice;
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
            remarks: isDraft ? 'カートからの下書き保存' :
              (!isPrintAndPosting && item.foldingTypeName ? `ECサイトからの発注 (折り加工: ${item.foldingTypeName})` : 'ECサイトからの発注'),
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
              name: item.flyerName || `(未入稿) ${pName} 用`,
              customerId,
              industryId: item.industryId || defaultIndustry?.id || 1,
              sizeId: flyerSize?.id || 1,
              startDate: item.startDate ? new Date(item.startDate) : null,
              endDate: item.endDate ? new Date(item.endDate) : null,
              foldStatus: item.foldingTypeId ? 'NEEDS_FOLDING' : (item.foldStatus || 'NO_FOLDING_REQUIRED'),
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

    // 発注確定メール送信（下書き保存の場合は送らない、fire-and-forget）
    if (!isDraft && contact.email) {
      const createdOrders = await prisma.order.findMany({
        where: { id: { in: orderIds.map((o) => o.orderId) } },
        select: { orderNo: true, title: true, totalAmount: true, status: true },
      });
      const myPageUrl = `${process.env.NEXTAUTH_URL}/portal/mypage`;
      sendOrderConfirmationEmail(
        contact.email,
        contact.lastName,
        contact.firstName,
        createdOrders.map((o) => ({
          orderNo: o.orderNo,
          title: o.title || '(件名未設定)',
          totalAmount: o.totalAmount || 0,
          status: o.status,
        })),
        myPageUrl,
      ).catch(console.error);
    }

    return NextResponse.json({ success: true, orderIds });
  } catch (error) {
    console.error('Checkout Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
