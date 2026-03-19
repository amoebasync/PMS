import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * GET /api/fraud-analysis — 不正検知分析一覧 + KPIデータ
 */
export async function GET(request: Request) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const url = new URL(request.url);
    const riskLevel = url.searchParams.get('riskLevel'); // LOW,MEDIUM,HIGH,CRITICAL
    const distributorId = url.searchParams.get('distributorId');
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const reviewResult = url.searchParams.get('reviewResult'); // unreviewed, FALSE_POSITIVE, etc
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');

    const where: any = {};

    if (riskLevel) {
      const levels = riskLevel.split(',');
      where.riskLevel = { in: levels };
    }
    if (distributorId) {
      where.distributorId = parseInt(distributorId);
    }
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }
    if (reviewResult === 'unreviewed') {
      where.reviewResult = null;
    } else if (reviewResult) {
      where.reviewResult = reviewResult;
    }

    // Fetch items, total count, and KPI data in parallel
    const [items, total, kpiData] = await Promise.all([
      prisma.fraudAnalysis.findMany({
        where,
        include: {
          distributor: { select: { id: true, name: true, staffId: true } },
          schedule: {
            select: {
              id: true, date: true,
              area: {
                select: {
                  town_name: true, chome_name: true, name_en: true,
                  prefecture: { select: { name: true } },
                  city: { select: { name: true } },
                },
              },
            },
          },
          reviewedBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.fraudAnalysis.count({ where }),
      computeKpis(),
    ]);

    return NextResponse.json({ items, total, page, limit, kpis: kpiData });
  } catch (err) {
    console.error('Fraud Analysis List Error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}

/**
 * Compute KPI data for the fraud detection dashboard.
 * Returns: totalAnalyzed, highCriticalCount, unreviewedCount, averageScore
 */
async function computeKpis() {
  try {
    const [totalAnalyzed, highCriticalCount, unreviewedCount, avgResult] = await Promise.all([
      // Total analyzed records
      prisma.fraudAnalysis.count(),

      // HIGH + CRITICAL count
      prisma.fraudAnalysis.count({
        where: { riskLevel: { in: ['HIGH', 'CRITICAL'] } },
      }),

      // Unreviewed among HIGH/CRITICAL
      prisma.fraudAnalysis.count({
        where: {
          riskLevel: { in: ['HIGH', 'CRITICAL'] },
          reviewResult: null,
        },
      }),

      // Average risk score
      prisma.fraudAnalysis.aggregate({
        _avg: { riskScore: true },
      }),
    ]);

    return {
      totalAnalyzed,
      highCriticalCount,
      unreviewedCount,
      averageScore: Math.round(avgResult._avg.riskScore ?? 0),
    };
  } catch (err) {
    console.error('KPI computation error:', err);
    return {
      totalAnalyzed: 0,
      highCriticalCount: 0,
      unreviewedCount: 0,
      averageScore: 0,
    };
  }
}
