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
  const [notifSetting, inspectionSetting] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: 'lineRelayNotificationGroupId' } }),
    prisma.systemSetting.findUnique({ where: { key: 'lineInspectionNotificationGroupId' } }),
  ]);

  return NextResponse.json({
    groups,
    relayNotificationGroupId: notifSetting?.value || null,
    inspectionNotificationGroupId: inspectionSetting?.value || null,
  });
}

/**
 * PUT /api/line/groups — 通知先グループを設定
 * body: { groupId: string, type?: 'relay' | 'inspection' }
 */
export async function PUT(request: Request) {
  const { groupId, type } = await request.json();

  const key = type === 'inspection'
    ? 'lineInspectionNotificationGroupId'
    : 'lineRelayNotificationGroupId';

  await prisma.systemSetting.upsert({
    where: { key },
    create: { key, value: groupId || '' },
    update: { value: groupId || '' },
  });

  return NextResponse.json({ success: true });
}
