import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 見込み客を顧客に転換 (POST)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const leadId = parseInt(id);

    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    if (lead.convertedCustomerId) {
      return NextResponse.json({ error: '既に転換済みです', customerId: lead.convertedCustomerId }, { status: 400 });
    }

    const customerCode = `C${Date.now()}`;

    const [customer] = await prisma.$transaction([
      prisma.customer.create({
        data: {
          customerCode,
          name: lead.name,
          nameKana: lead.nameKana || null,
          phone: lead.phone || null,
          postalCode: lead.postalCode || null,
          address: lead.address || null,
          salesRepId: lead.salesRepId || null,
          campaignId: lead.campaignId || null,
          acquisitionChannel: lead.acquisitionChannel || null,
          status: 'VALID',
        },
      }),
      // Lead の更新は customer.id が必要なので後続で行う
    ]);

    await prisma.lead.update({
      where: { id: leadId },
      data: {
        convertedCustomerId: customer.id,
        convertedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, customerId: customer.id });
  } catch (error) {
    console.error('Lead Convert Error:', error);
    return NextResponse.json({ error: 'Failed to convert lead' }, { status: 500 });
  }
}
