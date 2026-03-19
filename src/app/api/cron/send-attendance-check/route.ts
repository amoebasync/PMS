import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { pushMessage, isLineConfigured } from '@/lib/line';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * POST /api/cron/send-attendance-check
 * 毎朝6:00 JST (UTC 21:00前日) に実行
 * 当日スケジュールのある配布員にLINEで出勤予定時刻を質問する
 */
export async function POST(request: Request) {
  // 2台構成の重複実行防止
  if (process.env.CRON_PRIMARY !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'not primary' });
  }

  // Bearer トークン認証
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE not configured' }, { status: 500 });
  }

  try {
    // JSTで当日の日付を取得
    const nowJst = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
    const todayStr = `${nowJst.getFullYear()}-${String(nowJst.getMonth() + 1).padStart(2, '0')}-${String(nowJst.getDate()).padStart(2, '0')}`;
    const todayStart = new Date(`${todayStr}T00:00:00+09:00`);
    const todayEnd = new Date(`${todayStr}T23:59:59+09:00`);

    // 当日のスケジュールを取得（配布員あり、relayTasksも含む）
    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        date: { gte: todayStart, lte: todayEnd },
        distributorId: { not: null },
      },
      include: {
        distributor: {
          include: {
            lineUser: true,
          },
        },
        relayTasks: { select: { type: true } },
      },
    });

    // 全タスクがFULL_RELAYのスケジュールを除外
    const eligibleSchedules = schedules.filter(s => {
      const relayTasks = s.relayTasks || [];
      if (relayTasks.length === 0) return true; // リレータスクなし → 対象
      // 全てがFULL_RELAYの場合のみ除外
      const allFullRelay = relayTasks.every(rt => rt.type === 'FULL_RELAY');
      return !allFullRelay;
    });

    // 配布員の重複排除（1人1通）
    const distributorMap = new Map<number, {
      distributorId: number;
      lineUserId: string;
      language: string;
    }>();

    for (const s of eligibleSchedules) {
      if (!s.distributor || !s.distributorId) continue;
      if (distributorMap.has(s.distributorId)) continue;

      const lineUser = s.distributor.lineUser;
      if (!lineUser || !lineUser.isFollowing) continue;

      distributorMap.set(s.distributorId, {
        distributorId: s.distributorId,
        lineUserId: lineUser.lineUserId,
        language: s.distributor.language || 'ja',
      });
    }

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [, info] of distributorMap) {
      try {
        const message = buildAttendanceFlexMessage(
          info.language,
          info.distributorId,
          todayStr
        );
        await pushMessage(info.lineUserId, [message]);
        sent++;
        console.log(`[AttendanceCheck] Sent to distributorId=${info.distributorId} (${info.language})`);
      } catch (e: any) {
        skipped++;
        errors.push(`distributorId=${info.distributorId}: ${e.message}`);
        console.error(`[AttendanceCheck] Failed for distributorId=${info.distributorId}:`, e);
      }
    }

    const totalDistributors = schedules
      .filter(s => s.distributorId)
      .reduce((set, s) => { set.add(s.distributorId!); return set; }, new Set<number>())
      .size;
    const noLineCount = totalDistributors - distributorMap.size;

    console.log(`[AttendanceCheck] Complete: sent=${sent}, failed=${skipped}, noLine=${noLineCount}, fullRelayExcluded=${schedules.length - eligibleSchedules.length}`);

    return NextResponse.json({
      success: true,
      date: todayStr,
      sent,
      skipped,
      noLine: noLineCount,
      fullRelayExcluded: schedules.length - eligibleSchedules.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[AttendanceCheck] Error:', error);
    return NextResponse.json({ error: '出勤確認の送信に失敗しました' }, { status: 500 });
  }
}

/** 出勤確認 Flex Message を構築（JA/EN対応） */
function buildAttendanceFlexMessage(
  lang: string,
  distributorId: number,
  dateStr: string
) {
  const isJa = lang === 'ja';

  // 7:00〜11:00の30分刻み = 9ボタン
  const timeSlots = [
    '7:00', '7:30', '8:00',
    '8:30', '9:00', '9:30',
    '10:00', '10:30', '11:00',
  ];

  // 3列 x 3行のgrid
  const rows: any[] = [];
  for (let i = 0; i < timeSlots.length; i += 3) {
    const rowButtons = timeSlots.slice(i, i + 3).map(time => ({
      type: 'button',
      action: {
        type: 'postback',
        label: time,
        data: `action=attendance&distributorId=${distributorId}&date=${dateStr}&time=${time}`,
        displayText: time,
      },
      style: 'secondary',
      height: 'sm',
      flex: 1,
    }));
    rows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'sm',
      contents: rowButtons,
    });
  }

  // 「その他 / Other」ボタン
  rows.push({
    type: 'box',
    layout: 'horizontal',
    spacing: 'sm',
    contents: [
      {
        type: 'button',
        action: {
          type: 'postback',
          label: isJa ? 'その他' : 'Other',
          data: `action=attendance&distributorId=${distributorId}&date=${dateStr}&time=other`,
          displayText: isJa ? 'その他' : 'Other',
        },
        style: 'primary',
        color: '#7C3AED',
        height: 'sm',
        flex: 1,
      },
    ],
  });

  const bubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: isJa ? '\u{1F4CB} \u672C\u65E5\u306E\u51FA\u52E4\u78BA\u8A8D' : '\u{1F4CB} Today\'s Attendance Check',
          weight: 'bold',
          size: 'lg',
          color: '#1E293B',
        },
        {
          type: 'separator',
          margin: 'lg',
        },
        {
          type: 'text',
          text: isJa
            ? '\u304A\u306F\u3088\u3046\u3054\u3056\u3044\u307E\u3059\u3002\n\u672C\u65E5\u306E\u914D\u5E03\u30B9\u30B1\u30B8\u30E5\u30FC\u30EB\u304C\u767B\u9332\u3055\u308C\u3066\u3044\u307E\u3059\u3002\n\u51FA\u52E4\u4E88\u5B9A\u6642\u523B\u3092\u6559\u3048\u3066\u304F\u3060\u3055\u3044\u3002'
            : 'Good morning.\nYou have a distribution schedule today.\nPlease let us know your expected arrival time.',
          wrap: true,
          size: 'sm',
          color: '#555555',
          margin: 'lg',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      margin: 'lg',
      contents: rows,
    },
  };

  return {
    type: 'flex',
    altText: isJa ? '\u{1F4CB} \u672C\u65E5\u306E\u51FA\u52E4\u78BA\u8A8D' : '\u{1F4CB} Today\'s Attendance Check',
    contents: bubble,
  };
}
