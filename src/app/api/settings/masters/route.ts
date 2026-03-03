import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


async function checkAdminAuth() {
  const cookieStore = await cookies();
  const session = cookieStore.get('pms_session');
  return !!session?.value;
}

export async function GET() {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [departments, industries, countries, visaTypes, banks, roles] = await Promise.all([
    prisma.department.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { employees: true } } },
    }),
    prisma.industry.findMany({
      orderBy: { id: 'asc' },
      include: { _count: { select: { flyers: true } } },
    }),
    prisma.country.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { employees: true, distributors: true } } },
    }),
    prisma.visaType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { distributors: true } } },
    }),
    prisma.bank.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.role.findMany({
      orderBy: { id: 'asc' },
    }),
  ]);

  return NextResponse.json({ departments, industries, countries, visaTypes, banks, roles });
}

export async function POST(request: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, data } = body;

  try {
    let result;
    if (type === 'department') {
      result = await prisma.department.create({
        data: {
          code: data.code || null,
          name: data.name,
        },
      });
    } else if (type === 'industry') {
      result = await prisma.industry.create({
        data: {
          name: data.name,
        },
      });
    } else if (type === 'country') {
      result = await prisma.country.create({
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          nameEn: data.nameEn || null,
          sortOrder: parseInt(data.sortOrder) || 100,
        },
      });
    } else if (type === 'visaType') {
      result = await prisma.visaType.create({
        data: {
          name: data.name,
          nameEn: data.nameEn || '',
          sortOrder: parseInt(data.sortOrder) || 100,
          canContract: !!data.canContract,
          canPartTime: !!data.canPartTime,
          workHourLimit: data.workHourLimit ? parseInt(data.workHourLimit) : null,
          requiresDesignation: !!data.requiresDesignation,
        },
      });
    } else if (type === 'bank') {
      result = await prisma.bank.create({
        data: {
          code: data.code,
          name: data.name,
          nameKana: data.nameKana || null,
          sortOrder: parseInt(data.sortOrder) || 100,
        },
      });
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Settings Masters POST Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { type, id, data } = body;

  try {
    let result;
    if (type === 'department') {
      result = await prisma.department.update({
        where: { id: parseInt(id) },
        data: {
          code: data.code || null,
          name: data.name,
        },
      });
    } else if (type === 'industry') {
      result = await prisma.industry.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name,
        },
      });
    } else if (type === 'country') {
      result = await prisma.country.update({
        where: { id: parseInt(id) },
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          nameEn: data.nameEn || null,
          sortOrder: parseInt(data.sortOrder) || 100,
        },
      });
    } else if (type === 'visaType') {
      result = await prisma.visaType.update({
        where: { id: parseInt(id) },
        data: {
          name: data.name,
          nameEn: data.nameEn || '',
          sortOrder: parseInt(data.sortOrder) || 100,
          canContract: !!data.canContract,
          canPartTime: !!data.canPartTime,
          workHourLimit: data.workHourLimit ? parseInt(data.workHourLimit) : null,
          requiresDesignation: !!data.requiresDesignation,
        },
      });
    } else if (type === 'bank') {
      result = await prisma.bank.update({
        where: { id: parseInt(id) },
        data: {
          code: data.code,
          name: data.name,
          nameKana: data.nameKana || null,
          sortOrder: parseInt(data.sortOrder) || 100,
        },
      });
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Settings Masters PUT Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!await checkAdminAuth()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type');
  const id = parseInt(searchParams.get('id') || '0');

  try {
    if (type === 'department') {
      const dept = await prisma.department.findUnique({
        where: { id },
        include: { _count: { select: { employees: true } } },
      });
      if (dept && dept._count.employees > 0) {
        return NextResponse.json({ error: '社員が所属しているため削除できません' }, { status: 409 });
      }
      await prisma.department.delete({ where: { id } });
    } else if (type === 'industry') {
      const industry = await prisma.industry.findUnique({
        where: { id },
        include: { _count: { select: { flyers: true } } },
      });
      if (industry && industry._count.flyers > 0) {
        return NextResponse.json({ error: 'チラシが紐付いているため削除できません' }, { status: 409 });
      }
      await prisma.industry.delete({ where: { id } });
    } else if (type === 'country') {
      const country = await prisma.country.findUnique({
        where: { id },
        include: { _count: { select: { employees: true, distributors: true } } },
      });
      if (country && (country._count.employees > 0 || country._count.distributors > 0)) {
        return NextResponse.json({ error: '社員または配布員に紐付いているため削除できません' }, { status: 409 });
      }
      await prisma.country.delete({ where: { id } });
    } else if (type === 'visaType') {
      const vt = await prisma.visaType.findUnique({
        where: { id },
        include: { _count: { select: { distributors: true } } },
      });
      if (vt && vt._count.distributors > 0) {
        return NextResponse.json({ error: '配布員に紐付いているため削除できません' }, { status: 409 });
      }
      await prisma.visaType.delete({ where: { id } });
    } else if (type === 'bank') {
      await prisma.bank.delete({ where: { id } });
    } else {
      return NextResponse.json({ error: 'Unknown type' }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings Masters DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
