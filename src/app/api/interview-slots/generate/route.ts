import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';
import { createGoogleMeetEvent, isGoogleMeetConfigured } from '@/lib/google-meet';

const DAYS_AHEAD = 14;

// POST /api/interview-slots/generate
// 管理者: デフォルト設定に基づいてスロットを手動生成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 有効なデフォルトスロット設定を取得
    const defaultSlots = await prisma.defaultInterviewSlot.findMany({
      where: { isEnabled: true },
      include: {
        jobCategories: {
          select: { jobCategoryId: true },
        },
      },
    });

    if (defaultSlots.length === 0) {
      return NextResponse.json({ message: '有効なデフォルト設定がありません', created: 0, skipped: 0 });
    }

    // 今日から DAYS_AHEAD 日先までの日付を生成
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDates: Date[] = [];
    for (let i = 1; i <= DAYS_AHEAD; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      targetDates.push(d);
    }

    let totalCreated = 0;
    let totalSkipped = 0;
    const meetConfigured = isGoogleMeetConfigured();

    for (const date of targetDates) {
      const dayOfWeek = date.getDay();
      const defaultSlot = defaultSlots.find((s) => s.dayOfWeek === dayOfWeek);
      if (!defaultSlot) continue;

      const [startH, startM] = defaultSlot.startTime.split(':').map(Number);
      const [endH, endM] = defaultSlot.endTime.split(':').map(Number);
      const interval = defaultSlot.intervalMinutes;

      let currentMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const jobCategoryIds = defaultSlot.jobCategories.map((jc) => jc.jobCategoryId);
      const categoryList = jobCategoryIds.length > 0 ? jobCategoryIds : [null];

      while (currentMinutes + interval <= endMinutes) {
        const slotStart = new Date(date);
        slotStart.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);

        const slotEnd = new Date(date);
        slotEnd.setHours(
          Math.floor((currentMinutes + interval) / 60),
          (currentMinutes + interval) % 60,
          0,
          0
        );

        for (const jcId of categoryList) {
          const existing = await prisma.interviewSlot.findFirst({
            where: {
              startTime: slotStart,
              endTime: slotEnd,
              jobCategoryId: jcId,
            },
          });

          if (existing) {
            totalSkipped++;
            continue;
          }

          let meetUrl: string | null = null;
          if (meetConfigured) {
            const dateStr = slotStart.toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            const timeStr = `${slotStart.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })} - ${slotEnd.toLocaleTimeString('ja-JP', {
              hour: '2-digit',
              minute: '2-digit',
            })}`;
            meetUrl = await createGoogleMeetEvent(
              `【ティラミス】面接枠 ${dateStr} ${timeStr}`,
              `自動生成された面接スロット`,
              slotStart,
              slotEnd
            );
          }

          await prisma.interviewSlot.create({
            data: {
              startTime: slotStart,
              endTime: slotEnd,
              jobCategoryId: jcId,
              meetUrl,
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
        targetModel: 'InterviewSlot',
        description: `面接スロットを手動一括生成: ${totalCreated}件作成（スキップ: ${totalSkipped}件）`,
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
    console.error('Manual Generate Slots Error:', error);
    return NextResponse.json({ error: 'スロット生成に失敗しました' }, { status: 500 });
  }
}
