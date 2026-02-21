import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const orders = await prisma.order.findMany({
      where: { customerId: contact.customerId },
      orderBy: { orderDate: 'desc' },
      include: {
        distributions: {
          include: {
            flyer: { include: { size: true } },
            areas: { include: { area: { include: { city: true } } } }
          }
        },
        printings: true,
      }
    });

    return NextResponse.json(orders);
  } catch (error) {
    console.error('Fetch Portal Orders Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}