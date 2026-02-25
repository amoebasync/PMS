import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


async function getSuperAdminEmployee() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;

  const empId = parseInt(sessionId);
  const employee = await prisma.employee.findUnique({
    where: { id: empId },
    include: { roles: { include: { role: true } } },
  });

  const isSuperAdmin = employee?.roles.some(r => r.role.code === 'SUPER_ADMIN');
  return isSuperAdmin ? { empId } : null;
}

// PUT: SUPER_ADMIN のみ
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getSuperAdminEmployee();
    if (!auth) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const announcementId = parseInt(id);
    if (isNaN(announcementId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    const body = await request.json();
    const { title, content, category } = body;

    if (!title || !content || !category) {
      return NextResponse.json({ error: 'title, content, category は必須です' }, { status: 400 });
    }

    const updated = await prisma.announcement.update({
      where: { id: announcementId },
      data: { title, content, category },
      include: {
        createdBy: {
          select: { lastNameJa: true, firstNameJa: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Announcements PUT Error:', error);
    return NextResponse.json({ error: 'Failed to update announcement' }, { status: 500 });
  }
}

// DELETE: SUPER_ADMIN のみ
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getSuperAdminEmployee();
    if (!auth) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const announcementId = parseInt(id);
    if (isNaN(announcementId)) {
      return NextResponse.json({ error: '無効なIDです' }, { status: 400 });
    }

    await prisma.announcement.delete({ where: { id: announcementId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Announcements DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete announcement' }, { status: 500 });
  }
}
