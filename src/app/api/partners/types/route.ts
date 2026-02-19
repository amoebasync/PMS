import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. マスタが空なら初期データを自動投入
    const count = await prisma.partnerType.count();
    if (count === 0) {
      await prisma.partnerType.createMany({
        data: [
          { name: '印刷会社' },
          { name: '新聞折込' },
          { name: 'デザイン' },
          { name: 'その他' },
        ]
      });
    }

    // 2. マスタ一覧を取得
    const partnerTypes = await prisma.partnerType.findMany({ orderBy: { id: 'asc' } });
    return NextResponse.json(partnerTypes);
  } catch (error) {
    console.error('Fetch PartnerTypes Error:', error);
    return NextResponse.json({ error: 'Failed to fetch partner types' }, { status: 500 });
  }
}