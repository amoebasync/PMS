import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';


// 個別取得 (GET)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        department: true,
        branch: true,
        roles: { include: { role: true } },
        manager: { select: { id: true, lastNameJa: true, firstNameJa: true, jobTitle: true, avatarUrl: true } },
        subordinates: {
          where: { isActive: true },
          orderBy: { lastNameJa: 'asc' },
          select: { id: true, lastNameJa: true, firstNameJa: true, jobTitle: true, avatarUrl: true },
        },
      },
    });

    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { passwordHash, ...safeData } = employee;
    return NextResponse.json(safeData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// 更新 (PUT)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);
    const body = await request.json();

    const updated = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.update({
        where: { id: employeeId },
        data: {
          employeeCode: body.employeeCode,
          lastNameJa: body.lastNameJa,
          firstNameJa: body.firstNameJa,
          lastNameKana: body.lastNameKana,
          firstNameKana: body.firstNameKana,
          lastNameEn: body.lastNameEn || null,
          firstNameEn: body.firstNameEn || null,
          email: body.email,
          phone: body.phone || null, // 電話番号
          hireDate: body.hireDate ? new Date(body.hireDate) : null,
          birthday: body.birthday ? new Date(body.birthday) : null,
          gender: body.gender,
          employmentType: body.employmentType || 'FULL_TIME',
          departmentId: body.departmentId ? parseInt(body.departmentId) : null,
          branchId: body.branchId ? parseInt(body.branchId) : null, 
          countryId: body.countryId ? parseInt(body.countryId) : null,
          managerId: body.managerId ? parseInt(body.managerId) : null, // ★ 追加: 上司IDの保存
          rank: body.rank || 'ASSOCIATE', 
          jobTitle: body.jobTitle || null, 
          isActive: body.isActive,
        },
      });

      // 複数ロールの更新
      if (body.roleIds && Array.isArray(body.roleIds)) {
        await tx.employeeRole.deleteMany({ where: { employeeId } });
        const roleData = body.roleIds.map((rId: string) => ({
          employeeId,
          roleId: parseInt(rId)
        }));
        if (roleData.length > 0) {
          await tx.employeeRole.createMany({ data: roleData });
        }
      }

      const financialData = {
        salaryType: body.salaryType || 'MONTHLY',
        baseSalary: body.baseSalary ? parseInt(body.baseSalary) : null,
        hourlyRate: body.hourlyRate ? parseInt(body.hourlyRate) : null,
        dailyRate: body.dailyRate ? parseInt(body.dailyRate) : null,
        paymentMethod: body.paymentMethod || 'BANK_TRANSFER',
        paymentCycle: body.paymentCycle || 'MONTHLY',
        workingWeekdays: body.workingWeekdays || '1,2,3,4,5',
      };

      await tx.employeeFinancial.upsert({
        where: { employeeId: employeeId },
        update: financialData,
        create: {
          employeeId: employeeId,
          ...financialData
        }
      });

      return emp;
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Update Error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: false, resignationDate: new Date() },
    });

    return NextResponse.json({ message: 'Deleted successfully (Logical)' });
  } catch (error) {
    console.error('Delete Error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}