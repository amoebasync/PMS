import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';


async function getAuthorizedUser() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get('pms_session')?.value;
  if (!sessionId) return null;
  const user = await prisma.employee.findUnique({
    where: { id: parseInt(sessionId) },
    include: { roles: { include: { role: true } } },
  });
  const roles = user?.roles?.map((r: any) => r.role?.code) || [];
  if (!roles.includes('SUPER_ADMIN') && !roles.includes('HR_ADMIN')) return null;
  return user;
}

// GET: 単一レコード取得
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthorizedUser();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const record = await prisma.payrollRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: {
          select: {
            id: true, employeeCode: true, lastNameJa: true, firstNameJa: true,
            employmentType: true, avatarUrl: true,
            branch: { select: { nameJa: true } },
            department: { select: { name: true } },
            financial: true,
          }
        }
      },
    });
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(record);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// PUT: 更新（控除額・メモ・ステータス変更）
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthorizedUser();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.payrollRecord.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status === 'PAID') return NextResponse.json({ error: '支払済のレコードは編集できません' }, { status: 409 });

    const absentDeduction = body.absentDeduction !== undefined ? parseInt(body.absentDeduction) : existing.absentDeduction;
    const healthInsurance = body.healthInsurance !== undefined ? parseInt(body.healthInsurance) : existing.healthInsurance;
    const pensionInsurance = body.pensionInsurance !== undefined ? parseInt(body.pensionInsurance) : existing.pensionInsurance;
    const employmentInsurance = body.employmentInsurance !== undefined ? parseInt(body.employmentInsurance) : existing.employmentInsurance;
    const incomeTax = body.incomeTax !== undefined ? parseInt(body.incomeTax) : existing.incomeTax;
    const residentTax = body.residentTax !== undefined ? parseInt(body.residentTax) : existing.residentTax;
    const totalDeductions = absentDeduction + healthInsurance + pensionInsurance + employmentInsurance + incomeTax + residentTax;
    const netPay = existing.grossPay - totalDeductions;

    const updated = await prisma.payrollRecord.update({
      where: { id: parseInt(id) },
      data: {
        absentDeduction,
        healthInsurance,
        pensionInsurance,
        employmentInsurance,
        incomeTax,
        residentTax,
        totalDeductions,
        netPay,
        note: body.note !== undefined ? body.note : existing.note,
        status: body.status || existing.status,
      },
      include: {
        employee: { select: { id: true, employeeCode: true, lastNameJa: true, firstNameJa: true } }
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

// DELETE: DRAFT のみ削除
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthorizedUser();
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.payrollRecord.findUnique({ where: { id: parseInt(id) } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (existing.status !== 'DRAFT') return NextResponse.json({ error: '下書き以外のレコードは削除できません' }, { status: 409 });

    await prisma.payrollRecord.delete({ where: { id: parseInt(id) } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
