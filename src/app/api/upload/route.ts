import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ファイル名をユニークにする (例: avatar-167890123.jpg)
    const ext = file.name.split('.').pop() || 'png';
    const filename = `avatar-${Date.now()}-${Math.round(Math.random() * 1000)}.${ext}`;

    const uploadDir = path.join(process.cwd(), 'public/uploads/avatars');

    // ディレクトリが存在しない場合は自動作成
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // 既に存在する場合は無視
    }

    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    // クライアント側からアクセスできるURLパスを返す
    const url = `/uploads/avatars/${filename}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: '画像のアップロードに失敗しました' }, { status: 500 });
  }
}