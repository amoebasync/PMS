import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const partnerId = parseInt(id, 10);

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    // Incident counts by severity
    const incidentsBySeverity = await prisma.partnerIncident.groupBy({
      by: ['severity'],
      where: {
        partnerId,
        ...(hasDateFilter ? { occurredAt: dateFilter } : {}),
      },
      _count: true,
    });

    // Total incidents
    const totalIncidents = await prisma.partnerIncident.count({
      where: {
        partnerId,
        ...(hasDateFilter ? { occurredAt: dateFilter } : {}),
      },
    });

    // Average resolution time (for resolved/closed)
    const resolvedIncidents = await prisma.partnerIncident.findMany({
      where: {
        partnerId,
        status: { in: ['RESOLVED', 'CLOSED'] },
        resolvedAt: { not: null },
        ...(hasDateFilter ? { occurredAt: dateFilter } : {}),
      },
      select: { occurredAt: true, resolvedAt: true },
    });

    let avgResolutionDays: number | null = null;
    if (resolvedIncidents.length > 0) {
      const totalDays = resolvedIncidents.reduce((sum, inc) => {
        const diffMs = inc.resolvedAt!.getTime() - inc.occurredAt.getTime();
        return sum + diffMs / (1000 * 60 * 60 * 24);
      }, 0);
      avgResolutionDays = Math.round((totalDays / resolvedIncidents.length) * 10) / 10;
    }

    // Complaint count (complaints where this partner is the source)
    const totalComplaints = await prisma.complaint.count({
      where: {
        sourcePartnerId: partnerId,
        ...(hasDateFilter ? { createdAt: dateFilter } : {}),
      },
    });

    return NextResponse.json({
      totalIncidents,
      incidentsBySeverity: incidentsBySeverity.map((g) => ({
        severity: g.severity,
        count: g._count,
      })),
      avgResolutionDays,
      totalComplaints,
    });
  } catch (error) {
    console.error('Get Partner Evaluation Error:', error);
    return NextResponse.json({ error: 'Failed to fetch evaluation data' }, { status: 500 });
  }
}
