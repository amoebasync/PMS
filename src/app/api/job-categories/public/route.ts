import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/job-categories/public
// 公開API: アクティブな職種一覧を返す
export async function GET() {
  try {
    const categories = await prisma.jobCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        nameJa: true,
        nameEn: true,
      },
    });

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Job Categories Fetch Error:', error);
    return NextResponse.json({ error: '職種の取得に失敗しました' }, { status: 500 });
  }
}
