import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const distId = parseInt(id);

    // エリア別: 配布率の平均でスコア算出
    // planned_count = 1 のダミーデータは除外
    const rows = await prisma.$queryRaw<{
      area_id: number;
      town_name: string | null;
      chome_name: string | null;
      city_name: string | null;
      dist_count: bigint;
      avg_rate: number | null;
    }[]>`
      SELECT
        a.id as area_id,
        a.town_name,
        a.chome_name,
        c.name as city_name,
        COUNT(DISTINCT ds.id) as dist_count,
        AVG(di.actual_count / di.planned_count) as avg_rate
      FROM distribution_schedules ds
      JOIN areas a ON a.id = ds.area_id
      LEFT JOIN cities c ON c.id = a.city_id
      LEFT JOIN distribution_items di ON di.schedule_id = ds.id AND di.planned_count > 1 AND di.actual_count IS NOT NULL
      WHERE ds.distributor_id = ${distId}
        AND ds.status = 'COMPLETED'
        AND ds.area_id IS NOT NULL
      GROUP BY a.id, a.town_name, a.chome_name, c.name
      ORDER BY COALESCE(AVG(di.actual_count / di.planned_count), 0) DESC
    `;

    const rankings = rows.map((r, idx) => {
      const areaName = `${r.city_name || ''}${r.chome_name || r.town_name || ''}`.trim() || '不明';
      const count = Number(r.dist_count);
      const avgRate = r.avg_rate != null ? Math.round(r.avg_rate * 1000) / 10 : null;
      const score = avgRate != null ? Math.round(avgRate * 10) / 10 : 0;
      return {
        rank: idx + 1,
        areaId: r.area_id,
        areaName,
        distributionCount: count,
        avgDistributionRate: avgRate,
        score,
      };
    });

    return NextResponse.json(rankings);
  } catch (error) {
    console.error('Area rankings error:', error);
    return NextResponse.json({ error: 'Failed to fetch area rankings' }, { status: 500 });
  }
}
