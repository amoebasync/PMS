import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { uploadToS3 } from '@/lib/s3';

/**
 * PDFをページごとの画像に変換する
 * pdfjs-dist (legacy) + canvas を使用
 */
async function convertPdfToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
  // 動的requireでTurbopackの静的解析を回避
  const pdfPath = 'pdfjs-dist/legacy/build/pdf.js';
  const canvasPath = 'canvas';
  const pdfjsLib = require(/* webpackIgnore: true */ pdfPath);
  const { createCanvas } = require(/* webpackIgnore: true */ canvasPath);

  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const pageImages: Buffer[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    // 2x scale for crisp rendering
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = canvas.getContext('2d');

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    // canvas → PNG buffer
    const pngBuffer = canvas.toBuffer('image/png');
    pageImages.push(pngBuffer);
  }

  return pageImages;
}

// POST /api/training-manuals/upload
// 研修マニュアルをアップロード（画像 or PDF→画像変換）
export async function POST(request: NextRequest) {
  try {
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

    if (!file) {
      return NextResponse.json({ error: 'file が必要です' }, { status: 400 });
    }
    if (!language || !['ja', 'en'].includes(language)) {
      return NextResponse.json({ error: 'language は "ja" または "en" が必要です' }, { status: 400 });
    }
    if (!version || version.trim() === '') {
      return NextResponse.json({ error: 'version が必要です' }, { status: 400 });
    }

    const imageTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const isPdf = file.type === 'application/pdf';
    if (!imageTypes.includes(file.type) && !isPdf) {
      return NextResponse.json(
        { error: 'PNG/JPG/WebP/PDF 形式のファイルのみアップロード可能です' },
        { status: 400 }
      );
    }

    const inputBuffer = Buffer.from(await file.arrayBuffer());

    if (isPdf) {
      // === PDF: 全ページを画像に変換して個別にアップロード ===
      const pageImages = await convertPdfToImages(inputBuffer);
      const pages: any[] = [];

      // 既存のこのバージョン・言語のページを全削除（再アップロード対応）
      await prisma.trainingManualPage.deleteMany({
        where: { language, manualVersion: version },
      });

      for (let i = 0; i < pageImages.length; i++) {
        const pgNum = i + 1;
        // sharp で WebP に変換（最大幅1200px）
        let pipeline = sharp(pageImages[i]);
        const metadata = await pipeline.metadata();
        if (metadata.width && metadata.width > 1200) {
          pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
        }
        const webpBuffer = await pipeline.webp({ quality: 85 }).toBuffer();

        const s3Key = `uploads/training-manuals/${language}/${version}/page-${pgNum}.webp`;
        const imageUrl = await uploadToS3(webpBuffer, s3Key, 'image/webp');

        const page = await prisma.trainingManualPage.create({
          data: {
            language,
            pageNumber: pgNum,
            manualVersion: version,
            imageUrl,
            isActive: true,
          },
        });
        pages.push({
          id: page.id,
          pageNumber: page.pageNumber,
          imageUrl: page.imageUrl,
        });
      }

      return NextResponse.json({
        success: true,
        pdfConverted: true,
        totalPages: pages.length,
        pages,
      });
    } else {
      // === 画像: 従来通り1ページ分 ===
      const pageNumber = parseInt(pageNumberRaw as string, 10);
      if (isNaN(pageNumber) || pageNumber < 1) {
        return NextResponse.json({ error: 'pageNumber は正の整数が必要です' }, { status: 400 });
      }

      const image = sharp(inputBuffer);
      const metadata = await image.metadata();
      let pipeline = image;
      if (metadata.width && metadata.width > 1200) {
        pipeline = pipeline.resize({ width: 1200, withoutEnlargement: true });
      }
      const webpBuffer = await pipeline.webp({ quality: 85 }).toBuffer();
      const s3Key = `uploads/training-manuals/${language}/${version}/page-${pageNumber}.webp`;
      const imageUrl = await uploadToS3(webpBuffer, s3Key, 'image/webp');

      const page = await prisma.trainingManualPage.upsert({
        where: {
          language_pageNumber_manualVersion: {
            language,
            pageNumber,
            manualVersion: version,
          },
        },
        create: { language, pageNumber, manualVersion: version, imageUrl, isActive: true },
        update: { imageUrl, updatedAt: new Date() },
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
    }
  } catch (error) {
    console.error('POST /api/training-manuals/upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
