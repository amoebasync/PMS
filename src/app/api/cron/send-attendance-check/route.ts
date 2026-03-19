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
      name: string;
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
        name: s.distributor.name,
      });
    }

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [, info] of distributorMap) {
      try {
        const message = buildAttendanceFlexMessage(
          info.language,
          info.name,
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

/** 出勤確認 Flex Message を構築（JA/EN対応、名前入り） */
function buildAttendanceFlexMessage(
  lang: string,
  name: string,
  distributorId: number,
  dateStr: string
) {
  const isJa = lang === 'ja';
  const firstName = name.split(/\s+/)[0];

  const timeSlots = ['7:00','7:30','8:00','8:30','9:00','9:30','10:00','10:30','11:00'];

  const rows: any[] = [];
  for (let i = 0; i < timeSlots.length; i += 3) {
    rows.push({
      type: 'box', layout: 'horizontal', spacing: 'sm',
      margin: i === 0 ? 'lg' : 'sm',
      contents: timeSlots.slice(i, i + 3).map(time => ({
        type: 'button',
        action: {
          type: 'postback', label: time,
          data: `action=attendance&distributorId=${distributorId}&date=${dateStr}&time=${time}`,
          displayText: isJa ? `${time} に出勤します` : `I will arrive at ${time}`,
        },
        style: 'secondary', height: 'sm', color: '#EEF2FF',
      })),
    });
  }

  rows.push({
    type: 'box', layout: 'horizontal', margin: 'lg',
    contents: [{
      type: 'button',
      action: {
        type: 'postback',
        label: isJa ? '\u23F0 その他の時間' : '\u23F0 Other time',
        data: `action=attendance&distributorId=${distributorId}&date=${dateStr}&time=other`,
        displayText: isJa ? 'その他の時間に出勤します' : 'I will arrive at a different time',
      },
      style: 'primary', color: '#6366F1', height: 'sm',
    }],
  });

  return {
    type: 'flex',
    altText: isJa ? `\u2600\uFE0F ${firstName}さん、本日の出勤確認` : `\u2600\uFE0F ${firstName}, Today's Attendance`,
    contents: {
      type: 'bubble', size: 'mega',
      styles: { header: { backgroundColor: '#3756E8' } },
      header: {
        type: 'box', layout: 'vertical', paddingTop: 'xl', paddingBottom: 'xl',
        contents: [
          { type: 'text', text: '\u2600\uFE0F', size: 'xxl', align: 'center' },
          { type: 'text', text: isJa ? `おはようございます、${firstName}さん！` : `Good morning, ${firstName}!`, color: '#FFFFFF', weight: 'bold', size: 'md', align: 'center', margin: 'sm' },
          { type: 'text', text: isJa ? '本日の出勤予定を教えてください' : 'When do you plan to arrive today?', color: '#C7D2FE', size: 'xs', align: 'center', margin: 'sm' },
        ],
      },
      body: {
        type: 'box', layout: 'vertical',
        contents: [
          { type: 'text', text: isJa ? '出勤予定時刻を選択' : 'Select your arrival time', weight: 'bold', size: 'sm', color: '#333333' },
          { type: 'text', text: isJa ? 'タップするだけで出勤予定が登録されます。' : 'Just tap to register your expected arrival.', size: 'xs', color: '#999999', margin: 'sm', wrap: true },
          ...rows,
        ],
      },
      footer: {
        type: 'box', layout: 'vertical', paddingTop: 'md', paddingBottom: 'md',
        contents: [
          { type: 'text', text: isJa ? '\u{1F4AA} 本日もよろしくお願いします！' : '\u{1F4AA} Have a great day!', size: 'xs', color: '#999999', align: 'center' },
        ],
      },
    },
  };
}
