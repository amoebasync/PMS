import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const area = await prisma.area.findUnique({
      where: { id: parseInt(params.id) },
      include: { prefecture: true, city: true, areaRank: true },
    });
    if (!area) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(area);
  } catch (error) {
    console.error('Area fetch error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json();
    const updated = await prisma.area.update({
      where: { id: parseInt(params.id) },
      data: {
        town_name: body.town_name,
        chome_name: body.chome_name,
        door_to_door_count: Number(body.door_to_door_count),
        posting_cap_raw: Number(body.posting_cap_raw),
        posting_cap_with_ng: Number(body.posting_cap_with_ng),
        multi_family_count: Number(body.multi_family_count),
        is_client_visible: Number(body.is_client_visible),
        area_rank_id: body.area_rank_id ? Number(body.area_rank_id) : null,
      },
      include: { prefecture: true, city: true, areaRank: true },
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Area update error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
