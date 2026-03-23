import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';
import { pushMessage, isLineConfigured } from '@/lib/line';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function formatDateLabel(dateStr: string): string {
  const [, mm, dd] = dateStr.split('-');
  const jst = new Date(`${dateStr}T12:00:00+09:00`);
  return `${mm}/${dd}（${DAY_NAMES[jst.getDay()]}）`;
}

function formatScheduleDate(date: Date): string {
  const jst = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
  const mm = String(jst.getMonth() + 1).padStart(2, '0');
  const dd = String(jst.getDate()).padStart(2, '0');
  return `${mm}/${dd}（${DAY_NAMES[jst.getDay()]}）`;
}

/**
 * POST /api/inspections/share-line
 * 指定日の現場確認予定をLINEグループにFlex Messageで送信
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

    const baseUrl = process.env.NEXTAUTH_URL || `https://${request.headers.get('host')}`;

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
            id: true,
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

    const dateLabel = formatDateLabel(date);

    // 巡回員ごとにグループ化
    const grouped = new Map<string, typeof inspections>();
    for (const insp of inspections) {
      const inspectorKey = insp.inspector
        ? `${insp.inspector.lastNameJa}${insp.inspector.firstNameJa}`
        : '未割当';
      if (!grouped.has(inspectorKey)) grouped.set(inspectorKey, []);
      grouped.get(inspectorKey)!.push(insp);
    }

    // Flex Message body contents
    const bodyContents: any[] = [];

    for (const [inspectorName, items] of grouped) {
      // セパレーター（最初のグループ以外）
      if (bodyContents.length > 0) {
        bodyContents.push({ type: 'separator', margin: 'lg' });
      }

      // 巡回員ヘッダー
      bodyContents.push({
        type: 'box', layout: 'horizontal', margin: 'lg', spacing: 'sm',
        contents: [
          { type: 'text', text: '巡回員', size: 'xxs', color: '#8C8C8C', flex: 0 },
          { type: 'text', text: inspectorName, size: 'sm', weight: 'bold', color: '#333333' },
        ],
      });

      // 各配布員
      for (const insp of items) {
        const name = insp.distributor?.name || '-';
        const staffId = insp.distributor?.staffId || '';
        const area = insp.schedule?.area;
        const areaName = area
          ? `${area.prefecture.name}${area.city.name}${area.chome_name || area.town_name}`
          : '-';
        const categoryLabel = insp.category === 'CHECK' ? 'チェック' : '指導';
        const categoryColor = insp.category === 'CHECK' ? '#2563EB' : '#7C3AED';
        const schedDate = insp.schedule?.date ? formatScheduleDate(new Date(insp.schedule.date)) : '-';
        const scheduleId = insp.schedule?.id;
        const mapUrl = scheduleId ? `${baseUrl}/map/${scheduleId}` : null;

        const cardContents: any[] = [
          {
            type: 'box', layout: 'baseline', spacing: 'sm',
            contents: [
              { type: 'text', text: name, size: 'xs', weight: 'bold', color: '#333333', flex: 1 },
              { type: 'text', text: categoryLabel, size: 'xxs', color: categoryColor, weight: 'bold', flex: 0 },
            ],
          },
          {
            type: 'text', text: `${staffId ? staffId + ' | ' : ''}${schedDate} ${areaName}`,
            size: 'xxs', color: '#888888', margin: 'xs', wrap: true,
          },
        ];

        if (mapUrl) {
          cardContents.push({
            type: 'box', layout: 'horizontal', margin: 'sm', spacing: 'sm',
            contents: [
              {
                type: 'box', layout: 'vertical', flex: 0,
                paddingStart: 'md', paddingEnd: 'md', paddingTop: '4px', paddingBottom: '4px',
                backgroundColor: '#EEF2FF', cornerRadius: 'sm',
                action: { type: 'uri', label: 'GPS', uri: mapUrl },
                contents: [
                  { type: 'text', text: 'GPS軌跡', size: 'xxs', color: '#4F46E5', weight: 'bold', align: 'center' },
                ],
              },
            ],
          });
        }

        bodyContents.push({
          type: 'box', layout: 'vertical', margin: 'sm',
          paddingStart: 'lg', paddingEnd: 'md', paddingTop: 'sm', paddingBottom: 'sm',
          backgroundColor: '#F8FAFC',
          cornerRadius: 'md',
          contents: cardContents,
        });
      }
    }

    const flexMessage = {
      type: 'flex',
      altText: `現場確認予定 ${dateLabel}（${inspections.length}件）`,
      contents: {
        type: 'bubble', size: 'mega',
        styles: { header: { backgroundColor: '#1E40AF' } },
        header: {
          type: 'box', layout: 'vertical',
          paddingTop: 'lg', paddingBottom: 'lg',
          paddingStart: 'xl', paddingEnd: 'xl',
          contents: [
            { type: 'text', text: '現場確認予定', size: 'lg', weight: 'bold', color: '#FFFFFF' },
            {
              type: 'box', layout: 'horizontal', margin: 'sm', spacing: 'md',
              contents: [
                { type: 'text', text: dateLabel, size: 'sm', color: '#BFDBFE', flex: 0 },
                { type: 'text', text: `${inspections.length}件`, size: 'sm', color: '#BFDBFE', flex: 0 },
              ],
            },
          ],
        },
        body: {
          type: 'box', layout: 'vertical',
          paddingTop: 'md', paddingBottom: 'lg',
          contents: bodyContents,
        },
      },
    };

    await pushMessage(groupSetting.value, [flexMessage]);

    return NextResponse.json({ success: true, count: inspections.length });
  } catch (err) {
    console.error('POST /api/inspections/share-line error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
