import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDistributorFromCookie } from '@/lib/distributorAuth';


export async function GET(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const shifts = await prisma.distributorShift.findMany({
      where: {
        distributorId: distributor.id,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    // 支店情報（定休日・代替出勤先）を取得
    let branch = null;
    if (distributor.branchId) {
      branch = await prisma.branch.findUnique({
        where: { id: distributor.branchId },
        select: {
          id: true,
          nameJa: true,
          nameEn: true,
          closedDays: true,
          alternateBranch: {
            select: {
              id: true,
              nameJa: true,
              nameEn: true,
              address: true,
              googleMapUrl: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ shifts, branch });
  } catch (error) {
    console.error('Distributor Shifts GET Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const distributor = await getDistributorFromCookie();
    if (!distributor) {
      return NextResponse.json({ error: '認証エラー' }, { status: 401 });
    }

    const { date, note } = await request.json();
    if (!date) {
      return NextResponse.json({ error: '日付を入力してください' }, { status: 400 });
    }

    // 登録可能日チェック
    const now = new Date();
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    const hour = now.getHours();
    const minAllowedDate = hour < 9 ? tomorrow : dayAfterTomorrow;

    if (targetDate < minAllowedDate) {
      const msg = hour < 9
        ? '翌日以降のシフトのみ申請できます'
        : '9時以降は明後日以降のシフトのみ申請できます';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const shift = await prisma.distributorShift.create({
      data: {
        distributorId: distributor.id,
        date: new Date(date),
        note: note || null,
        status: 'WORKING',
      },
    });

    return NextResponse.json({ shift }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'この日付はすでに申請済みです' }, { status: 409 });
    }
    console.error('Distributor Shifts POST Error:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
