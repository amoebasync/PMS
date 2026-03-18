import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/adminAuth';

/**
 * GET /api/fraud-analysis/[id] — 不正検知分析詳細
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdminSession();
  if (error) return error;

  try {
    const { id } = await params;
    const item = await prisma.fraudAnalysis.findUnique({
      where: { id: parseInt(id) },
      include: {
        distributor: { select: { id: true, name: true, staffId: true } },
        schedule: {
          select: {
            id: true, date: true, status: true,
            area: { select: { town_name: true, chome_name: true, name_en: true } },
            items: { select: { flyerName: true, plannedCount: true, actualCount: true } },
          },
        },
        reviewedBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      },
    });

    if (!item) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (err) {
    console.error('Fraud Analysis Detail Error:', err);
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 });
  }
}
