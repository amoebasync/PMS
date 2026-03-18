import { NextResponse } from 'next/server';
import { getDistributorFromCookie } from '@/lib/distributorAuth';
import { getSubmitter, isDocusealConfigured } from '@/lib/docuseal';

/**
 * GET /api/staff/contract — 配布員自身の契約署名URLを取得
 * DocuSeal submitter の url フィールドに署名用URLが含まれる
 */
export async function GET() {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    // 既に署名済みの場合
    if (distributor.hasSignedContract || distributor.contractStatus === 'SIGNED') {
      return NextResponse.json({ status: 'SIGNED' });
    }

    // 契約書が送信されていない場合
    if (!distributor.docusealSubmitterId) {
      return NextResponse.json({ status: 'NOT_SENT' });
    }

    if (!isDocusealConfigured()) {
      return NextResponse.json({ error: 'DocuSealが設定されていません' }, { status: 500 });
    }

    // DocuSeal から submitter の署名URL を取得
    const submitter = await getSubmitter(distributor.docusealSubmitterId);

    if (submitter.completed_at) {
      // Webhook前にここに来た場合（既に署名済み）
      return NextResponse.json({ status: 'SIGNED' });
    }

    return NextResponse.json({
      status: 'PENDING',
      signingUrl: submitter.url,
    });
  } catch (error) {
    console.error('Staff contract GET error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
