import { NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, stat, unlink } from 'fs/promises';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ========================================================
// ★ Housekeep (お掃除) 関数
// フォルダ内の古いファイルのうち、DBで使われていないものを削除する
// ========================================================
async function housekeepUploads(uploadDir: string) {
  try {
    const files = await readdir(uploadDir);
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const [employees, printings] = await Promise.all([
      prisma.employee.findMany({ 
        select: { avatarUrl: true }, 
        where: { avatarUrl: { not: null } } 
      }),
      prisma.orderPrinting.findMany({ 
        select: { frontDesignUrl: true, backDesignUrl: true },
        where: { OR: [{ frontDesignUrl: { not: null } }, { backDesignUrl: { not: null } }] }
      })
    ]);

    const activeUrls = new Set<string>();
    employees.forEach(e => { if (e.avatarUrl) activeUrls.add(e.avatarUrl); });
    printings.forEach(p => {
      if (p.frontDesignUrl) activeUrls.add(p.frontDesignUrl);
      if (p.backDesignUrl) activeUrls.add(p.backDesignUrl);
    });

    for (const file of files) {
      if (file.startsWith('.')) continue;

      const filePath = path.join(uploadDir, file);
      const fileStat = await stat(filePath);
      
      if (now - fileStat.mtimeMs > ONE_DAY_MS) {
        const fileUrl = `/uploads/avatars/${file}`;
        if (!activeUrls.has(fileUrl)) {
          await unlink(filePath);
          console.log(`[Housekeep] Deleted unused file: ${file}`);
        }
      }
    }
  } catch (error) {
    console.error('Housekeep Error:', error);
  }
}

// ========================================================
// ★ メインのアップロード処理
// ========================================================
export async function POST(request: Request) {
  try {
    const data = await request.formData();
    const file = data.get('file') as File;
    
    // ★ 追加: フロントエンドから送られてくる案件情報を受け取る
    const orderNo = data.get('orderNo') as string | null;
    const title = data.get('title') as string | null;
    const sideName = data.get('sideName') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const ext = file.name.split('.').pop() || 'png';
    let filename = '';

    // ★ 案件情報がある場合は、システム的に追跡しやすいファイル名に変更する
    if (orderNo && title) {
      // OSのファイル名で使えない記号やスペースをアンダースコアに置換する安全処理
      const safeOrderNo = orderNo.replace(/[^a-zA-Z0-9_-]/g, '');
      const safeTitle = title.replace(/[\/\\?%*:|"<> ]/g, '_');
      const safeSide = sideName ? `_${sideName}` : '';
      
      // 例: WEB-20260221-199_焼肉屋チラシ_表面_1708611234567.pdf
      filename = `${safeOrderNo}_${safeTitle}${safeSide}_${Date.now()}.${ext}`;
    } else {
      // 指定がない場合（アバター画像など）は従来のランダム生成
      filename = `file-${Date.now()}-${Math.round(Math.random() * 1000)}.${ext}`;
    }

    const uploadDir = path.join(process.cwd(), 'public/uploads/avatars');

    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // 既に存在する場合は無視
    }

    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const url = `/uploads/avatars/${filename}`;

    // バックグラウンドでHousekeep処理を実行
    housekeepUploads(uploadDir).catch(e => console.error(e));

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'ファイルのアップロードに失敗しました' }, { status: 500 });
  }
}