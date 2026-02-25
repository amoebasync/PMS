import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 詳細取得 (GET)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const lead = await prisma.lead.findUnique({
      where: { id: parseInt(id) },
      include: {
        salesRep: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        campaign: { select: { id: true, name: true } },
      },
    });
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(lead);
  } catch (error) {
    console.error('Lead GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch lead' }, { status: 500 });
  }
}

// 更新 (PUT)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const salesRepId = body.salesRepId ? parseInt(body.salesRepId) : null;
    const campaignId = body.campaignId ? parseInt(body.campaignId) : null;

    const lead = await prisma.lead.update({
      where: { id: parseInt(id) },
      data: {
        name: body.name,
        nameKana: body.nameKana || null,
        contactName: body.contactName || null,
        contactEmail: body.contactEmail || null,
        phone: body.phone || null,
        postalCode: body.postalCode || null,
        address: body.address || null,
        stage: body.stage,
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
    console.error('Lead Update Error:', error);
    return NextResponse.json({ error: 'Failed to update lead' }, { status: 500 });
  }
}

// 削除 (DELETE)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.lead.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Lead Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete lead' }, { status: 500 });
  }
}
