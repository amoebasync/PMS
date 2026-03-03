import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { writeAuditLog, getAdminActorInfo, getIpAddress } from '@/lib/audit';

// GET /api/training-slots
// 管理者: 研修スロット一覧（月指定、applicants件数付き）
export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month'); // "2026-03" 形式
    const from = searchParams.get('from');   // ISO文字列
    const to = searchParams.get('to');       // ISO文字列

    const where: any = {};
    if (from && to) {
      where.startTime = { gte: new Date(from), lt: new Date(to) };
    } else if (month) {
      const [year, m] = month.split('-').map(Number);
      const start = new Date(year, m - 1, 1);
      const end = new Date(year, m, 1);
      where.startTime = { gte: start, lt: end };
    }

    const slots = await prisma.trainingSlot.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        _count: { select: { applicants: true } },
        applicants: {
          select: {
            id: true, name: true, flowStatus: true, hiringStatus: true, phone: true, email: true,
            trainingAttendance: true, trainingUnderstandingScore: true,
            trainingCommunicationScore: true, trainingSpeedScore: true,
            trainingMotivationScore: true, trainingNotes: true,
            countryId: true, country: { select: { name: true } },
            jobCategoryId: true, jobCategory: { select: { nameJa: true } },
          },
          orderBy: { id: 'asc' },
        },
      },
    });

    // 全応募者のemailを集めて、配布員登録済みかを一括チェック
    const allEmails = slots.flatMap(s => s.applicants.map(a => a.email)).filter(Boolean);
    const registeredDistributors = allEmails.length > 0
      ? await prisma.flyerDistributor.findMany({
          where: { email: { in: allEmails } },
          select: { id: true, email: true },
        })
      : [];
    const emailToDistributorId = new Map(registeredDistributors.map(d => [d.email, d.id]));

    const data = slots.map((slot) => ({
      id: slot.id,
      startTime: slot.startTime,
      endTime: slot.endTime,
      capacity: slot.capacity,
      location: slot.location,
      note: slot.note,
      createdAt: slot.createdAt,
      updatedAt: slot.updatedAt,
      bookedCount: slot._count.applicants,
      remainingCapacity: slot.capacity - slot._count.applicants,
      applicants: slot.applicants.map(a => ({
        ...a,
        countryName: a.country?.name || null,
        jobCategoryName: a.jobCategory?.nameJa || null,
        registeredDistributorId: emailToDistributorId.get(a.email) || null,
        country: undefined,
        jobCategory: undefined,
      })),
    }));

    return NextResponse.json({ data, total: slots.length });
  } catch (error) {
    console.error('Training Slots Fetch Error:', error);
    return NextResponse.json({ error: 'スロットの取得に失敗しました' }, { status: 500 });
  }
}

// POST /api/training-slots
// 管理者: 個別研修スロット作成
export async function POST(request: Request) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) {
    return NextResponse.json({ error: '認証エラー: ログインが必要です' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { startTime, endTime, capacity, location, note } = body;

    if (!startTime || !endTime) {
      return NextResponse.json({ error: '必須項目が不足しています' }, { status: 400 });
    }

    const { actorId, actorName } = await getAdminActorInfo();
    const ip = getIpAddress(request);

    const slot = await prisma.$transaction(async (tx) => {
      const created = await tx.trainingSlot.create({
        data: {
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          capacity: capacity ? Number(capacity) : 10,
          location: location || null,
          note: note || null,
        },
      });

      await writeAuditLog({
        actorType: 'EMPLOYEE',
        actorId,
        actorName,
        action: 'CREATE',
        targetModel: 'TrainingSlot',
        targetId: created.id,
        afterData: created as unknown as Record<string, unknown>,
        description: `研修スロットを作成（${created.startTime.toISOString()}）`,
        ipAddress: ip,
        tx,
      });

      return created;
    });

    return NextResponse.json({ data: slot });
  } catch (error) {
    console.error('Training Slot Create Error:', error);
    return NextResponse.json({ error: 'スロットの作成に失敗しました' }, { status: 500 });
  }
}
