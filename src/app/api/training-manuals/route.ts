import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { deleteFromS3, listS3Objects } from '@/lib/s3';

// GET /api/training-manuals?language=ja&version=1.0
// 研修マニュアルページ一覧をバージョンごとにグループ化して返す（管理者専用）
export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session')?.value;
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language');
    const version = searchParams.get('version');

    // フィルタ条件を構築
    const where: Record<string, string> = {};
    if (language) where.language = language;
    if (version) where.manualVersion = version;

    const pages = await prisma.trainingManualPage.findMany({
      where,
      orderBy: { pageNumber: 'asc' },
    });

    // バージョンごとにグループ化
    const versionMap = new Map<
      string,
      {
        version: string;
        language: string;
        pages: typeof pages;
        createdAt: Date;
      }
    >();

    for (const page of pages) {
      const key = `${page.language}::${page.manualVersion}`;
      if (!versionMap.has(key)) {
        versionMap.set(key, {
          version: page.manualVersion,
          language: page.language,
          pages: [],
          createdAt: page.createdAt,
        });
      }
      versionMap.get(key)!.pages.push(page);
    }

    const versions = Array.from(versionMap.values());

    return NextResponse.json({ versions });
  } catch (error) {
    console.error('GET /api/training-manuals error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE /api/training-manuals?language=ja&version=1.0
// 指定バージョンの全ページをS3とDBから削除（管理者専用）
export async function DELETE(request: NextRequest) {
  try {
    // 認証チェック
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session')?.value;
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const language = searchParams.get('language');
    const version = searchParams.get('version');

    if (!language) {
      return NextResponse.json({ error: 'language パラメータが必要です' }, { status: 400 });
    }
    if (!version) {
      return NextResponse.json({ error: 'version パラメータが必要です' }, { status: 400 });
    }

    // S3 オブジェクトを一覧して削除
    const s3Prefix = `uploads/training-manuals/${language}/${version}/`;
    const s3Objects = await listS3Objects(s3Prefix);

    for (const obj of s3Objects) {
      await deleteFromS3(obj.key);
    }

    // DBレコードを削除
    const result = await prisma.trainingManualPage.deleteMany({
      where: {
        language,
        manualVersion: version,
      },
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error('DELETE /api/training-manuals error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
