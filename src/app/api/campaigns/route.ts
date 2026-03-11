import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';


// 一覧取得 (GET)
export async function GET() {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const campaigns = await prisma.campaign.findMany({
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('Campaign Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

// 新規作成 (POST)
export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const body = await request.json();

    const campaign = await prisma.campaign.create({
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
    console.error('Campaign Create Error:', error);
    return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
  }
}
