import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pms_session');
  return !!session?.value;
}

export async function GET() {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [flyerSizes, areaRanks, foldingTypes, periodPrices] = await Promise.all([
    prisma.flyerSize.findMany({ orderBy: { id: 'asc' } }),
    prisma.areaRank.findMany({ orderBy: { name: 'asc' } }),
    prisma.foldingType.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.distributionPeriodPrice.findMany({ orderBy: { minDays: 'asc' } }),
  ]);

  return NextResponse.json({ flyerSizes, areaRanks, foldingTypes, periodPrices });
}

export async function POST(request: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, data } = body;

  try {
    let result;
    if (type === 'foldingType') {
      result = await prisma.foldingType.create({
        data: {
          name: data.name,
          unitPrice: parseFloat(data.unitPrice),
          sortOrder: parseInt(data.sortOrder ?? 0),
          isActive: data.isActive ?? true,
        }
      });
    } else if (type === 'areaRank') {
      result = await prisma.areaRank.create({
        data: {
          name: data.name,
          postingUnitPrice: parseFloat(data.postingUnitPrice),
          description: data.description || null,
        }
      });
    } else if (type === 'periodPrice') {
      result = await prisma.distributionPeriodPrice.create({
        data: {
          minDays: parseInt(data.minDays),
          maxDays: data.maxDays ? parseInt(data.maxDays) : null,
          multiplier: parseFloat(data.multiplier),
          label: data.label || null,
        }
      });
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Pricing POST Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, id, data } = body;

  try {
    let result;
    if (type === 'foldingType') {
      result = await prisma.foldingType.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name,
          unitPrice: parseFloat(data.unitPrice),
          sortOrder: parseInt(data.sortOrder ?? 0),
          isActive: data.isActive ?? true,
        }
      });
    } else if (type === 'areaRank') {
      result = await prisma.areaRank.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name,
          postingUnitPrice: parseFloat(data.postingUnitPrice),
          description: data.description || null,
        }
      });
    } else if (type === 'periodPrice') {
      result = await prisma.distributionPeriodPrice.update({
        where: { id: parseInt(id) },
        data: {
          minDays: parseInt(data.minDays),
          maxDays: data.maxDays ? parseInt(data.maxDays) : null,
          multiplier: parseFloat(data.multiplier),
          label: data.label || null,
        }
      });
    } else if (type === 'flyerSize') {
      result = await prisma.flyerSize.update({
        where: { id: parseInt(id) },
        data: {
          printUnitPrice: parseFloat(data.printUnitPrice),
          basePriceAddon: parseFloat(data.basePriceAddon ?? 0),
        }
      });
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Pricing PUT Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const id = parseInt(searchParams.get('id') || '0');

  try {
    if (type === 'foldingType') {
      await prisma.foldingType.delete({ where: { id } });
    } else if (type === 'areaRank') {
      await prisma.areaRank.delete({ where: { id } });
    } else if (type === 'periodPrice') {
      await prisma.distributionPeriodPrice.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pricing DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
