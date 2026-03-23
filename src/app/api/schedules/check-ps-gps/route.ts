import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

const PS_API_URL = process.env.POSTING_SYSTEM_API_URL;
const PS_API_KEY = process.env.POSTING_SYSTEM_API_KEY;

/**
 * POST /api/schedules/check-ps-gps
 * PMS session がないスケジュールに対して Posting System の GPS データの有無を一括チェック
 * body: { scheduleIds: number[] }
 * 結果を DB にキャッシュ（次回はAPIを叩かない）
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  if (!PS_API_URL) {
    return NextResponse.json({ error: 'Posting System not configured' }, { status: 500 });
  }

  try {
    const { scheduleIds } = await request.json();
    if (!Array.isArray(scheduleIds) || scheduleIds.length === 0) {
      return NextResponse.json({ results: {} });
    }

    // 未チェック or 当日falseのスケジュールを取得（当日分は再チェック対象）
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
    const todayStart = new Date(`${todayStr}T00:00:00+09:00`);
    const todayEnd = new Date(`${todayStr}T23:59:59.999+09:00`);
    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        id: { in: scheduleIds },
        session: null,
        OR: [
          { psGpsAvailable: null },
          { psGpsAvailable: false, date: { gte: todayStart, lte: todayEnd } },
        ],
      },
      select: {
        id: true,
        date: true,
        distributor: { select: { staffId: true } },
      },
    });

    const results: Record<number, { available: boolean; lastTime: string | null }> = {};

    // 配布員ごとにグループ化（同じstaffId+dateは1回のAPI呼び出しで済む）
    const grouped = new Map<string, { staffId: string; date: string; scheduleIds: number[] }>();
    for (const s of schedules) {
      if (!s.distributor?.staffId || !s.date) continue;
      const dateStr = new Date(s.date).toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' });
      const key = `${s.distributor.staffId}_${dateStr}`;
      if (!grouped.has(key)) {
        grouped.set(key, { staffId: s.distributor.staffId, date: dateStr, scheduleIds: [] });
      }
      grouped.get(key)!.scheduleIds.push(s.id);
    }

    // Posting System API を呼び出し（並列、最大5件ずつ）
    const entries = [...grouped.values()];
    for (let i = 0; i < entries.length; i += 5) {
      const batch = entries.slice(i, i + 5);
      await Promise.all(batch.map(async (entry) => {
        try {
          const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
          if (PS_API_KEY) headers['X-API-Key'] = PS_API_KEY;

          const res = await fetch(`${PS_API_URL}/GetStaffGPS.php`, {
            method: 'POST',
            headers,
            body: new URLSearchParams({ STAFF_ID: entry.staffId, TARGET_DATE: entry.date }).toString(),
            signal: AbortSignal.timeout(8000),
          });

          let available = false;
          let lastTime: string | null = null;

          if (res.ok) {
            const text = await res.text();
            try {
              const rows = JSON.parse(text.trim());
              if (Array.isArray(rows)) {
                // 有効なGPSポイント（lat/lngが0でない）をフィルタ
                const validRows = rows.filter((r: any) => {
                  const lat = parseFloat(r.LATITUDE || '0');
                  const lng = parseFloat(r.LONGITUDE || '0');
                  return lat !== 0 && lng !== 0;
                });
                available = validRows.length > 0;
                if (available && validRows.length > 0) {
                  const lastTerminal = validRows[validRows.length - 1].TERMINAL_TIME || '';
                  // "14:37:09" → "14:37"
                  lastTime = lastTerminal.substring(0, 5);
                }
              }
            } catch { /* parse error */ }
          }

          // DB キャッシュ更新 + GPSデータありなら配布中ステータスに変更
          const updateData: any = { psGpsAvailable: available, psGpsLastTime: lastTime };
          await prisma.distributionSchedule.updateMany({
            where: { id: { in: entry.scheduleIds } },
            data: updateData,
          });
          if (available) {
            // UNSTARTED/IN_PROGRESS → DISTRIBUTING に変更（COMPLETEDは触らない）
            await prisma.distributionSchedule.updateMany({
              where: { id: { in: entry.scheduleIds }, status: { in: ['UNSTARTED', 'IN_PROGRESS'] } },
              data: { status: 'DISTRIBUTING' },
            });
          }

          for (const sid of entry.scheduleIds) {
            results[sid] = { available, lastTime };
          }
        } catch (e) {
          // タイムアウト等 → 結果を保存しない（次回再チェック）
          console.error(`[PS GPS Check] Failed for ${entry.staffId}:`, e);
        }
      }));
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error('PS GPS Check Error:', error);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
