import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; activityId: string }> }
) {
  const cookieStore = await cookies();
  if (!cookieStore.get('pms_session')?.value) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { activityId } = await params;
  const id = parseInt(activityId);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  await prisma.customerActivity.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
