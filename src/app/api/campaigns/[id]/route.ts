import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 更新 (PUT)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaignId = parseInt(id);
    const body = await request.json();

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        name: body.name,
        description: body.description || null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        isActive: body.isActive !== false,
      },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Campaign Update Error:', error);
    return NextResponse.json({ error: 'Failed to update campaign' }, { status: 500 });
  }
}

// 削除 (DELETE) - 論理削除
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const campaignId = parseInt(id);

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: { isActive: false },
    });

    return NextResponse.json(campaign);
  } catch (error) {
    console.error('Campaign Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete campaign' }, { status: 500 });
  }
}
