import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const empId = parseInt(sessionId);

    // 自分の権限（部下のみか全体か）を確認
    const employee = await prisma.employee.findUnique({
      where: { id: empId },
      include: { roles: { include: { role: true } } }
    });
    
    const roles = employee?.roles.map(r => r.role.code) || [];
    const isHrAdmin = roles.includes('SUPER_ADMIN') || roles.includes('HR_ADMIN');

    // 日付の計算
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1時間前

    // 1. 承認待ちアラート用件数
    const pendingOrders = await prisma.order.count({
      where: { status: { in: ['PENDING_REVIEW', 'PENDING_PAYMENT'] } }
    });

    const hrWhereClause: any = { status: 'PENDING' };
    if (!isHrAdmin) hrWhereClause.employee = { managerId: empId };
    
    const pendingAttendances = await prisma.attendance.count({ where: hrWhereClause });
    const pendingExpenses = await prisma.expense.count({ where: hrWhereClause });

    // 2. 今月の売上金額 (受注確定以上のもの)
    const monthlySales = await prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        orderDate: { gte: firstDayOfMonth },
        status: { in: ['CONFIRMED', 'IN_PROGRESS', 'COMPLETED'] }
      }
    });

    // 3. 今日のスケジュールから「出勤者数」と「配布枚数」を集計
    const todaySchedules = await prisma.distributionSchedule.findMany({
      where: { date: { gte: today, lt: tomorrow } },
      include: { items: true }
    });

    const uniqueDistributors = new Set<number>();
    const completedDistributors = new Set<number>();
    let totalPlanned = 0;
    let totalActual = 0;

    todaySchedules.forEach(schedule => {
      // 人数の集計
      if (schedule.distributorId) {
        uniqueDistributors.add(schedule.distributorId);
        if (schedule.status === 'COMPLETED') {
          completedDistributors.add(schedule.distributorId);
        }
      }
      // 枚数の集計
      schedule.items.forEach(item => {
        totalPlanned += item.plannedCount || 0;
        if (schedule.status === 'COMPLETED' || item.actualCount) {
           totalActual += item.actualCount || (item.plannedCount || 0);
        }
      });
    });

    // 4. ★追加: ECサイト(ポータル)のユーザー状況集計
    const totalUsers = await prisma.customerContact.count();
    const newUsersThisMonth = await prisma.customerContact.count({
      where: { createdAt: { gte: firstDayOfMonth } }
    });
    const activeUsers = await prisma.customerContact.count({
      where: { lastLoginAt: { gte: oneHourAgo } } // 直近1時間のログインをアクティブとみなす
    });

    return NextResponse.json({
      alerts: {
        orders: pendingOrders,
        approvals: pendingAttendances + pendingExpenses
      },
      kpi: {
        monthlySales: monthlySales._sum.totalAmount || 0,
        distributorsTotal: uniqueDistributors.size,
        distributorsCompleted: completedDistributors.size,
        flyersPlanned: totalPlanned,
        flyersActual: totalActual
      },
      ec: {
        totalUsers,
        newUsersThisMonth,
        activeUsers
      }
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}