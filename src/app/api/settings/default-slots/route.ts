import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// 認証チェック
async function checkAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pms_session');
  if (!session) {
    return false;
  }
  const emp = await prisma.employee.findFirst({
    where: { id: parseInt(session.value, 10), isActive: true },
  });
  return !!emp;
}

// GET /api/settings/default-slots
// デフォルトスロット設定一覧を取得（職種情報含む）
export async function GET() {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const slots = await prisma.defaultInterviewSlot.findMany({
      orderBy: { dayOfWeek: 'asc' },
      include: {
        jobCategories: {
          include: {
            jobCategory: { select: { id: true, nameJa: true, nameEn: true } },
          },
        },
      },
    });

    // 全曜日(0-6)のデータを返す（存在しない曜日はデフォルト値で補完）
    const result = [];
    for (let day = 0; day <= 6; day++) {
      const existing = slots.find((s) => s.dayOfWeek === day);
      if (existing) {
        result.push({
          id: existing.id,
          dayOfWeek: existing.dayOfWeek,
          startTime: existing.startTime,
          endTime: existing.endTime,
          intervalMinutes: existing.intervalMinutes,
          isEnabled: existing.isEnabled,
          jobCategoryIds: existing.jobCategories.map((jc) => jc.jobCategoryId),
          jobCategories: existing.jobCategories.map((jc) => jc.jobCategory),
        });
      } else {
        result.push({
          id: null,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          intervalMinutes: 60,
          isEnabled: false,
          jobCategoryIds: [],
          jobCategories: [],
        });
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching default slots:', error);
    return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 });
  }
}

