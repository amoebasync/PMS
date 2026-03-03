import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


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

    // 5. 未対応クレーム件数
    const unresolvedComplaintCount = await prisma.complaint.count({
      where: { status: 'UNRESOLVED' },
    });

    // 8. アラート件数
    const openAlertCount = await prisma.alert.count({ where: { status: 'OPEN' } });
    const criticalAlertCount = await prisma.alert.count({ where: { status: 'OPEN', severity: 'CRITICAL' } });

    // 6. CRM タスク集計
    const overdueTaskCount = await prisma.task.count({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { lt: today },
      },
    });

    const dueTodayTaskCount = await prisma.task.count({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { gte: today, lt: tomorrow },
      },
    });

    const myTasks = await prisma.task.findMany({
      where: {
        assigneeId: empId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
      },
      orderBy: { dueDate: 'asc' },
      take: 5,
      include: { customer: { select: { id: true, name: true } } },
    });

    // 7. 評価セクション: トップ配布員 & 要注意配布員
    const topDistributors = await prisma.flyerDistributor.findMany({
      where: { leaveDate: null },
      orderBy: { currentScore: 'desc' },
      take: 5,
      select: { id: true, name: true, staffId: true, rank: true, currentScore: true },
    });

    // 今週のクレーム2件以上の配布員
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Go back to Sunday
    const attentionDistributorsRaw = await prisma.complaint.groupBy({
      by: ['distributorId'],
      where: {
        distributorId: { not: null },
        occurredAt: { gte: weekStart, lt: tomorrow },
      },
      _count: { id: true },
      having: {
        id: { _count: { gte: 2 } },
      },
    });

    let attentionDistributors: { id: number; name: string; staffId: string; complaintCount: number }[] = [];
    if (attentionDistributorsRaw.length > 0) {
      const distIds = attentionDistributorsRaw
        .map((r) => r.distributorId)
        .filter((id): id is number => id !== null);
      const distMap = await prisma.flyerDistributor.findMany({
        where: { id: { in: distIds } },
        select: { id: true, name: true, staffId: true },
      });
      const nameMap = new Map(distMap.map((d) => [d.id, d]));
      attentionDistributors = attentionDistributorsRaw
        .filter((r) => r.distributorId !== null)
        .map((r) => ({
          id: r.distributorId!,
          name: nameMap.get(r.distributorId!)?.name || '',
          staffId: nameMap.get(r.distributorId!)?.staffId || '',
          complaintCount: r._count.id,
        }));
    }

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
      },
      crm: {
        overdueTaskCount,
        dueTodayTaskCount,
        myTasks,
      },
      quality: {
        unresolvedComplaintCount,
      },
      alertSummary: {
        openAlertCount,
        criticalAlertCount,
      },
      evaluation: {
        topDistributors,
        attentionDistributors,
      },
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}