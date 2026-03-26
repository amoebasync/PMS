import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { pushMessage, buildTrainingTestMessage } from '@/lib/line';

// ─── POST /api/training-test-assignments ───
export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pms_session')?.value;
  if (!session) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  let employeeId: number;
  try {
    const sessionData = JSON.parse(session);
    employeeId = sessionData.employeeId;
  } catch {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  const body = await req.json();
  const { distributorId } = body;

  if (!distributorId) {
    return NextResponse.json({ error: 'distributorId は必須です' }, { status: 400 });
  }

  // Validate distributor exists
  const distributor = await prisma.flyerDistributor.findUnique({
    where: { id: distributorId },
    select: { id: true, name: true, staffId: true },
  });

  if (!distributor) {
    return NextResponse.json({ error: '配布員が見つかりません' }, { status: 404 });
  }

  // Check for existing PENDING assignment
  const existing = await prisma.trainingTestAssignment.findFirst({
    where: { distributorId, status: 'PENDING' },
  });

  if (existing) {
    return NextResponse.json({ error: '既にテストが送信済みです' }, { status: 400 });
  }

  // Create the assignment
  const assignment = await prisma.trainingTestAssignment.create({
    data: {
      distributorId,
      assignedById: employeeId,
      status: 'PENDING',
    },
    include: {
      distributor: { select: { id: true, staffId: true, name: true } },
      assignedBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      results: { orderBy: { completedAt: 'desc' } },
    },
  });

  // Send LINE notification if LINE user exists
  const lineUser = await prisma.lineUser.findFirst({
    where: { distributorId },
  });

  if (lineUser) {
    const portalUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://pms.tiramis.co.jp';
    const messages = buildTrainingTestMessage(distributor.name, portalUrl);
    try {
      await pushMessage(lineUser.lineUserId, messages);
    } catch (e) {
      console.error('LINE notification failed:', e);
      // Don't fail the API call if LINE notification fails
    }
  }

  return NextResponse.json(assignment, { status: 201 });
}

// ─── GET /api/training-test-assignments ───
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const session = cookieStore.get('pms_session')?.value;
  if (!session) {
    return NextResponse.json({ error: '認証エラー' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const distributorIdParam = searchParams.get('distributorId');
  const statusParam = searchParams.get('status');

  const where: Record<string, unknown> = {};
  if (distributorIdParam) {
    where.distributorId = parseInt(distributorIdParam, 10);
  }
  if (statusParam) {
    where.status = statusParam;
  }

  const assignments = await prisma.trainingTestAssignment.findMany({
    where,
    include: {
      distributor: { select: { id: true, staffId: true, name: true } },
      assignedBy: { select: { id: true, lastNameJa: true, firstNameJa: true } },
      results: { orderBy: { completedAt: 'desc' } },
    },
    orderBy: { assignedAt: 'desc' },
  });

  return NextResponse.json(assignments);
}
