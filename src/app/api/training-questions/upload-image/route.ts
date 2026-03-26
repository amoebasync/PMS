import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { uploadToS3, toProxyUrl } from '@/lib/s3';
import sharp from 'sharp';

// POST /api/training-questions/upload-image
// 管理者: 問題用画像アップロード（sharp でリサイズ → S3 → プロキシURL返却）
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
    }

    // 許可する MIME タイプ
    const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp'];
    const mimeType = file.type.toLowerCase();
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: '対応していない画像形式です。PNG, JPG, JPEG, WebP のみ対応しています' },
        { status: 400 }
      );
    }

    // ファイル拡張子チェック
    const originalName = file.name || '';
    const ext = originalName.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['png', 'jpg', 'jpeg', 'webp'];
    if (ext && !allowedExts.includes(ext)) {
      return NextResponse.json(
        { error: '対応していない画像形式です。PNG, JPG, JPEG, WebP のみ対応しています' },
        { status: 400 }
      );
    }

    // バッファに変換
    const arrayBuffer = await file.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // sharp でリサイズ（最大幅 800px）＋ WebP 変換（quality 85）
    const resizedBuffer = await sharp(inputBuffer)
      .resize({ width: 800, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    // S3 にアップロード
    const s3Key = `uploads/training-questions/${Date.now()}.webp`;
    await uploadToS3(resizedBuffer, s3Key, 'image/webp');
    const imageUrl = toProxyUrl(s3Key);

    return NextResponse.json({ imageUrl }, { status: 201 });
  } catch (error) {
    console.error('TrainingQuestion Image Upload Error:', error);
    return NextResponse.json({ error: '画像のアップロードに失敗しました' }, { status: 500 });
  }
}
