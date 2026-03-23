import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { pushMessage, isLineConfigured } from '@/lib/line';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * POST /api/inspections/share-line
 * 指定日の現場確認予定をLINEグループに送信
 * body: { date: "YYYY-MM-DD" }
 */
export async function POST(request: NextRequest) {
  const { error } = await requireAdminSession();
  if (error) return error;

  if (!isLineConfigured()) {
    return NextResponse.json({ error: 'LINE未設定' }, { status: 400 });
  }

  try {
    const { date } = await request.json();
    if (!date) {
      return NextResponse.json({ error: '日付は必須です' }, { status: 400 });
    }

    // 送信先グループ取得
    const groupSetting = await prisma.systemSetting.findUnique({
      where: { key: 'lineInspectionNotificationGroupId' },
    });
    if (!groupSetting?.value) {
      return NextResponse.json({ error: 'LINE通知先グループが設定されていません' }, { status: 400 });
    }

    // 指定日の現場確認を取得
    const inspections = await prisma.fieldInspection.findMany({
      where: {
        inspectedAt: {
          gte: new Date(`${date}T00:00:00`),
          lt: new Date(`${date}T23:59:59.999`),
        },
        status: { not: 'CANCELLED' },
      },
      include: {
        distributor: { select: { name: true, staffId: true } },
        inspector: { select: { lastNameJa: true, firstNameJa: true } },
        schedule: {
          select: {
            date: true,
            area: {
              include: {
                prefecture: { select: { name: true } },
                city: { select: { name: true } },
              },
            },
          },
        },
      },
      orderBy: { inspectedAt: 'asc' },
    });

    if (inspections.length === 0) {
      return NextResponse.json({ error: '該当日の現場確認予定がありません' }, { status: 400 });
    }

    // 日付フォーマット（UTCサーバー対応: YYYY-MM-DD文字列から直接パース）
    const [, mmStr, ddStr] = date.split('-');
    const jstDate = new Date(`${date}T12:00:00+09:00`);
    const dow = DAY_NAMES[jstDate.getDay()];
    const dateLabel = `${mmStr}/${ddStr}（${dow}）`;

    // 巡回員ごとにグループ化
    const grouped = new Map<string, typeof inspections>();
    for (const insp of inspections) {
      const inspectorKey = insp.inspector
        ? `${insp.inspector.lastNameJa}${insp.inspector.firstNameJa}`
        : '未割当';
      if (!grouped.has(inspectorKey)) grouped.set(inspectorKey, []);
      grouped.get(inspectorKey)!.push(insp);
    }

    // メッセージ組み立て
    const lines: string[] = [`📋 現場確認予定 ${dateLabel}`, `合計 ${inspections.length}件`, ''];

    for (const [inspectorName, items] of grouped) {
      lines.push(`▶ 巡回員: ${inspectorName}`);
      for (const insp of items) {
        const name = insp.distributor?.name || '-';
        const staffId = insp.distributor?.staffId || '';
        const area = insp.schedule?.area;
        const areaName = area
          ? `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`
          : '-';
        const categoryLabel = insp.category === 'CHECK' ? 'チェック' : '指導';

        // 配布スケジュールの日付（UTCサーバー対応）
        let schedDateLabel = '';
        if (insp.schedule?.date) {
          const sd = new Date(insp.schedule.date);
          const sJst = new Date(sd.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
          const smm = String(sJst.getMonth() + 1).padStart(2, '0');
          const sdd = String(sJst.getDate()).padStart(2, '0');
          const sdow = DAY_NAMES[sJst.getDay()];
          schedDateLabel = `${smm}/${sdd}（${sdow}）`;
        }

        let line = `  ${name}`;
        if (staffId) line += `（${staffId}）`;
        line += `\n    ${categoryLabel}｜配布日 ${schedDateLabel}`;
        line += `\n    📍 ${areaName}`;
        lines.push(line);
      }
      lines.push('');
    }

    const messageText = lines.join('\n').trimEnd();

    await pushMessage(groupSetting.value, [{ type: 'text', text: messageText }]);

    return NextResponse.json({ success: true, count: inspections.length });
  } catch (err) {
    console.error('POST /api/inspections/share-line error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
