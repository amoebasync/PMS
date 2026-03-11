import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';


export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const isActive = searchParams.get('isActive');
    const typeId = searchParams.get('typeId');

    const where: Record<string, unknown> = {};
    if (search) {
      where.name = { contains: search };
    }
    if (isActive !== null && isActive !== undefined && isActive !== '') {
      where.isActive = isActive === 'true';
    }
    if (typeId) {
      where.partnerTypeId = parseInt(typeId, 10);
    }

    const partners = await prisma.partner.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        partnerType: true,
        _count: {
          select: {
            coverageAreas: true,
            incidents: true,
          }
        }
      }
    });
    return NextResponse.json(partners);
  } catch (error) {
    console.error('Fetch Partners Error:', error);
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;
  try {
    const body = await request.json();

    const newPartner = await prisma.partner.create({
      data: {
        name: body.name,
        partnerTypeId: parseInt(body.partnerTypeId, 10), // ★ IDとして保存
        contactInfo: body.contactInfo || null,
      },
    });

    return NextResponse.json(newPartner);
  } catch (error) {
    console.error('Create Partner Error:', error);
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 });
  }
}