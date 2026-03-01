import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

const DAYS_AHEAD = 14;

// POST /api/training-slots/generate
// 管理者: デフォルト設定に基づいて研修スロットを手動生成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 有効なデフォルト研修スロット設定を取得
    const defaultSlots = await prisma.defaultTrainingSlot.findMany({
      where: { isEnabled: true },
    });

    if (defaultSlots.length === 0) {
      return NextResponse.json({ message: '有効なデフォルト設定がありません', created: 0, skipped: 0 });
    }

    // JST基準の今日（EC2はUTCで動作するため補正）
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const nowJST = new Date(Date.now() + JST_OFFSET_MS);
    const todayBase = new Date(Date.UTC(
      nowJST.getUTCFullYear(), nowJST.getUTCMonth(), nowJST.getUTCDate()
    ));

    const targetDates: Date[] = [];
    for (let i = 1; i <= DAYS_AHEAD; i++) {
      const d = new Date(todayBase);
      d.setUTCDate(d.getUTCDate() + i);
      targetDates.push(d);
    }

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const date of targetDates) {
      const dayOfWeek = date.getUTCDay(); // JST基準の曜日
      const defaultSlot = defaultSlots.find((s) => s.dayOfWeek === dayOfWeek);
      if (!defaultSlot) continue;

      const [startH, startM] = defaultSlot.startTime.split(':').map(Number);
      const [endH, endM] = defaultSlot.endTime.split(':').map(Number);
      const interval = defaultSlot.intervalMinutes;

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      // JST時刻をUTCに変換（-9h）してスロットを作成
      while (currentMinutes + interval <= endMinutes) {
        const slotStart = new Date(date);
        slotStart.setUTCHours(Math.floor(currentMinutes / 60) - 9, currentMinutes % 60, 0, 0);

        const slotEnd = new Date(date);
        slotEnd.setUTCHours(
          Math.floor((currentMinutes + interval) / 60) - 9,
          (currentMinutes + interval) % 60,
          0,
          0
        );

        // 重複チェック: 同じ startTime + endTime が既に存在するか
        const existing = await prisma.trainingSlot.findFirst({
          where: {
            startTime: slotStart,
            endTime: slotEnd,
          },
        });

        if (existing) {
          totalSkipped++;
        } else {
          await prisma.trainingSlot.create({
            data: {
              startTime: slotStart,
              endTime: slotEnd,
              capacity: defaultSlot.capacity,
            },
          });
          totalCreated++;
        }

        currentMinutes += interval;
      }
    }

    // 監査ログ
    if (totalCreated > 0) {
      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'TrainingSlot',
        description: `研修スロットを手動一括生成: ${totalCreated}件作成（スキップ: ${totalSkipped}件）`,
        ipAddress: ip,
      });
    }

    return NextResponse.json({
      success: true,
      created: totalCreated,
      skipped: totalSkipped,
      message: `${totalCreated}件のスロットを作成しました（${totalSkipped}件は既存のためスキップ）`,
    });
  } catch (error) {
    console.error('Manual Generate Training Slots Error:', error);
    return NextResponse.json({ error: 'スロット生成に失敗しました' }, { status: 500 });
  }
}
