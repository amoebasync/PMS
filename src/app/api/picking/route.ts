import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminActorInfo } from '@/lib/audit';

// GET /api/picking?date=2026-03-18
// 当日のスケジュール一覧とピッキング照合状況を取得
export async function GET(request: NextRequest) {
  try {
    // 認証チェック
    const { actorId } = await getAdminActorInfo();
    if (!actorId) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const dateStr = searchParams.get('date');
    
    if (!dateStr) {
      return NextResponse.json({ error: 'date パラメータが必要です' }, { status: 400 });
    }
    
    const targetDate = new Date(dateStr);
    
    // 当日のスケジュールを取得（配布員別）
    const schedules = await prisma.distributionSchedule.findMany({
      where: {
        date: targetDate,
        distributorId: { not: null },
      },
      include: {
        distributor: {
          select: {
            id: true,
            name: true,
            staffId: true,
          },
        },
        branch: {
          select: {
            id: true,
            nameJa: true,
          },
        },
        area: {
          include: {
            prefecture: { select: { name: true } },
            city: { select: { name: true } },
          },
        },
        items: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
            flyer: {
              select: {
                id: true,
                name: true,
                flyerCode: true,
                remarks: true,
              },
            },
          },
          orderBy: { slotIndex: 'asc' },
        },
        pickingVerification: {
          include: {
            picker: {
              select: {
                id: true,
                lastNameJa: true,
                firstNameJa: true,
              },
            },
            checker: {
              select: {
                id: true,
                lastNameJa: true,
                firstNameJa: true,
              },
            },
          },
        },
      },
      orderBy: [
        { distributorId: 'asc' },
        { id: 'asc' },
      ],
    });
    
    // 類似チラシ警告: 同じ顧客で異なるチラシがある場合を検出
    const customerFlyerMap = new Map<number, Set<string>>();
    const similarFlyerWarnings: Array<{
      customerId: number;
      customerName: string;
      flyerCodes: string[];
    }> = [];
    
    for (const schedule of schedules) {
      for (const item of schedule.items) {
        if (!item.customerId || !item.flyerCode) continue;
        
        if (!customerFlyerMap.has(item.customerId)) {
          customerFlyerMap.set(item.customerId, new Set());
        }
        customerFlyerMap.get(item.customerId)!.add(item.flyerCode);
      }
    }
    
    // 2種類以上のチラシを持つ顧客を警告対象に
    customerFlyerMap.forEach((flyerCodes, customerId) => {
      if (flyerCodes.size > 1) {
        // 顧客名を取得
        const item = schedules
          .flatMap(s => s.items)
          .find(i => i.customerId === customerId);
        if (item?.customer) {
          similarFlyerWarnings.push({
            customerId,
            customerName: item.customer.name,
            flyerCodes: Array.from(flyerCodes),
          });
        }
      }
    });
    
    // 配布員別にグループ化
    type ScheduleType = typeof schedules[number];
    const distributorGroups = new Map<number, ScheduleType[]>();
    for (const schedule of schedules) {
      if (!schedule.distributorId) continue;
      if (!distributorGroups.has(schedule.distributorId)) {
        distributorGroups.set(schedule.distributorId, []);
      }
      distributorGroups.get(schedule.distributorId)!.push(schedule);
    }
    
    // 統計情報
    const stats = {
      totalSchedules: schedules.length,
      pending: schedules.filter(s => !s.pickingVerification || s.pickingVerification.status === 'PENDING').length,
      aiChecked: schedules.filter(s => s.pickingVerification?.status === 'AI_CHECKED').length,
      verified: schedules.filter(s => s.pickingVerification?.status === 'VERIFIED').length,
      rejected: schedules.filter(s => s.pickingVerification?.status === 'REJECTED').length,
    };
    
    return NextResponse.json({
      date: dateStr,
      schedules,
      distributorGroups: Object.fromEntries(distributorGroups),
      similarFlyerWarnings,
      stats,
    });
  } catch (error) {
    console.error('GET /api/picking error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
