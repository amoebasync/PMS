import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const customerId = parseInt(id);
  if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const activities = await prisma.customerActivity.findMany({
    where: { customerId },
    orderBy: { activityAt: 'desc' },
    include: { employee: { select: { id: true, lastNameJa: true, firstNameJa: true } } },
  });

  return NextResponse.json(activities);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const customerId = parseInt(id);
  if (isNaN(customerId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const body = await req.json();
  const { type, subject, body: actBody, activityAt, nextAction, employeeId } = body;

  if (!type || !subject || !activityAt) {
    return NextResponse.json({ error: 'type, subject, activityAt are required' }, { status: 400 });
  }

  const activity = await prisma.customerActivity.create({
    data: {
      customerId,
      employeeId: employeeId ? parseInt(employeeId) : parseInt(sessionId),
      type,
      subject,
      body: actBody || null,
      activityAt: new Date(activityAt),
      nextAction: nextAction || null,
    },
    include: { employee: { select: { id: true, lastNameJa: true, firstNameJa: true } } },
  });

  return NextResponse.json(activity, { status: 201 });
}