// PUT /api/settings/default-slots
// デフォルトスロット設定を更新（upsert）— 個別曜日
export async function PUT(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { dayOfWeek, startTime, endTime, intervalMinutes, isEnabled, jobCategoryIds } = body;

    if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: '曜日が不正です' }, { status: 400 });
    }

    const slot = await prisma.$transaction(async (tx) => {
      // upsert: 存在すれば更新、なければ作成
      const upserted = await tx.defaultInterviewSlot.upsert({
        where: { dayOfWeek },
        update: {
          startTime: startTime || '09:00',
          endTime: endTime || '17:00',
          intervalMinutes: intervalMinutes || 60,
          isEnabled: isEnabled ?? false,
        },
        create: {
          dayOfWeek,
          startTime: startTime || '09:00',
          endTime: endTime || '17:00',
          intervalMinutes: intervalMinutes || 60,
          isEnabled: isEnabled ?? false,
        },
      });

      // 職種の関連付けを差し替え
      if (Array.isArray(jobCategoryIds)) {
        await tx.defaultSlotJobCategory.deleteMany({
          where: { defaultInterviewSlotId: upserted.id },
        });
        if (jobCategoryIds.length > 0) {
          await tx.defaultSlotJobCategory.createMany({
            data: jobCategoryIds.map((jcId: number) => ({
              defaultInterviewSlotId: upserted.id,
              jobCategoryId: jcId,
            })),
          });
        }
      }

      return upserted;
    });

    return NextResponse.json(slot);
  } catch (error) {
    console.error('Error updating default slot:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}

// POST /api/settings/default-slots
// 一括更新（全曜日）+ オプション: 適用開始日以降のスロット再調整
export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slots, effectiveFrom } = body as {
      slots: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        intervalMinutes: number;
        isEnabled: boolean;
        jobCategoryIds: number[];
      }>;
      effectiveFrom?: string; // YYYY-MM-DD
    };

    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 });
    }

    // ① マスタ設定を一括 upsert
    const results = await prisma.$transaction(async (tx) => {
      const upserted = [];
      for (const s of slots) {
        const slot = await tx.defaultInterviewSlot.upsert({
          where: { dayOfWeek: s.dayOfWeek },
          update: {
            startTime: s.startTime || '09:00',
            endTime: s.endTime || '17:00',
            intervalMinutes: s.intervalMinutes || 60,
            isEnabled: s.isEnabled ?? false,
          },
          create: {
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime || '09:00',
            endTime: s.endTime || '17:00',
            intervalMinutes: s.intervalMinutes || 60,
            isEnabled: s.isEnabled ?? false,
          },
        });

        // 職種の関連付けを差し替え
        if (Array.isArray(s.jobCategoryIds)) {
          await tx.defaultSlotJobCategory.deleteMany({
            where: { defaultInterviewSlotId: slot.id },
          });
          if (s.jobCategoryIds.length > 0) {
            await tx.defaultSlotJobCategory.createMany({
              data: s.jobCategoryIds.map((jcId: number) => ({
                defaultInterviewSlotId: slot.id,
                jobCategoryId: jcId,
              })),
            });
          }
        }

        upserted.push(slot);
      }
      return upserted;
    });

    // ② 適用開始日が指定されている場合、不一致の未予約スロットを削除して再生成
    if (effectiveFrom) {
      const startDate = new Date(effectiveFrom);
      startDate.setHours(0, 0, 0, 0);

      // 保存後のマスタ設定を取得
      const masterSlots = await prisma.defaultInterviewSlot.findMany({
        include: { jobCategories: { select: { jobCategoryId: true } } },
      });

      let totalDeleted = 0;
      let totalCreated = 0;

      // 適用開始日から14日間処理
      for (let i = 0; i < 14; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(currentDate.getDate() + i);
        const dayOfWeek = currentDate.getDay();

        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const master = masterSlots.find((s) => s.dayOfWeek === dayOfWeek && s.isEnabled);

        if (!master) {
          // 無効な曜日: 未予約スロットを全削除
          const deleted = await prisma.interviewSlot.deleteMany({
            where: {
              isBooked: false,
              startTime: { gte: dayStart, lte: dayEnd },
            },
          });
          totalDeleted += deleted.count;
        } else {
          // 有効な曜日: 新マスタに基づく有効スロットセットを計算
          const [startH, startM] = master.startTime.split(':').map(Number);
          const [endH, endM] = master.endTime.split(':').map(Number);
          const interval = master.intervalMinutes;
          const jcIds = master.jobCategories.map((jc) => jc.jobCategoryId);
          const categoryList: (number | null)[] = jcIds.length > 0 ? jcIds : [null];

          type ValidSlot = { startTime: Date; endTime: Date; jobCategoryId: number | null };
          const validSlots: ValidSlot[] = [];
          let currentMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;

          while (currentMinutes + interval <= endMinutes) {
            for (const jcId of categoryList) {
              const slotStart = new Date(currentDate);
              slotStart.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);
              const slotEnd = new Date(currentDate);
              slotEnd.setHours(
                Math.floor((currentMinutes + interval) / 60),
                (currentMinutes + interval) % 60,
                0,
                0
              );
              validSlots.push({ startTime: slotStart, endTime: slotEnd, jobCategoryId: jcId });
            }
            currentMinutes += interval;
          }

          // この日の既存の未予約スロットを取得
          const existingUnbooked = await prisma.interviewSlot.findMany({
            where: {
              isBooked: false,
              startTime: { gte: dayStart, lte: dayEnd },
            },
          });

          // 新マスタに一致しないスロットを削除
          for (const existing of existingUnbooked) {
            const isValid = validSlots.some(
              (vs) =>
                vs.startTime.getTime() === new Date(existing.startTime).getTime() &&
                vs.endTime.getTime() === new Date(existing.endTime).getTime() &&
                vs.jobCategoryId === existing.jobCategoryId
            );
            if (!isValid) {
              await prisma.interviewSlot.delete({ where: { id: existing.id } });
              totalDeleted++;
            }
          }

          // 新マスタに存在するが未作成のスロットを生成
          for (const vs of validSlots) {
            const alreadyExists = existingUnbooked.some(
              (es) =>
                new Date(es.startTime).getTime() === vs.startTime.getTime() &&
                new Date(es.endTime).getTime() === vs.endTime.getTime() &&
                es.jobCategoryId === vs.jobCategoryId
            );
            if (!alreadyExists) {
              await prisma.interviewSlot.create({
                data: {
                  startTime: vs.startTime,
                  endTime: vs.endTime,
                  jobCategoryId: vs.jobCategoryId,
                },
              });
              totalCreated++;
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        slots: results,
        cleanup: { deleted: totalDeleted, created: totalCreated, effectiveFrom },
      });
    }

    return NextResponse.json({ success: true, slots: results });
  } catch (error) {
    console.error('Error bulk updating default slots:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}
