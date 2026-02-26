import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/countries/public
// 公開API: 国籍一覧を返す
export async function GET() {
  try {
    const countries = await prisma.country.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
      },
    });

    return NextResponse.json(countries);
  } catch (error) {
    console.error('Countries Fetch Error:', error);
    return NextResponse.json({ error: '国籍の取得に失敗しました' }, { status: 500 });
  }
}
