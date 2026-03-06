import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);
    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    const body = await request.json();
    const { prefectureId } = body;
    if (!prefectureId || typeof prefectureId !== 'number') {
      return NextResponse.json({ error: 'prefectureId is required and must be a number' }, { status: 400 });
    }

    const areas = await prisma.area.findMany({
      where: { prefecture_id: prefectureId },
      select: { id: true },
    });

    if (areas.length === 0) {
      return NextResponse.json({ success: true, count: 0 });
    }

    const result = await prisma.partnerCoverageArea.createMany({
      data: areas.map((area) => ({ partnerId, areaId: area.id })),
      skipDuplicates: true,
    });

    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error('Add Coverage Areas by Prefecture Error:', error);
    return NextResponse.json({ error: 'Failed to add coverage areas by prefecture' }, { status: 500 });
  }
}
