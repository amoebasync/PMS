import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pms_session')?.value;
  if (!session) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const distributorId = searchParams.get('distributorId');
  const isPassed = searchParams.get('isPassed');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const where: Record<string, unknown> = {};

  if (distributorId) {
    where.assignment = {
      distributorId: parseInt(distributorId, 10),
    };
  }

  if (isPassed !== null && isPassed !== undefined) {
    where.isPassed = isPassed === 'true';
  }

  if (from || to) {
    const completedAt: Record<string, Date> = {};
    if (from) completedAt.gte = new Date(from);
    if (to) completedAt.lte = new Date(to);
    where.completedAt = completedAt;
  }

  const results = await prisma.trainingTestResult.findMany({
    where,
    include: {
      assignment: {
        include: {
          distributor: { select: { id: true, staffId: true, name: true } },
          assignedBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
  });

  return NextResponse.json({ results });
}
