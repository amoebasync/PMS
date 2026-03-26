import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';

// POST /api/training-manuals/upload
// 研修マニュアルページ画像をアップロードしてS3に保存（管理者専用）
export async function POST(request: NextRequest) {
  try {
    // 認証チェック
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session')?.value;
    if (!session) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const language = formData.get('language') as string | null;
    const version = formData.get('version') as string | null;
    const pageNumberRaw = formData.get('pageNumber');

    // バリデーション
    if (!file) {
      return NextResponse.json({ error: 'file が必要です' }, { status: 400 });
    }
    if (!language || !['ja', 'en'].includes(language)) {
      return NextResponse.json({ error: 'language は "ja" または "en" が必要です' }, { status: 400 });
    }
    if (!version || version.trim() === '') {
      return NextResponse.json({ error: 'version が必要です' }, { status: 400 });
    }
    const pageNumber = parseInt(pageNumberRaw as string, 10);
    if (isNaN(pageNumber) || pageNumber < 1) {
      return NextResponse.json({ error: 'pageNumber は正の整数が必要です' }, { status: 400 });
    }

    // ファイル種別チェック
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'PNG/JPG/WebP 形式の画像のみアップロード可能です' },
        { status: 400 }
      );
    }

    // 画像をWebPに変換（最大幅1200px、quality: 85）
    const inputBuffer = Buffer.from(await file.arrayBuffer());
    const image = sharp(inputBuffer);
    const metadata = await image.metadata();

    let pipeline = image;
    if (metadata.width && metadata.width > 1200) {
      pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
    }
    const webpBuffer = await pipeline.webp({ quality: 85 }).toBuffer();

    // S3にアップロード
    const s3Key = `uploads/training-manuals/${language}/${version}/page-${pageNumber}.webp`;
    const imageUrl = await uploadToS3(webpBuffer, s3Key, 'image/webp');

    // DBにUpsert（language + pageNumber + manualVersion のユニーク制約）
    const page = await prisma.trainingManualPage.upsert({
      where: {
        language_pageNumber_manualVersion: {
          language,
          pageNumber,
          manualVersion: version,
        },
      },
      create: {
        language,
        pageNumber,
        manualVersion: version,
        imageUrl,
        isActive: true,
      },
      update: {
        imageUrl,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      page: {
        id: page.id,
        pageNumber: page.pageNumber,
        imageUrl: page.imageUrl,
        language: page.language,
        manualVersion: page.manualVersion,
      },
    });
  } catch (error) {
    console.error('POST /api/training-manuals/upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
