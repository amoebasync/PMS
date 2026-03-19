import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { pushMessage, isLineConfigured } from '@/lib/line';
import { getPresignedUrl } from '@/lib/s3';

async function authorize() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  return prisma.employee.findUnique({ where: { id: parseInt(sessionId) } });
}

// PUT: 中継/回収タスク更新
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const existing = await prisma.relayTask.findUnique({ where: { id: taskId } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: any = {};

    if (body.status !== undefined) data.status = body.status;
    if (body.driverId !== undefined) data.driverId = body.driverId || null;
    if (body.driverName !== undefined) data.driverName = body.driverName || null;
    if (body.locationName !== undefined) data.locationName = body.locationName || null;
    if (body.latitude !== undefined) data.latitude = body.latitude;
    if (body.longitude !== undefined) data.longitude = body.longitude;
    if (body.timeSlotStart !== undefined) data.timeSlotStart = body.timeSlotStart || null;
    if (body.timeSlotEnd !== undefined) data.timeSlotEnd = body.timeSlotEnd || null;
    if (body.note !== undefined) data.note = body.note || null;
    if (body.type !== undefined) data.type = body.type;
    if (body.date !== undefined) data.date = body.date ? new Date(body.date) : null;
    if (body.bagCount !== undefined) data.bagCount = parseInt(body.bagCount) || 0;
    if (body.trolleyCount !== undefined) data.trolleyCount = parseInt(body.trolleyCount) || 0;
    if (body.otherCount !== undefined) data.otherCount = parseInt(body.otherCount) || 0;

    const task = await prisma.relayTask.update({
      where: { id: taskId },
      data,
      include: {
        driver: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        schedule: {
          select: {
            id: true, jobNumber: true, date: true, status: true,
            distributor: { select: { id: true, staffId: true, name: true } },
            branch: { select: { id: true, nameJa: true } },
            area: { select: { id: true, chome_name: true, prefecture: { select: { name: true } }, city: { select: { name: true } } } },
          },
        },
      },
    });

    // ── LINE通知: 中継/回収が完了した場合 ──
    if (body.status === 'COMPLETED' && existing.status !== 'COMPLETED') {
      sendRelayCompletionNotification(task).catch(e =>
        console.error('[RelayTask] LINE notification error:', e)
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('RelayTask PUT error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

/** エビデンス写真の署名付きURLを取得 */
async function getEvidenceHeroUrl(task: any): Promise<string | null> {
  const evidenceUrls: string[] = Array.isArray(task.evidenceUrls) ? task.evidenceUrls : [];
  if (evidenceUrls.length === 0) return null;
  try {
    const keyMatch = evidenceUrls[0].match(/[?&]key=([^&]+)/);
    if (keyMatch) return await getPresignedUrl(decodeURIComponent(keyMatch[1]), 86400);
  } catch (e) {
    console.error('[RelayTask] Failed to get presigned URL:', e);
  }
  return null;
}

/** LINE グループに中継/回収完了通知を送信 + 配布員にも通知（中継のみ） */
async function sendRelayCompletionNotification(task: any) {
  if (!isLineConfigured()) return;

  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'lineRelayNotificationGroupId' },
  });
  if (!setting?.value) return;

  const groupId = setting.value;
  const isRelay = task.type === 'RELAY';
  const typeLabel = isRelay ? '中継' : '回収';
  const emoji = isRelay ? '\u{1F4E6}' : '\u{1F69A}';
  const accentColor = isRelay ? '#3756E8' : '#10B981';
  const branch = task.schedule?.branch?.nameJa || '—';
  const distributor = task.schedule?.distributor?.name || '—';
  const area = task.schedule?.area
    ? `${task.schedule.area.prefecture?.name || ''}${task.schedule.area.city?.name || ''}${task.schedule.area.chome_name || ''}`
    : '—';
  const driver = task.driver
    ? `${task.driver.lastNameJa || ''}${task.driver.firstNameJa || ''}`
    : task.driverName || '—';
  const location = task.locationName || '—';
  const now = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });

  const heroImageUrl = await getEvidenceHeroUrl(task);
  const hasLocation = task.latitude && task.longitude;
  const mapsUrl = hasLocation ? `https://www.google.com/maps?q=${task.latitude},${task.longitude}` : null;

  // ── 中継の場合: 配布員にLINE通知 ──
  let distributorNotified = false;
  let distributorLineStatus = '';

  if (isRelay && task.schedule?.distributor?.id) {
    const lineUser = await prisma.lineUser.findUnique({
      where: { distributorId: task.schedule.distributor.id },
    });

    if (lineUser?.lineUserId && lineUser.isFollowing) {
      // 配布員の言語設定を取得
      const dist = await prisma.flyerDistributor.findUnique({
        where: { id: task.schedule.distributor.id },
        select: { language: true },
      });
      const lang = dist?.language || 'ja';

      try {
        const distMessage = buildDistributorDeliveryMessage(lang, location, area, now, mapsUrl, heroImageUrl);
        await pushMessage(lineUser.lineUserId, [distMessage]);
        distributorNotified = true;
        distributorLineStatus = '\u2705 配布員へLINE伝達済み';
        console.log(`[RelayTask] Distributor notified via LINE: ${distributor} (${lang})`);
      } catch (e) {
        console.error('[RelayTask] Failed to notify distributor:', e);
        distributorLineStatus = '\u26A0\uFE0F 配布員へのLINE送信に失敗しました';
      }
    } else {
      distributorLineStatus = '\u26A0\uFE0F LINE未連携のため配布員に通知できませんでした';
    }
  }

  // ── グループ通知 ──
  const bodyContents: any[] = [
    { type: 'text', text: `${emoji} ${typeLabel}完了`, weight: 'bold', size: 'md', color: accentColor },
    { type: 'separator', margin: 'md' },
    {
      type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm',
      contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '支店', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: branch, size: 'xs', color: '#333333', flex: 5, weight: 'bold' },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '配布員', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: distributor, size: 'xs', color: '#333333', flex: 5 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: 'エリア', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: area, size: 'xs', color: '#333333', flex: 5 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '場所', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: location, size: 'xs', color: '#333333', flex: 5 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '担当', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: driver, size: 'xs', color: '#333333', flex: 5 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: '完了', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: now, size: 'xs', color: '#333333', flex: 5, weight: 'bold' },
        ]},
      ],
    },
  ];

  // 配布員LINE通知ステータスをグループ通知に追記（中継のみ）
  if (isRelay && distributorLineStatus) {
    bodyContents.push({ type: 'separator', margin: 'md' });
    bodyContents.push({
      type: 'text',
      text: distributorLineStatus,
      size: 'xs',
      color: distributorNotified ? '#10B981' : '#E53E3E',
      margin: 'md',
      weight: 'bold',
    });
  }

  const bubble: any = {
    type: 'bubble',
    size: 'kilo',
    body: { type: 'box', layout: 'vertical', contents: bodyContents },
  };

  if (heroImageUrl) {
    bubble.hero = {
      type: 'image', url: heroImageUrl, size: 'full',
      aspectRatio: '20:13', aspectMode: 'cover',
      action: { type: 'uri', label: '写真を拡大', uri: heroImageUrl },
    };
  }

  if (mapsUrl) {
    bubble.footer = {
      type: 'box', layout: 'vertical',
      contents: [{ type: 'button', action: { type: 'uri', label: '\u{1F4CD} Google Maps で確認', uri: mapsUrl }, style: 'link', height: 'sm' }],
    };
  }

  await pushMessage(groupId, [{
    type: 'flex',
    altText: `${emoji} ${typeLabel}完了: ${branch} ${distributor}`,
    contents: bubble,
  }]);
  console.log(`[RelayTask] Group notification sent: ${typeLabel} ${branch} ${distributor}`);
}

