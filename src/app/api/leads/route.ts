import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 一覧取得 (GET)
export async function GET() {
  try {
    const leads = await prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        salesRep: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        campaign: { select: { id: true, name: true } },
      },
    });
    return NextResponse.json(leads);
  } catch (error) {
    console.error('Lead Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
  }
}

// 新規作成 (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const salesRepId = body.salesRepId ? parseInt(body.salesRepId) : null;
    const campaignId = body.campaignId ? parseInt(body.campaignId) : null;

    const lead = await prisma.lead.create({
      data: {
        name: body.name,
        nameKana: body.nameKana || null,
        contactName: body.contactName || null,
        contactEmail: body.contactEmail || null,
        phone: body.phone || null,
        postalCode: body.postalCode || null,
        address: body.address || null,
        stage: body.stage || 'APPROACH',
        acquisitionChannel: body.acquisitionChannel || null,
        salesRepId,
        campaignId,
        note: body.note || null,
        nextAction: body.nextAction || null,
        expectedCloseDate: body.expectedCloseDate ? new Date(body.expectedCloseDate) : null,
      },
    });

    return NextResponse.json(lead);
  } catch (error) {
    console.error('Lead Create Error:', error);
    return NextResponse.json({ error: 'Failed to create lead' }, { status: 500 });
  }
}
