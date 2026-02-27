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
// 一括更新（全曜日）
export async function POST(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slots } = body as {
      slots: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        intervalMinutes: number;
        isEnabled: boolean;
        jobCategoryIds: number[];
      }>;
    };

    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 });
    }

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

    return NextResponse.json({ success: true, slots: results });
  } catch (error) {
    console.error('Error bulk updating default slots:', error);
    return NextResponse.json({ error: '更新に失敗しました' }, { status: 500 });
  }
}
