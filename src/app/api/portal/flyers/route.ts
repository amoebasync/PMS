import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";


export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const contactId = parseInt((session.user as any).id);
    const contact = await prisma.customerContact.findUnique({ where: { id: contactId } });
    if (!contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });

    const customer = await prisma.customer.findUnique({ where: { id: contact.customerId }, select: { industryId: true } });

    const flyers = await prisma.flyer.findMany({
      where: { customerId: contact.customerId },
      include: { size: true, industry: true },
      orderBy: { id: 'desc' }
    });

    const industries = await prisma.industry.findMany({ orderBy: { id: 'asc' } });
    const flyerSizes = await prisma.flyerSize.findMany({ orderBy: { name: 'asc' } });
    const foldingTypes = await prisma.foldingType.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });

    return NextResponse.json({ flyers, industries, flyerSizes, foldingTypes, customerIndustryId: customer?.industryId || null });
  } catch (error) {
    console.error('Fetch Portal Flyers Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}