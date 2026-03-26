import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { uploadToS3 } from '@/lib/s3';

/**
 * POST /api/staff/payroll/confirm
 * 配布員が現金受取を確認（署名画像付き）
 * Body: { payrollId: number, signature: string (base64 data URL) }
 */
export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { payrollId, signature } = await request.json();
    if (!payrollId || !signature) {
      return NextResponse.json({ error: 'payrollId and signature are required' }, { status: 400 });
    }

    // 本人のレコードか確認
    const record = await prisma.distributorPayrollRecord.findUnique({
      where: { id: payrollId },
    });
    if (!record || record.distributorId !== distributor.id) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    }
    if (record.status !== 'PAID') {
      return NextResponse.json({ error: 'Record is not in PAID status' }, { status: 400 });
    }
    if (record.cashReceivedAt) {
      return NextResponse.json({ error: 'Already confirmed' }, { status: 400 });
    }

    // 署名画像をS3にアップロード
    const base64Data = signature.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const key = `uploads/cash-receipts/${distributor.id}/${payrollId}_${Date.now()}.png`;
    const signatureUrl = await uploadToS3(buffer, key, 'image/png');

    // レコード更新
    const updated = await prisma.distributorPayrollRecord.update({
      where: { id: payrollId },
      data: {
        cashReceivedAt: new Date(),
        cashSignatureUrl: signatureUrl,
      },
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (error) {
    console.error('Staff Payroll Confirm Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
