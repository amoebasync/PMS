import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
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
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const employeeId = parseInt(id);

    const s3Key = `uploads/bank-cards/employee-${employeeId}-bank-card-${Date.now()}.jpg`;
    const uploadUrl = await getPresignedPutUrl(s3Key, 'image/jpeg');

    return NextResponse.json({ uploadUrl, s3Key });
  } catch (error) {
    console.error('Bank Card Presign Error:', error);
    return NextResponse.json({ error: 'プリサインURL生成に失敗しました' }, { status: 500 });
  }
}

// POST: アップロード確認 + AI解析
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const employeeId = parseInt(id);

    const body = await request.json();
    const { s3Key } = body;

    if (!s3Key || !s3Key.startsWith('uploads/bank-cards/')) {
      return NextResponse.json({ error: '無効なS3キーです' }, { status: 400 });
    }

    // DB にカード画像URLを保存
    const imageUrl = toProxyUrl(s3Key);
    await prisma.employee.update({
      where: { id: employeeId },
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
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const employeeId = parseInt(id);

    const body = await request.json();

    await prisma.employeeFinancial.upsert({
      where: { employeeId },
      update: {
        bankId: body.bankId ? parseInt(body.bankId) : null,
        branchName: body.branchName || null,
        branchCode: body.branchCode || null,
        accountType: body.accountType || 'ORDINARY',
        accountNumber: body.accountNumber || null,
        accountName: body.accountName || null,
        accountNameKana: body.accountNameKana || null,
      },
      create: {
        employeeId,
        bankId: body.bankId ? parseInt(body.bankId) : null,
        branchName: body.branchName || null,
        branchCode: body.branchCode || null,
        accountType: body.accountType || 'ORDINARY',
        accountNumber: body.accountNumber || null,
        accountName: body.accountName || null,
        accountNameKana: body.accountNameKana || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bank Info Update Error:', error);
    return NextResponse.json({ error: '口座情報の保存に失敗しました' }, { status: 500 });
  }
}
