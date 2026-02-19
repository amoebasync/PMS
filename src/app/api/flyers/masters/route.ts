import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. 業種マスタが空なら初期データを自動投入
    const industryCount = await prisma.industry.count();
    if (industryCount === 0) {
      await prisma.industry.createMany({
        data: [
          { name: '飲食デリバリー' },
          { name: '不動産・住宅' },
          { name: '学習塾・教育' },
          { name: '美容・サロン' },
          { name: 'スポーツジム・フィットネス' },
          { name: '水道・修理系' },
          { name: 'その他' },
        ]
      });
    }

    // 2. サイズマスタが空なら初期データを自動投入
    const sizeCount = await prisma.flyerSize.count();
    if (sizeCount === 0) {
      await prisma.flyerSize.createMany({
        data: [
          { name: 'A4', basePriceAddon: 0, isFoldRequired: false },
          { name: 'B4', basePriceAddon: 1.0, isFoldRequired: true },
          { name: 'A3', basePriceAddon: 1.5, isFoldRequired: true },
          { name: 'B3', basePriceAddon: 2.0, isFoldRequired: true },
          { name: 'ハガキ', basePriceAddon: 0, isFoldRequired: false },
          { name: 'その他', basePriceAddon: 0, isFoldRequired: false },
        ]
      });
    }

    // 3. マスタデータをすべて取得
    const [industries, sizes, customers] = await Promise.all([
      prisma.industry.findMany({ orderBy: { id: 'asc' } }),
      prisma.flyerSize.findMany({ orderBy: { basePriceAddon: 'asc' } }),
      prisma.customer.findMany({ where: { status: 'VALID' }, orderBy: { name: 'asc' } }) // 有効な顧客のみ
    ]);

    return NextResponse.json({ industries, sizes, customers });
  } catch (error) {
    console.error('Master Data Fetch Error:', error);
    return NextResponse.json({ error: 'Failed to fetch masters' }, { status: 500 });
  }
}