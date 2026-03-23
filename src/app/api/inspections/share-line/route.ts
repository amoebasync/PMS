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

    // 日付フォーマット
    const d = new Date(`${date}T00:00:00+09:00`);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dow = DAY_NAMES[d.getDay()];
    const dateLabel = `${mm}/${dd}（${dow}）`;

    // メッセージ組み立て
    const lines: string[] = [`【現場確認予定 ${dateLabel}】`];

    for (const insp of inspections) {
      const name = insp.distributor?.name || '-';
      const staffId = insp.distributor?.staffId || '';
      const area = insp.schedule?.area;
      const areaName = area
        ? `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`
        : '-';
      const categoryLabel = insp.category === 'CHECK' ? 'チェック' : '指導';
      const inspector = insp.inspector
        ? `${insp.inspector.lastNameJa}${insp.inspector.firstNameJa}`
        : '-';

      // 配布スケジュールの日付
      let schedDateLabel = '';
      if (insp.schedule?.date) {
        const sd = new Date(insp.schedule.date);
        const smm = String(sd.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric' })).padStart(2, '0');
        const sdd = String(sd.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', day: 'numeric' })).padStart(2, '0');
        const sdow = sd.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', weekday: 'short' });
        schedDateLabel = `${smm}/${sdd}（${sdow}）`;
      }

      let line = `・${name}`;
      if (staffId) line += `（${staffId}）`;
      if (schedDateLabel) line += `${schedDateLabel}`;
      line += ` ${areaName}`;
      line += ` ／${categoryLabel}`;
      line += ` ／巡回員: ${inspector}`;
      lines.push(line);
    }

    const messageText = lines.join('\n');

    await pushMessage(groupSetting.value, [{ type: 'text', text: messageText }]);

    return NextResponse.json({ success: true, count: inspections.length });
  } catch (err) {
    console.error('POST /api/inspections/share-line error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
