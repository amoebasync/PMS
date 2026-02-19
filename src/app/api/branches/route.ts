import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const parseIntSafe = (n: any) => n ? parseInt(n, 10) : null;

export async function GET() {
  try {
    const branches = await prisma.branch.findMany({
      orderBy: { id: 'asc' },
      include: {
        manager1: true,
        manager2: true,
        manager3: true,
        manager4: true,
      }
    });
    return NextResponse.json(branches);
  } catch (error) {
    console.error('Fetch Branches Error:', error);
    return NextResponse.json({ error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newBranch = await prisma.branch.create({
      data: {
        nameJa: body.nameJa,
        nameEn: body.nameEn,
        address: body.address,
        googleMapUrl: body.googleMapUrl,
        openingTime: body.openingTime,
        closedDays: body.closedDays,
        manager1Id: parseIntSafe(body.manager1Id),
        manager2Id: parseIntSafe(body.manager2Id),
        manager3Id: parseIntSafe(body.manager3Id),
        manager4Id: parseIntSafe(body.manager4Id),
      },
      include: {
        manager1: true,
        manager2: true,
        manager3: true,
        manager4: true,
      }
    });

    return NextResponse.json(newBranch);
  } catch (error) {
    console.error('Create Branch Error:', error);
    return NextResponse.json({ error: 'Failed to create branch' }, { status: 500 });
  }
}