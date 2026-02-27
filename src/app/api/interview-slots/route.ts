import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/interview-slots
// 管理者: 全スロット一覧（応募者情報含む）
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // "2026-03" 形式
    const jobCategoryId = searchParams.get('jobCategoryId');

    const where: any = {};
    if (month) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 1);
      where.startTime = { gte: start, lt: end };
    }
    if (jobCategoryId) {
      where.jobCategoryId = Number(jobCategoryId);
    }

    const slots = await prisma.interviewSlot.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        jobCategory: {
          select: { id: true, nameJa: true, nameEn: true },
        },
        applicant: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            flowStatus: true,
            hiringStatus: true,
            jobCategory: { select: { id: true, nameJa: true, nameEn: true } },
          },
        },
      },
    });

    return NextResponse.json({ data: slots, total: slots.length });
  } catch (error) {
    console.error('Interview Slots Fetch Error:', error);
    return NextResponse.json({ error: 'スロットの取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/interview-slots
// 管理者: 面接スロットを作成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    // 単一スロット作成（startTime, endTime, jobCategoryId）
    if (body.startTime && body.endTime) {
      const slot = await prisma.$transaction(async (tx) => {
        const created = await tx.interviewSlot.create({
          data: {
            startTime: new Date(body.startTime),
            endTime: new Date(body.endTime),
            jobCategoryId: body.jobCategoryId ? Number(body.jobCategoryId) : null,
            meetUrl: body.meetUrl || null,
          },
          include: {
            jobCategory: { select: { id: true, nameJa: true, nameEn: true } },
          },
        });

        await writeAuditLog({
          actorType: 'EMPLOYEE',
          actorId,
          actorName,
          action: 'CREATE',
          targetModel: 'InterviewSlot',
          targetId: created.id,
          afterData: created as unknown as Record<string, unknown>,
          description: `面接スロットを作成（${created.startTime.toISOString()}）${created.jobCategory ? `職種: ${created.jobCategory.nameJa}` : '全職種対応'}`,
          ipAddress: ip,
          tx,
        });

        return created;
      });

      return NextResponse.json({ data: slot });
    }

    // 複数スロットを一括作成
    if (body.slots && Array.isArray(body.slots)) {
      const created = await prisma.$transaction(async (tx) => {
        const results = [];
        for (const s of body.slots) {
          const slot = await tx.interviewSlot.create({
            data: {
              startTime: new Date(s.startTime),
              endTime: new Date(s.endTime),
              jobCategoryId: s.jobCategoryId ? Number(s.jobCategoryId) : (body.jobCategoryId ? Number(body.jobCategoryId) : null),
              meetUrl: s.meetUrl || body.meetUrl || null,
            },
          });
          results.push(slot);
        }

        await writeAuditLog({
          actorType: 'EMPLOYEE',
          actorId,
          actorName,
          action: 'CREATE',
          targetModel: 'InterviewSlot',
          description: `面接スロットを${results.length}件一括作成`,
          ipAddress: ip,
          tx,
        });

        return results;
      });

      return NextResponse.json({ data: created, count: created.length });
    }

    // 時間帯指定で自動生成
    const { date, startHour, endHour, intervalMinutes, meetUrl, jobCategoryId } = body;
    if (!date || startHour == null || endHour == null || !intervalMinutes) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    const interval = Number(intervalMinutes);
    const slotsToCreate: { startTime: Date; endTime: Date }[] = [];
    const baseDate = new Date(date);

    let currentMinutes = Number(startHour) * 60;
    const endMinutes = Number(endHour) * 60;

    while (currentMinutes + interval <= endMinutes) {
      const start = new Date(baseDate);
      start.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);
      const end = new Date(baseDate);
      end.setHours(Math.floor((currentMinutes + interval) / 60), (currentMinutes + interval) % 60, 0, 0);
      slotsToCreate.push({ startTime: start, endTime: end });
      currentMinutes += interval;
    }

    if (slotsToCreate.length === 0) {
      return NextResponse.json({ error: '作成するスロットがありません' }, { status: 400 });
    }

    const created = await prisma.$transaction(async (tx) => {
      const results = [];
      for (const s of slotsToCreate) {
        const slot = await tx.interviewSlot.create({
          data: {
            startTime: s.startTime,
            endTime: s.endTime,
            jobCategoryId: jobCategoryId ? Number(jobCategoryId) : null,
            meetUrl: meetUrl || null,
          },
        });
        results.push(slot);
      }

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'InterviewSlot',
        description: `面接スロットを${results.length}件作成（${date} ${startHour}:00-${endHour}:00 / ${interval}分間隔）`,
        ipAddress: ip,
        tx,
      });

      return results;
    });

    return NextResponse.json({ data: created, count: created.length });
  } catch (error) {
    console.error('Interview Slot Create Error:', error);
    return NextResponse.json({ error: 'スロットの作成に失敗しました' }, { status: 500 });
  }
}
