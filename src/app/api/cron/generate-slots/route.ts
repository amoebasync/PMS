import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';
import { isHoliday } from '@/lib/holidays';

const CRON_SECRET = process.env.CRON_SECRET;
const DAYS_AHEAD = 14; // 何日先まで生成するか

// GET /api/cron/generate-slots
// CRON ジョブ: デフォルト設定に基づいて面接スロットを自動生成
export async function GET(request: Request) {
  // Bearer トークン認証
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    // アクティブなマスタとそのデフォルトスロット設定・職種を取得
    const masters = await prisma.interviewSlotMaster.findMany({
      where: { isActive: true },
      include: {
        defaultInterviewSlots: { where: { isEnabled: true } },
        jobCategories: { select: { id: true } },
      },
    });

    if (masters.length === 0) {
      return NextResponse.json({ message: '有効なマスタ設定がありません', created: 0, skipped: 0 });
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

    // JST（+09:00）で指定分数を Date に変換（サーバータイムゾーン非依存）
    const toJSTTime = (date: Date, totalMinutes: number): Date => {
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      return new Date(`${yyyy}-${mm}-${dd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`);
    };

    // 各マスタに対して処理
    for (const master of masters) {
      const jobCategoryIds = master.jobCategories.map((jc) => jc.id);
      const categoryList: (number | null)[] = jobCategoryIds.length > 0 ? jobCategoryIds : [null];

      // 各日付に対して処理
      for (const date of targetDates) {
        const dayOfWeek = date.getUTCDay(); // 0=日, 1=月, ..., 6=土（UTC基準）
        const defaultSlot = master.defaultInterviewSlots.find((s) => s.dayOfWeek === dayOfWeek);
        if (!defaultSlot) continue;

        // 祝日スキップチェック（allowHolidays=false の場合）
        if (!master.allowHolidays) {
          const isHolidayDate = await isHoliday(date);
          if (isHolidayDate) continue;
        }

        // 時間枠を intervalMinutes 単位で分割
        const [startH, startM] = defaultSlot.startTime.split(':').map(Number);
        const [endH, endM] = defaultSlot.endTime.split(':').map(Number);
        const interval = defaultSlot.intervalMinutes;

        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (currentMinutes + interval <= endMinutes) {
          const slotStart = toJSTTime(date, currentMinutes);
          const slotEnd = toJSTTime(date, currentMinutes + interval);

          // 各職種ごとにスロットを作成
          for (const jcId of categoryList) {
            // 重複チェック: 同じ startTime + endTime + jobCategoryId + masterId が既に存在するか
            const existing = await prisma.interviewSlot.findFirst({
              where: {
                startTime: slotStart,
                endTime: slotEnd,
                jobCategoryId: jcId,
                interviewSlotMasterId: master.id,
              },
            });

            if (existing) {
              totalSkipped++;
              continue;
            }

            // Google Meet URL は応募者が予約した時点（/api/apply）で生成するため、ここでは作成しない
            await prisma.interviewSlot.create({
              data: {
                startTime: slotStart,
                endTime: slotEnd,
                jobCategoryId: jcId,
                interviewerId: defaultSlot.interviewerId,
                interviewSlotMasterId: master.id,
              },
            });
            totalCreated++;
          }

          currentMinutes += interval;
        }
      }
    }

    // 監査ログ
    if (totalCreated > 0) {
      await writeAuditLog({
        actorType: 'SYSTEM',
        action: 'CREATE',
        targetModel: 'InterviewSlot',
        description: `CRON自動生成: ${totalCreated}件の面接スロットを作成（スキップ: ${totalSkipped}件）`,
      });
    }

    return NextResponse.json({
      success: true,
      created: totalCreated,
      skipped: totalSkipped,
      message: `${totalCreated}件のスロットを作成しました（${totalSkipped}件は既存のためスキップ）`,
    });
  } catch (error) {
    console.error('CRON Generate Slots Error:', error);
    return NextResponse.json({ error: 'スロット自動生成に失敗しました' }, { status: 500 });
  }
}
