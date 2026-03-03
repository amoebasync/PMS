import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { getPresignedPutUrl, toProxyUrl } from '@/lib/s3';
import { isGeminiConfigured, extractBankCardData } from '@/lib/gemini';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const region = process.env.AWS_REGION || 'ap-northeast-1';
const bucket = process.env.AWS_S3_BUCKET || '';
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

async function fetchImageAsBase64(s3Key: string): Promise<{ base64: string; mimeType: string }> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: s3Key }));
  const bytes = await response.Body!.transformToByteArray();
  const base64 = Buffer.from(bytes).toString('base64');
  const mimeType = response.ContentType || 'image/jpeg';
  return { base64, mimeType };
}

// GET: プリサインドURL生成
export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const s3Key = `uploads/bank-cards/distributor-${distributor.id}-bank-card-${Date.now()}.jpg`;
    const uploadUrl = await getPresignedPutUrl(s3Key, 'image/jpeg');

    return NextResponse.json({ uploadUrl, s3Key });
  } catch (error) {
    console.error('Bank Card Presign Error:', error);
    return NextResponse.json({ error: 'プリサインURL生成に失敗しました' }, { status: 500 });
  }
}

// POST: アップロード確認 + AI解析
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const { s3Key } = body;

    if (!s3Key || !s3Key.startsWith('uploads/bank-cards/')) {
      return NextResponse.json({ error: '無効なS3キーです' }, { status: 400 });
    }

    // DB にカード画像URLを保存
    const imageUrl = toProxyUrl(s3Key);
    await prisma.flyerDistributor.update({
      where: { id: distributor.id },
      data: { bankCardImageUrl: imageUrl },
    });

    // Gemini AI でカード解析
    if (!isGeminiConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'AI解析機能が設定されていません。手動で口座情報を入力してください。',
        manualInput: true,
      });
    }

    const { base64, mimeType } = await fetchImageAsBase64(s3Key);
    const cardData = await extractBankCardData(base64, mimeType);

    if (!cardData.readable) {
      return NextResponse.json({
        success: false,
        error: cardData.errorReason || 'カードの読み取りに失敗しました。もう一度撮影してください。',
      });
    }

    return NextResponse.json({
      success: true,
      data: cardData,
    });
  } catch (error) {
    console.error('Bank Card Analysis Error:', error);
    return NextResponse.json({
      success: false,
      error: '解析中にエラーが発生しました。もう一度お試しください。',
    }, { status: 500 });
  }
}

// PUT: 確認後の口座情報保存
export async function PUT(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const body = await request.json();
    const {
      paymentMethod,
      bankName,
      bankBranchCode,
      bankAccountType,
      bankAccountNumber,
      bankAccountName,
      bankAccountNameKana,
    } = body;

    if (!paymentMethod || (paymentMethod !== '現金' && paymentMethod !== '振込')) {
      return NextResponse.json({ error: '無効な支払い方法です' }, { status: 400 });
    }

    const updateData: Record<string, string | null> = {
      paymentMethod,
    };

    if (paymentMethod === '振込') {
      updateData.bankName = bankName || null;
      updateData.bankBranchCode = bankBranchCode || null;
      updateData.bankAccountType = bankAccountType || null;
      updateData.bankAccountNumber = bankAccountNumber || null;
      updateData.bankAccountName = bankAccountName || null;
      updateData.bankAccountNameKana = bankAccountNameKana || null;
    }

    const updated = await prisma.flyerDistributor.update({
      where: { id: distributor.id },
      data: updateData,
    });

    const { passwordHash, ...safeData } = updated;
    return NextResponse.json(safeData);
  } catch (error) {
    console.error('Bank Info Update Error:', error);
    return NextResponse.json({ error: '口座情報の保存に失敗しました' }, { status: 500 });
  }
}