/** 配布員向け中継完了通知メッセージを構築（JA/EN対応） */
function buildDistributorDeliveryMessage(lang: string, location: string, area: string, time: string, mapsUrl: string | null, heroImageUrl: string | null) {
  const isJa = lang === 'ja';

  const bodyContents: any[] = [
    { type: 'text', text: isJa ? '\u{1F4E6} 中継が完了しました' : '\u{1F4E6} Delivery Completed', weight: 'bold', size: 'md', color: '#3756E8' },
    { type: 'separator', margin: 'md' },
    {
      type: 'text', wrap: true, size: 'xs', color: '#555555', margin: 'md',
      text: isJa
        ? 'チラシの中継が以下の場所に届いています。'
        : 'Your flyers have been delivered to the following location.',
    },
    {
      type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm',
      contents: [
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: isJa ? '場所' : 'Location', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: location, size: 'xs', color: '#333333', flex: 5, weight: 'bold' },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: isJa ? 'エリア' : 'Area', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: area, size: 'xs', color: '#333333', flex: 5 },
        ]},
        { type: 'box', layout: 'horizontal', contents: [
          { type: 'text', text: isJa ? '時刻' : 'Time', size: 'xs', color: '#aaaaaa', flex: 2 },
          { type: 'text', text: time, size: 'xs', color: '#333333', flex: 5, weight: 'bold' },
        ]},
      ],
    },
    { type: 'separator', margin: 'lg' },
    {
      type: 'box', layout: 'vertical', margin: 'lg', spacing: 'md',
      contents: [
        { type: 'text', text: isJa ? '\u26A0\uFE0F 注意事項' : '\u26A0\uFE0F Reminders', weight: 'bold', size: 'xs', color: '#E53E3E' },
        { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
          { type: 'text', text: '\u2022', size: 'xs', color: '#E53E3E', flex: 0 },
          { type: 'text', wrap: true, size: 'xs', color: '#555555',
            text: isJa
              ? '配布前に地図とチラシの種類を必ず確認して、漏れが無い様にしてください。'
              : 'Before distributing, always check the map and flyer types to ensure nothing is missed.' },
        ]},
        { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
          { type: 'text', text: '\u2022', size: 'xs', color: '#E53E3E', flex: 0 },
          { type: 'text', wrap: true, size: 'xs', color: '#555555',
            text: isJa
              ? '雨が予想される日には必ずプラスチックバッグでチラシが濡れない様にしてください。'
              : 'On rainy days, always use plastic bags to keep the flyers dry.' },
        ]},
        { type: 'box', layout: 'horizontal', spacing: 'sm', contents: [
          { type: 'text', text: '\u2022', size: 'xs', color: '#E53E3E', flex: 0 },
          { type: 'text', wrap: true, size: 'xs', color: '#555555',
            text: isJa
              ? '配布開始前にチラシの写真を撮ってLINEで送ってください。'
              : 'Before starting distribution, take a photo of the flyers and send it via LINE.' },
        ]},
      ],
    },
  ];

  const bubble: any = {
    type: 'bubble',
    size: 'mega',
    body: { type: 'box', layout: 'vertical', contents: bodyContents },
  };

  if (heroImageUrl) {
    bubble.hero = {
      type: 'image', url: heroImageUrl, size: 'full',
      aspectRatio: '20:13', aspectMode: 'cover',
      action: { type: 'uri', label: isJa ? '写真を拡大' : 'View photo', uri: heroImageUrl },
    };
  }

  if (mapsUrl) {
    bubble.footer = {
      type: 'box', layout: 'vertical',
      contents: [{ type: 'button', action: { type: 'uri', label: isJa ? '\u{1F4CD} 場所を確認' : '\u{1F4CD} View Location', uri: mapsUrl }, style: 'primary', color: '#3756E8', height: 'sm' }],
    };
  }

  return { type: 'flex', altText: isJa ? '\u{1F4E6} 中継完了のお知らせ' : '\u{1F4E6} Delivery Completed', contents: bubble };
}

// DELETE: 中継/回収タスク削除
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await authorize()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const taskId = parseInt(id);
    if (isNaN(taskId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    await prisma.relayTask.delete({ where: { id: taskId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('RelayTask DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
