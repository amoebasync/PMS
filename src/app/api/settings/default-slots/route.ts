import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { isHoliday } from '@/lib/holidays';

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

// GET /api/settings/default-slots?masterId=X
// デフォルトスロット設定一覧を取得（マスタIDでフィルタ可能）
export async function GET(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const masterIdParam = searchParams.get('masterId');

    const where: any = {};
    if (masterIdParam) {
      where.interviewSlotMasterId = Number(masterIdParam);
    }

    const slots = await prisma.defaultInterviewSlot.findMany({
      where,
      orderBy: { dayOfWeek: 'asc' },
      include: {
        interviewer: {
          select: { id: true, lastNameJa: true, firstNameJa: true, email: true },
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
          interviewerId: existing.interviewerId,
          interviewer: existing.interviewer,
          interviewSlotMasterId: existing.interviewSlotMasterId,
        });
      } else {
        result.push({
          id: null,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          intervalMinutes: 60,
          isEnabled: false,
          interviewerId: null,
          interviewer: null,
          interviewSlotMasterId: masterIdParam ? Number(masterIdParam) : null,
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
// デフォルトスロット設定を更新（upsert）— 個別曜日 + マスタID
export async function PUT(request: Request) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { dayOfWeek, startTime, endTime, intervalMinutes, isEnabled, interviewerId, masterId } = body;

    if (dayOfWeek === undefined || dayOfWeek < 0 || dayOfWeek > 6) {
      return NextResponse.json({ error: '曜日が不正です' }, { status: 400 });
    }

    if (!masterId) {
      return NextResponse.json({ error: 'マスタIDが必要です' }, { status: 400 });
    }

    const slot = await prisma.$transaction(async (tx) => {
      // findFirst + create/update pattern (compound unique: interviewSlotMasterId_dayOfWeek)
      const existing = await tx.defaultInterviewSlot.findFirst({
        where: {
          interviewSlotMasterId: Number(masterId),
          dayOfWeek,
        },
      });

      const data = {
        startTime: startTime || '09:00',
        endTime: endTime || '17:00',
        intervalMinutes: intervalMinutes || 60,
        isEnabled: isEnabled ?? false,
        interviewerId: interviewerId ? Number(interviewerId) : null,
      };

      if (existing) {
        return tx.defaultInterviewSlot.update({
          where: { id: existing.id },
          data,
        });
      } else {
        return tx.defaultInterviewSlot.create({
          data: {
            ...data,
            dayOfWeek,
            interviewSlotMasterId: Number(masterId),
          },
        });
      }
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
    const { slots, effectiveFrom, masterId } = body as {
      slots: Array<{
        dayOfWeek: number;
        startTime: string;
        endTime: string;
        intervalMinutes: number;
        isEnabled: boolean;
        interviewerId: number | null;
      }>;
      effectiveFrom?: string; // YYYY-MM-DD
      masterId: number;
    };

    if (!Array.isArray(slots)) {
      return NextResponse.json({ error: '不正なリクエストです' }, { status: 400 });
    }

    if (!masterId) {
      return NextResponse.json({ error: 'マスタIDが必要です' }, { status: 400 });
    }

    // ① マスタ設定を一括 upsert (compound unique: interviewSlotMasterId_dayOfWeek)
    const results = await prisma.$transaction(async (tx) => {
      const upserted = [];
      for (const s of slots) {
        const existing = await tx.defaultInterviewSlot.findFirst({
          where: {
            interviewSlotMasterId: Number(masterId),
            dayOfWeek: s.dayOfWeek,
          },
        });

        const data = {
          startTime: s.startTime || '09:00',
          endTime: s.endTime || '17:00',
          intervalMinutes: s.intervalMinutes || 60,
          isEnabled: s.isEnabled ?? false,
          interviewerId: s.interviewerId ? Number(s.interviewerId) : null,
        };

        let slot;
        if (existing) {
          slot = await tx.defaultInterviewSlot.update({
            where: { id: existing.id },
            data,
          });
        } else {
          slot = await tx.defaultInterviewSlot.create({
            data: {
              ...data,
              dayOfWeek: s.dayOfWeek,
              interviewSlotMasterId: Number(masterId),
            },
          });
        }

        upserted.push(slot);
      }
      return upserted;
    });

    // ② 適用開始日が指定されている場合、不一致の未予約スロットを削除して再生成
    if (effectiveFrom) {
      const startDate = new Date(effectiveFrom);
      startDate.setUTCHours(0, 0, 0, 0);

      // JST（+09:00）で指定分数を Date に変換（サーバータイムゾーン非依存）
      const toJSTTime = (date: Date, totalMinutes: number): Date => {
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        const yyyy = date.getUTCFullYear();
        const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(date.getUTCDate()).padStart(2, '0');
        return new Date(`${yyyy}-${mm}-${dd}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+09:00`);
      };

      // 保存後のこのマスタのデフォルト設定を取得
      const masterSlots = await prisma.defaultInterviewSlot.findMany({
        where: { interviewSlotMasterId: Number(masterId) },
      });

      // マスタのallowHolidays設定を取得
      const masterRecord = await prisma.interviewSlotMaster.findUnique({ where: { id: Number(masterId) } });

      // このマスタに紐づく職種IDを取得（JobCategory.interviewSlotMasterId）
      const jobCategories = await prisma.jobCategory.findMany({
        where: { interviewSlotMasterId: Number(masterId) },
        select: { id: true },
      });
      const jcIds = jobCategories.map((jc) => jc.id);

      let totalDeleted = 0;
      let totalCreated = 0;

      // 適用開始日から14日間処理
      for (let i = 0; i < 14; i++) {
        const currentDate = new Date(startDate);
        currentDate.setUTCDate(currentDate.getUTCDate() + i);
        const dayOfWeek = currentDate.getUTCDay();

        // JST日の開始・終了をUTCで表現（JST 00:00〜23:59 = UTC 前日15:00〜当日14:59）
        const dayStart = toJSTTime(currentDate, 0);          // JST 00:00
        const dayEnd = toJSTTime(currentDate, 23 * 60 + 59); // JST 23:59

        // 祝日チェック: allowHolidays=false の場合、祝日の未予約スロットを削除してスキップ
        if (masterRecord && !masterRecord.allowHolidays) {
          const isHolidayDate = await isHoliday(currentDate);
          if (isHolidayDate) {
            const deleted = await prisma.interviewSlot.deleteMany({
              where: { isBooked: false, interviewSlotMasterId: Number(masterId), startTime: { gte: dayStart, lte: dayEnd } },
            });
            totalDeleted += deleted.count;
            continue;
          }
        }

        const master = masterSlots.find((s) => s.dayOfWeek === dayOfWeek && s.isEnabled);

        if (!master) {
          // 無効な曜日: このマスタの未予約スロットを全削除
          const deleted = await prisma.interviewSlot.deleteMany({
            where: {
              isBooked: false,
              interviewSlotMasterId: Number(masterId),
              startTime: { gte: dayStart, lte: dayEnd },
            },
          });
          totalDeleted += deleted.count;
        } else {
          // 有効な曜日: 新マスタに基づく有効スロットセットを計算
          const [startH, startM] = master.startTime.split(':').map(Number);
          const [endH, endM] = master.endTime.split(':').map(Number);
          const interval = master.intervalMinutes;
          const categoryList: (number | null)[] = jcIds.length > 0 ? jcIds : [null];

          type ValidSlot = { startTime: Date; endTime: Date; jobCategoryId: number | null };
          const validSlots: ValidSlot[] = [];
          let currentMinutes = startH * 60 + startM;
          const endMinutes = endH * 60 + endM;

          while (currentMinutes + interval <= endMinutes) {
            for (const jcId of categoryList) {
              const slotStart = toJSTTime(currentDate, currentMinutes);
              const slotEnd = toJSTTime(currentDate, currentMinutes + interval);
              validSlots.push({ startTime: slotStart, endTime: slotEnd, jobCategoryId: jcId });
            }
            currentMinutes += interval;
          }

          // この日のこのマスタの既存の未予約スロットを取得
          const existingUnbooked = await prisma.interviewSlot.findMany({
            where: {
              isBooked: false,
              interviewSlotMasterId: Number(masterId),
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
                  interviewerId: master.interviewerId,
                  interviewSlotMasterId: Number(masterId),
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
