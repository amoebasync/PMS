import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 認証不要 — カート計算のためログイン前でも取得可能
export async function GET() {
  try {
    const [flyerSizes, foldingTypes, areaRanks, periodPrices] = await Promise.all([
      prisma.flyerSize.findMany({ orderBy: { name: 'asc' } }),
      prisma.foldingType.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      prisma.areaRank.findMany({ orderBy: { name: 'asc' } }),
      prisma.distributionPeriodPrice.findMany({ orderBy: { minDays: 'asc' } }),
    ]);

    return NextResponse.json({ flyerSizes, foldingTypes, areaRanks, periodPrices });
  } catch (error) {
    console.error('Portal Pricing GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
  }
}
