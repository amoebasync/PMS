import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const partners = await prisma.partner.findMany({
      orderBy: { id: 'desc' },
      include: { partnerType: true } // ★ マスタの名前も一緒に取得する
    });
    return NextResponse.json(partners);
  } catch (error) {
    console.error('Fetch Partners Error:', error);
    return NextResponse.json({ error: 'Failed to fetch partners' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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