import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import Busboy from 'busboy';
import { PDFParse } from 'pdf-parse';
import { uploadToS3, deleteFromS3, listS3Objects, getS3Url, getMimeType } from '@/lib/s3';


const S3_PREFIX = 'uploads/avatars/';

// ========================================================
// ★ Housekeep (お掃除) 関数
// S3上の古いファイルのうち、DBで使われていないものを削除する
// ========================================================
async function housekeepUploads() {
  try {
    const now = Date.now();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const [employees, printings] = await Promise.all([
      prisma.employee.findMany({
        select: { avatarUrl: true },
        where: { avatarUrl: { not: null } },
      }),
      prisma.orderPrinting.findMany({
        select: { frontDesignUrl: true, backDesignUrl: true },
        where: { OR: [{ frontDesignUrl: { not: null } }, { backDesignUrl: { not: null } }] },
      }),
    ]);

    const activeUrls = new Set<string>();
    employees.forEach(e => { if (e.avatarUrl) activeUrls.add(e.avatarUrl); });
    printings.forEach(p => {
      if (p.frontDesignUrl) activeUrls.add(p.frontDesignUrl);
      if (p.backDesignUrl) activeUrls.add(p.backDesignUrl);
    });

    const objects = await listS3Objects(S3_PREFIX);

    for (const obj of objects) {
      if (now - obj.lastModified.getTime() > ONE_DAY_MS) {
        const fileUrl = getS3Url(obj.key);
        if (!activeUrls.has(fileUrl)) {
          await deleteFromS3(obj.key);
          console.log(`[Housekeep] Deleted unused S3 object: ${obj.key}`);
        }
      }
    }
  } catch (error) {
    console.error('Housekeep Error:', error);
  }
}

// ========================================================
// ★ multipart/form-data を busboy で直接パースするヘルパー
// request.formData() は Next.js 内部の制限で大きなファイルが失敗するため
// ========================================================
type ParsedUpload = {
  file: { buffer: Buffer; originalName: string } | null;
  fields: Record<string, string>;
};

function parseMultipart(request: Request): Promise<ParsedUpload> {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get('content-type') ?? '';

    const busboy = Busboy({
      headers: { 'content-type': contentType },
      limits: { fileSize: 55 * 1024 * 1024 }, // 55MB
    });

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let originalName = '';

    busboy.on('field', (name, value) => {
      fields[name] = value;
    });

    busboy.on('file', (_name, stream, info) => {
      originalName = info.filename;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
      stream.on('error', reject);
    });

    busboy.on('finish', () => {
      resolve({
        file: fileBuffer ? { buffer: fileBuffer, originalName } : null,
        fields,
      });
    });

    busboy.on('error', reject);

    // Web ReadableStream → busboy へ流し込む
    const reader = request.body?.getReader();
    if (!reader) { reject(new Error('No request body')); return; }

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) { busboy.end(); break; }
          busboy.write(Buffer.from(value));
        }
      } catch (err) {
        reject(err);
      }
    };
    pump();
  });
}

// ========================================================
// ★ メインのアップロード処理
// ========================================================
export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const session = cookieStore.get('pms_session')?.value;
    if (!session) {
      return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
    }

    const { file, fields } = await parseMultipart(request);

    if (!file) {
      return NextResponse.json({ error: 'ファイルがありません' }, { status: 400 });
    }

    const orderNo  = fields.orderNo  || null;
    const title    = fields.title    || null;
    const sideName = fields.sideName || null;

    const ext = file.originalName.split('.').pop() || 'bin';
    let filename = '';

    // ★ 案件情報がある場合は、システム的に追跡しやすいファイル名に変更する
    if (orderNo && title) {
      const safeOrderNo = orderNo.replace(/[^a-zA-Z0-9_-]/g, '');
      const safeTitle   = title.replace(/[\/\\?%*:|"<> ]/g, '_');
      const safeSide    = sideName ? `_${sideName}` : '';
      // 例: WEB-20260221-199_焼肉屋チラシ_表面_1708611234567.pdf
      filename = `${safeOrderNo}_${safeTitle}${safeSide}_${Date.now()}.${ext}`;
    } else {
      filename = `file-${Date.now()}-${Math.round(Math.random() * 1000)}.${ext}`;
    }

    const s3Key = `${S3_PREFIX}${filename}`;
    const url = await uploadToS3(file.buffer, s3Key, getMimeType(ext));

    // PDF/AI ファイルのライブテキスト検出（アウトライン化チェック）
    let hasLiveText = false;
    if (['pdf', 'ai'].includes(ext.toLowerCase())) {
      try {
        const parser = new PDFParse({ data: new Uint8Array(file.buffer) });
        const result = await parser.getText();
        hasLiveText = result.text.trim().length > 0;
        await parser.destroy();
      } catch { /* 解析失敗でもアップロードは成功扱い */ }
    }

    // バックグラウンドでHousekeep処理を実行
    housekeepUploads().catch(e => console.error(e));

    return NextResponse.json({ url, hasLiveText });
  } catch (error) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'ファイルのアップロードに失敗しました' }, { status: 500 });
  }
}
