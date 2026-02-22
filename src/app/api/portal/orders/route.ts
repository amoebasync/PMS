import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    
    const customerId = contact.customerId;

    const orders = await prisma.order.findMany({
      where: { customerId },
      // ★ 修正: エリア情報を最深部まで取得するように変更
      include: {
        distributions: {
          include: {
            flyer: { include: { size: true } },
            areas: {
              include: {
                area: {
                  include: { city: true, prefecture: true }
                }
              }
            }
          }
        },
        printings: true, 
        payments: true,
      },
      orderBy: { orderDate: 'desc' },
    });

    return NextResponse.json({ 
      orders,
      customer: { 
        name: `${contact.lastName} ${contact.firstName}`, 
        email: contact.email 
      }
    });
  } catch (error) {
    console.error('Fetch Orders Error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

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
    const body = await request.json();

    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
    const orderNo = `WEB-${timestamp}-${Math.floor(Math.random() * 1000)}`;

    const requiresPrinting = body.isPrintingRequested || body.type === 'PRINT_AND_POSTING' || body.printingRequired;
    
    let targetStatus = body.status || 'PLANNING'; 
    
    if (targetStatus !== 'DRAFT') {
       if (requiresPrinting) {
          targetStatus = 'PENDING_SUBMISSION'; 
       } else {
          targetStatus = 'PENDING_REVIEW'; 
       }
    }

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          orderNo,
          title: body.title || 'WEB発注（名称未設定）',
          customerId,
          orderSource: 'WEB_EC',
          paymentMethod: body.paymentMethod || 'クレジットカード',
          orderDate: new Date(),
          totalAmount: body.totalAmount || 0,
          status: targetStatus,
          remarks: body.remarks || 'ポータルからの発注',
        }
      });

      await tx.orderDistribution.create({
        data: {
          orderId: newOrder.id,
          flyerId: body.flyerId || 1, 
          method: body.method || 'POSTING',
          plannedCount: body.plannedCount || body.totalCount || 0,
          status: 'UNSTARTED',
        }
      });

      if (requiresPrinting) {
        await tx.orderPrinting.create({
          data: {
            orderId: newOrder.id,
            printCount: body.plannedCount || body.totalCount || 0,
            status: 'UNORDERED',
            paperType: 'コート紙',
            paperWeight: '73kg (標準)',
            colorType: '両面カラー',
          }
        });
      }

      return newOrder;
    });

    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error('Order Create Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}