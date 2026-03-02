import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/visa-types/public
// 公開API: ビザ種類一覧を返す
export async function GET() {
  try {
    const visaTypes = await prisma.visaType.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        nameEn: true,
      },
    });

    return NextResponse.json(visaTypes);
  } catch (error) {
    console.error('Visa Types Fetch Error:', error);
    return NextResponse.json({ error: 'ビザ種類の取得に失敗しました' }, { status: 500 });
  }
}
