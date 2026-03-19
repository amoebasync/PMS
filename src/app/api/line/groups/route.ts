import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/line/groups — Webhookで検出済みのLINEグループ一覧
 */
export async function GET() {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: 'lineGroup_' } },
  });

  const groups = settings.map(s => {
    try { return JSON.parse(s.value); } catch { return null; }
  }).filter(Boolean);

  // 通知先設定も返す
  const notifSetting = await prisma.systemSetting.findUnique({
    where: { key: 'lineRelayNotificationGroupId' },
  });

  return NextResponse.json({
    groups,
    relayNotificationGroupId: notifSetting?.value || null,
  });
}

/**
 * PUT /api/line/groups — 中継/回収通知先グループを設定
 * body: { groupId: string }
 */
export async function PUT(request: Request) {
  const { groupId } = await request.json();

  await prisma.systemSetting.upsert({
    where: { key: 'lineRelayNotificationGroupId' },
    create: { key: 'lineRelayNotificationGroupId', value: groupId || '' },
    update: { value: groupId || '' },
  });

  return NextResponse.json({ success: true });
}
