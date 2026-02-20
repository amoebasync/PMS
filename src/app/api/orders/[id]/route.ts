import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (id === 'new') return NextResponse.json({});

    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        customer: true,
        salesRep: true,
        // ★ areas: true を追加して、マップの選択状態を復元できるようにしました
        distributions: { include: { flyer: true, areas: true } },
        printings: { include: { flyer: true, partner: true } },
        newspaperInserts: { include: { partner: true } },
        designs: { include: { partner: true, employee: true } },
      }
    });
    return NextResponse.json(order);
  } catch (error) {
    console.error('Fetch Order Detail Error:', error);
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const orderId = parseInt(id);
    const tab = body.tab || 'BASIC'; // どのタブからの保存リクエストかを判定

    // --- 基本情報の保存 ---
    if (tab === 'BASIC') {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          orderNo: body.orderNo,
          customerId: parseInt(body.customerId),
          salesRepId: body.salesRepId ? parseInt(body.salesRepId) : null,
          orderDate: new Date(body.orderDate),
          totalAmount: body.totalAmount ? parseInt(body.totalAmount) : null,
          status: body.status,
          remarks: body.remarks || null,
        },
      });
      return NextResponse.json(updatedOrder);
    } 
    
    // --- 配布(ポスティング)の保存 ---
    else if (tab === 'DIST') {
      const distId = body.id ? parseInt(body.id) : null;
      const data = {
        orderId,
        flyerId: parseInt(body.flyerId),
        method: body.method,
        plannedCount: parseInt(body.plannedCount),
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        spareDate: body.spareDate ? new Date(body.spareDate) : null,
      };
      
      let distribution;
      if (distId) {
        distribution = await prisma.orderDistribution.update({ where: { id: distId }, data });
        // 既存のエリア紐付けを一旦クリア
        await prisma.orderDistributionArea.deleteMany({ where: { orderDistributionId: distId } });
      } else {
        distribution = await prisma.orderDistribution.create({ data });
      }
      
      // 新しいエリア紐付けを保存
      if (body.areaIds && body.areaIds.length > 0) {
        const areaData = body.areaIds.map((aid: number) => ({ orderDistributionId: distribution.id, areaId: aid }));
        await prisma.orderDistributionArea.createMany({ data: areaData });
      }
      return NextResponse.json(distribution);
    }
    
    // --- 印刷手配の保存 ---
    else if (tab === 'PRINT') {
      const printId = body.id ? parseInt(body.id) : null;
      const data = {
        orderId,
        flyerId: body.flyerId ? parseInt(body.flyerId) : null,
        partnerId: body.partnerId ? parseInt(body.partnerId) : null,
        printCount: body.printCount ? parseInt(body.printCount) : 0,
        paperType: body.paperType || null,
        paperWeight: body.paperWeight || null,
        colorType: body.colorType || null,
        orderDate: body.orderDate ? new Date(body.orderDate) : null,
        expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null,
        status: body.status || 'UNORDERED',
      };
      if (printId) return NextResponse.json(await prisma.orderPrinting.update({ where: { id: printId }, data }));
      else return NextResponse.json(await prisma.orderPrinting.create({ data }));
    }
    
    // --- 新聞折込の保存 ---
    else if (tab === 'NEWS') {
      const newsId = body.id ? parseInt(body.id) : null;
      const data = {
        orderId,
        partnerId: body.partnerId ? parseInt(body.partnerId) : null,
        insertDate: body.insertDate ? new Date(body.insertDate) : null,
        plannedCount: body.plannedCount ? parseInt(body.plannedCount) : 0,
        newspaperName: body.newspaperName || null,
        areaSpecification: body.areaSpecification || null,
        status: body.status || 'UNORDERED',
      };
      if (newsId) return NextResponse.json(await prisma.orderNewspaperInsert.update({ where: { id: newsId }, data }));
      else return NextResponse.json(await prisma.orderNewspaperInsert.create({ data }));
    }
    
    // --- デザイン制作の保存 ---
    else if (tab === 'DESIGN') {
      const designId = body.id ? parseInt(body.id) : null;
      const data = {
        orderId,
        partnerId: body.partnerId ? parseInt(body.partnerId) : null,
        employeeId: body.employeeId ? parseInt(body.employeeId) : null,
        designConcept: body.designConcept || null,
        firstDraftDeadline: body.firstDraftDeadline ? new Date(body.firstDraftDeadline) : null,
        finalDeadline: body.finalDeadline ? new Date(body.finalDeadline) : null,
        status: body.status || 'NOT_STARTED',
      };
      if (designId) return NextResponse.json(await prisma.orderDesign.update({ where: { id: designId }, data }));
      else return NextResponse.json(await prisma.orderDesign.create({ data }));
    }

  } catch (error) {
    console.error('Update Order Error:', error);
    return NextResponse.json({ error: 'Failed to update order' }, { status: 500 });
  }
}