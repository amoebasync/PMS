import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get('date');

  try {
    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        date: dateParam ? new Date(dateParam) : undefined,
      },
      include: {
        branch: true,
        distributor: true,
        city: true,
        area: {
          include: {
            prefecture: true,
            city: true, // ★ ここを追加しました！ Areaに紐づくCity情報を取得
          }
        },
        items: {
          orderBy: { slotIndex: 'asc' }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json(schedules);
  } catch (error) {
    console.error('Failed to fetch schedules:', error);
    return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 });
  }
}