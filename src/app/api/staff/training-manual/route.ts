import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';

// GET /api/staff/training-manual — 研修マニュアル取得
export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const lang = distributor.language || 'ja';

    // 言語に合うアクティブなページを取得
    let pages = await prisma.trainingManualPage.findMany({
      where: { language: lang, isActive: true },
      orderBy: [{ manualVersion: 'desc' }, { pageNumber: 'asc' }],
      select: { pageNumber: true, imageUrl: true, manualVersion: true },
    });

    // 対象言語のページがなければ別言語にフォールバック
    if (pages.length === 0) {
      const fallbackLang = lang === 'ja' ? 'en' : 'ja';
      pages = await prisma.trainingManualPage.findMany({
        where: { language: fallbackLang, isActive: true },
        orderBy: [{ manualVersion: 'desc' }, { pageNumber: 'asc' }],
        select: { pageNumber: true, imageUrl: true, manualVersion: true },
      });
    }

    if (pages.length === 0) {
      return NextResponse.json({ pages: [], version: null, totalPages: 0 });
    }

    // 最新バージョンのページのみを使用
    const latestVersion = pages[0].manualVersion;
    const latestPages = pages.filter((p) => p.manualVersion === latestVersion);

    return NextResponse.json({
      pages: latestPages.map((p) => ({
        pageNumber: p.pageNumber,
        imageUrl: p.imageUrl,
      })),
      version: latestVersion,
      totalPages: latestPages.length,
    });
  } catch (error) {
    console.error('Training Manual GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
