import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit';

const CRON_SECRET = process.env.CRON_SECRET;

// System setting defaults (must match src/app/api/settings/system/route.ts)
const SETTING_DEFAULTS: Record<string, string> = {
  evalBaseScore: '100',
  evalAttendanceBonus: '5',
  evalSheetsBonus: '1',
  evalSheetsBonusUnit: '1000',
  evalRankS: '120',
  evalRankA: '100',
  evalRankB: '80',
  evalRankC: '60',
  evalCycleDay: '0',
};

// GET /api/cron/evaluate-distributors
// CRON: 配布員の評価スコアを自動計算
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  try {
    // 1. Load system settings
    const settingRows = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: Object.keys(SETTING_DEFAULTS),
        },
      },
    });

    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const row of settingRows) {
      settings[row.key] = row.value;
    }

    const evalBaseScore = parseInt(settings.evalBaseScore);
    const evalAttendanceBonus = parseInt(settings.evalAttendanceBonus);
    const evalSheetsBonus = parseInt(settings.evalSheetsBonus);
    const evalSheetsBonusUnit = parseInt(settings.evalSheetsBonusUnit);
    const evalRankS = parseInt(settings.evalRankS);
    const evalRankA = parseInt(settings.evalRankA);
    const evalRankB = parseInt(settings.evalRankB);
    const evalRankC = parseInt(settings.evalRankC);
    const evalCycleDay = parseInt(settings.evalCycleDay); // 0=Sun..6=Sat

    // 2. Calculate the most recent completed week based on evalCycleDay
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayDay = today.getDay(); // 0=Sun..6=Sat

    // Find the most recent cycle start day that has a full week completed
    // periodEnd = the most recent evalCycleDay (exclusive end, i.e. the day before is the last day of the period)
    let daysBack = (todayDay - evalCycleDay + 7) % 7;
    if (daysBack === 0) daysBack = 7; // If today is the cycle day, use the previous completed week
    const periodEnd = new Date(today);
    periodEnd.setDate(periodEnd.getDate() - daysBack + 7);
    // periodEnd is the next cycle start = exclusive end

    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);

    // Actual period end date (inclusive) for display
    const periodEndInclusive = new Date(periodEnd);
    periodEndInclusive.setDate(periodEndInclusive.getDate() - 1);

    // Check for duplicate: if evaluations already exist for this periodStart
    const existingEval = await prisma.distributorEvaluation.findFirst({
      where: { periodStart },
    });
    if (existingEval) {
      return NextResponse.json({
        success: true,
        message: `この評価期間（${periodStart.toISOString().slice(0, 10)} ~ ${periodEndInclusive.toISOString().slice(0, 10)}）は既に評価済みです`,
        evaluated: 0,
        skipped: true,
      });
    }

    // 3. Get all active distributors
    const distributors = await prisma.flyerDistributor.findMany({
      where: { leaveDate: null },
      select: { id: true, name: true, staffId: true },
    });

    if (distributors.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'アクティブな配布員がいません',
        evaluated: 0,
      });
    }

    let evaluatedCount = 0;

    // 4. For each distributor, calculate scores
    for (const dist of distributors) {
      // 4a. Completed schedules in the period
      const schedules = await prisma.distributionSchedule.findMany({
        where: {
          distributorId: dist.id,
          status: 'COMPLETED',
          date: { gte: periodStart, lt: periodEnd },
        },
        include: {
          items: {
            select: { actualCount: true, plannedCount: true },
          },
        },
      });

      // Attendance = unique dates
      const uniqueDates = new Set<string>();
      let totalSheets = 0;

      for (const sched of schedules) {
        if (sched.date) {
          uniqueDates.add(sched.date.toISOString().slice(0, 10));
        }
        for (const item of sched.items) {
          totalSheets += item.actualCount || item.plannedCount || 0;
        }
      }

      const attendanceDays = uniqueDates.size;

      // 4b. Complaints in the period
      const complaints = await prisma.complaint.findMany({
        where: {
          distributorId: dist.id,
          occurredAt: { gte: periodStart, lt: periodEnd },
        },
        include: {
          complaintType: {
            select: { id: true, name: true, penaltyScore: true },
          },
        },
      });

      const complaintDetails: { id: number; title: string; typeName: string | null; penalty: number }[] = [];
      let totalPenalty = 0;

      for (const c of complaints) {
        const penalty = c.penaltyScore ?? c.complaintType?.penaltyScore ?? 10;
        totalPenalty += penalty;
        complaintDetails.push({
          id: c.id,
          title: c.title,
          typeName: c.complaintType?.name ?? null,
          penalty,
        });
      }

      // 4c. Calculate scores
      const performanceScore =
        attendanceDays * evalAttendanceBonus +
        (evalSheetsBonusUnit > 0
          ? Math.floor(totalSheets / evalSheetsBonusUnit) * evalSheetsBonus
          : 0);
      const qualityScore = -1 * totalPenalty;
      const totalScore = evalBaseScore + performanceScore + qualityScore;

      // 4d. Determine rank
      let determinedRank: string;
      if (totalScore >= evalRankS) {
        determinedRank = 'S';
      } else if (totalScore >= evalRankA) {
        determinedRank = 'A';
      } else if (totalScore >= evalRankB) {
        determinedRank = 'B';
      } else if (totalScore >= evalRankC) {
        determinedRank = 'C';
      } else {
        determinedRank = 'D';
      }

      // 4e. Build scoreBreakdown
      const scoreBreakdown = JSON.stringify({
        attendanceDays,
        totalSheets,
        baseScore: evalBaseScore,
        attendanceBonus: attendanceDays * evalAttendanceBonus,
        sheetsBonus:
          evalSheetsBonusUnit > 0
            ? Math.floor(totalSheets / evalSheetsBonusUnit) * evalSheetsBonus
            : 0,
        complaints: complaintDetails.map((c) => ({
          id: c.id,
          title: c.title,
          typeName: c.typeName,
        })),
        penalties: complaintDetails.map((c) => c.penalty),
        totalPenalty,
      });

      // 5. Upsert evaluation + update distributor in a transaction
      await prisma.$transaction(async (tx) => {
        await tx.distributorEvaluation.upsert({
          where: {
            distributorId_periodStart: {
              distributorId: dist.id,
              periodStart,
            },
          },
          create: {
            distributorId: dist.id,
            periodStart,
            periodEnd: periodEndInclusive,
            performanceScore,
            qualityScore,
            totalScore,
            determinedRank,
            scoreBreakdown,
          },
          update: {
            periodEnd: periodEndInclusive,
            performanceScore,
            qualityScore,
            totalScore,
            determinedRank,
            scoreBreakdown,
          },
        });

        await tx.flyerDistributor.update({
          where: { id: dist.id },
          data: {
            rank: determinedRank,
            currentScore: totalScore,
          },
        });
      });

      evaluatedCount++;
    }

    // Audit log
    if (evaluatedCount > 0) {
      await writeAuditLog({
        actorType: 'SYSTEM',
        action: 'CREATE',
        targetModel: 'DistributorEvaluation',
        description: `CRON配布員評価: ${evaluatedCount}名を評価（期間: ${periodStart.toISOString().slice(0, 10)} ~ ${periodEndInclusive.toISOString().slice(0, 10)}）`,
      });
    }

    return NextResponse.json({
      success: true,
      evaluated: evaluatedCount,
      period: {
        start: periodStart.toISOString().slice(0, 10),
        end: periodEndInclusive.toISOString().slice(0, 10),
      },
      message: `${evaluatedCount}名の配布員を評価しました`,
    });
  } catch (error) {
    console.error('CRON Evaluate Distributors Error:', error);
    return NextResponse.json({ error: '配布員評価の自動計算に失敗しました' }, { status: 500 });
  }
}
