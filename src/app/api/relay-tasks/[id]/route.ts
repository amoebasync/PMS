import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { pushMessage, isLineConfigured } from '@/lib/line';

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

/** LINE グループに中継/回収完了通知を送信 */
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

  // Google Maps リンク
  const hasLocation = task.latitude && task.longitude;
  const mapsUrl = hasLocation
    ? `https://www.google.com/maps?q=${task.latitude},${task.longitude}`
    : null;

  // Flex Message 本体
  const bodyContents: any[] = [
    {
      type: 'text',
      text: `${emoji} ${typeLabel}完了`,
      weight: 'bold',
      size: 'md',
      color: isRelay ? '#3756E8' : '#10B981',
    },
    { type: 'separator', margin: 'md' },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      spacing: 'sm',
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

  // Google Maps ボタン
  const footer = mapsUrl ? {
    type: 'box',
    layout: 'vertical',
    contents: [{
      type: 'button',
      action: { type: 'uri', label: '\u{1F4CD} Google Maps で確認', uri: mapsUrl },
      style: 'link',
      height: 'sm',
    }],
  } : undefined;

  const flexMessage: any = {
    type: 'flex',
    altText: `${emoji} ${typeLabel}完了: ${branch} ${distributor}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: { type: 'box', layout: 'vertical', contents: bodyContents },
      ...(footer ? { footer } : {}),
    },
  };

  // メッセージ配列: Flex + エビデンス写真（最大4枚、合計5メッセージまで）
  const messages: any[] = [flexMessage];

  const evidenceUrls: string[] = Array.isArray(task.evidenceUrls) ? task.evidenceUrls : [];
  const baseUrl = 'https://pms.tiramis.co.jp';
  for (const url of evidenceUrls.slice(0, 4)) {
    const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
    messages.push({
      type: 'image',
      originalContentUrl: fullUrl,
      previewImageUrl: fullUrl,
    });
  }

  await pushMessage(groupId, messages);
  console.log(`[RelayTask] LINE notification sent: ${typeLabel} ${branch} ${distributor} (${evidenceUrls.length} photos)`);
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
