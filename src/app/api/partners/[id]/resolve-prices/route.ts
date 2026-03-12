import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * POST /api/partners/[id]/resolve-prices
 * body: { items: [{ flyerName, flyerCode, customerCode }] }
 *
 * 単価解決の優先順位:
 * 1. PartnerFlyerPrice: flyerName + flyerCode 完全一致
 * 2. PartnerFlyerPrice: flyerName のみ一致
 * 3. 外部API: postingsystem.net にflyerCodeで問い合わせ
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error } = await requireAdminSession();
    if (error) return error;

    const { id } = await params;
    const partnerId = parseInt(id);
    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    const body = await request.json();
    const items: { flyerName: string; flyerCode: string | null; customerCode: string | null }[] = body.items || [];

    // 単価マスタを取得
    const flyerPrices = await prisma.partnerFlyerPrice.findMany({
      where: { partnerId },
    });

    const results: { flyerName: string; flyerCode: string | null; unitPrice: number | null; source: string }[] = [];

    for (const item of items) {
      const fn = (item.flyerName || '').trim();
      const fc = (item.flyerCode || '').trim() || null;
      const cc = (item.customerCode || '').trim() || null;

      // 1. flyerName + customerCode + flyerCode 完全一致
      let match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && p.flyerCode === fc);
      if (match) {
        results.push({ flyerName: fn, flyerCode: fc, unitPrice: match.unitPrice, source: 'price_master_exact' });
        continue;
      }

      // 2. flyerName + customerCode のみ
      if (cc) {
        match = flyerPrices.find(p => p.flyerName === fn && p.customerCode === cc && !p.flyerCode);
        if (match) {
          results.push({ flyerName: fn, flyerCode: fc, unitPrice: match.unitPrice, source: 'price_master_customer' });
          continue;
        }
      }

      // 3. flyerName のみ
      match = flyerPrices.find(p => p.flyerName === fn && !p.customerCode && !p.flyerCode);
      if (match) {
        results.push({ flyerName: fn, flyerCode: fc, unitPrice: match.unitPrice, source: 'price_master_name' });
        continue;
      }

      // 4. 外部API（flyerCodeがある場合）
      if (fc) {
        try {
          const externalPrice = await fetchExternalPrice(fc);
          if (externalPrice != null) {
            results.push({ flyerName: fn, flyerCode: fc, unitPrice: externalPrice, source: 'external_api' });
            continue;
          }
        } catch (e) {
          console.error(`External API error for flyerCode=${fc}:`, e);
        }
      }

      // 解決できなかった
      results.push({ flyerName: fn, flyerCode: fc, unitPrice: null, source: 'not_found' });
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('POST /api/partners/[id]/resolve-prices error:', error);
    return NextResponse.json({ error: 'Failed to resolve prices' }, { status: 500 });
  }
}

/**
 * 外部API（postingsystem.net）から単価を取得
 * flyerCode = 広告物管理番号 = RECEIVED_ORDER_HEADER_NO
 */
async function fetchExternalPrice(flyerCode: string): Promise<number | null> {
  try {
    const formData = new URLSearchParams();
    formData.append('RECEIVED_ORDER_HEADER_NO', flyerCode);

    const res = await fetch('https://postingsystem.net/postingmanage/GetPostingAmount.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    // レスポンス例: { "POSTING_AMOUNT": "5.5" } or { "POSTING_AMOUNT": "" }
    const amount = data?.POSTING_AMOUNT;
    if (amount != null && amount !== '' && !isNaN(Number(amount))) {
      return Number(amount);
    }
    return null;
  } catch {
    return null;
  }
}
