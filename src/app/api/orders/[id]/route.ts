import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    if (id === 'new') return NextResponse.json({});

    if (id === 'pending-count') {
      const count = await prisma.order.count({
        where: { status: 'PENDING_REVIEW' }
      });
      return NextResponse.json({ count });
    }

    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true, 
        salesRep: true,
        // ★ 修正: areasの中の「実際のエリア情報 (都道府県・市区町村)」まで深く取得する
        distributions: { 
          include: { 
            flyer: true, 
            areas: { 
              include: { 
                area: { 
                  include: { prefecture: true, city: true } 
                } 
              } 
            } 
          } 
        },
        printings: { include: { flyer: true, partner: true } },
        newspaperInserts: { include: { partner: true } },
        designs: { include: { partner: true, employee: true } },
        payments: true, 
        approvals: { orderBy: { createdAt: 'desc' } } 
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
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const tab = body.tab || 'BASIC'; 

    if (tab === 'STATUS') {
      const { status: newStatus, action, comment } = body;

      await prisma.$transaction(async (tx) => {
        await tx.order.update({ where: { id: orderId }, data: { status: newStatus } });

        if (action === 'PAYMENT_CONFIRMED') {
          await tx.payment.updateMany({
            where: { orderId: orderId, status: 'PENDING' },
            data: { status: 'COMPLETED', paidAt: new Date() }
          });
        }
        else if (action === 'APPROVE') {
          await tx.orderApproval.create({ data: { orderId, status: 'APPROVED' } });
        }
        else if (action === 'REJECT') {
          await tx.orderApproval.create({ data: { orderId, status: 'REJECTED', comment } });
        }
      });
      return NextResponse.json({ success: true });
    }

    if (tab === 'BASIC') {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: {
          orderNo: body.orderNo,
          title: body.title || null,
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
        status: body.status || 'UNSTARTED',
        remarks: body.remarks || null,
      };
      
      let distribution;
      if (distId) {
        distribution = await prisma.orderDistribution.update({ where: { id: distId }, data });
        await prisma.orderDistributionArea.deleteMany({ where: { orderDistributionId: distId } });
      } else {
        distribution = await prisma.orderDistribution.create({ data });
      }
      
      if (body.areaIds && body.areaIds.length > 0) {
        const areaData = body.areaIds.map((aid: number) => ({ orderDistributionId: distribution.id, areaId: aid }));
        await prisma.orderDistributionArea.createMany({ data: areaData });
      }
      return NextResponse.json(distribution);
    }
    
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