import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get('pms_session')?.value;
    if (!sessionId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { language } = await request.json();
    if (language !== 'ja' && language !== 'en') {
      return NextResponse.json({ error: 'Invalid language' }, { status: 400 });
    }

    await prisma.employee.update({
      where: { id: parseInt(sessionId) },
      data: { language },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update language error:', error);
    return NextResponse.json({ error: 'Failed to update language' }, { status: 500 });
  }
}
