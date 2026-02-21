import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

// 一覧取得
export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
      orderBy: { id: 'desc' },
      include: {
        department: true,
        role: true,
        country: true,
        financial: true, // ★ 追加: 財務・給与情報も含めて取得
      }
    });
    return NextResponse.json(employees);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

// 新規登録 (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const hash = crypto.createHash('sha256').update(body.password || 'password123').digest('hex');

    // ★ トランザクションで Employee と EmployeeFinancial を同時に作成
    const newEmployee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          employeeCode: body.employeeCode,
          lastNameJa: body.lastNameJa,
          firstNameJa: body.firstNameJa,
          lastNameKana: body.lastNameKana,
          firstNameKana: body.firstNameKana,
          lastNameEn: body.lastNameEn || null,
          firstNameEn: body.firstNameEn || null,
          email: body.email,
          passwordHash: hash,
          hireDate: new Date(body.hireDate), 
          birthday: body.birthday ? new Date(body.birthday) : null,
          gender: body.gender || 'unknown',
          isActive: true,
          employmentType: body.employmentType || 'FULL_TIME', // ★ 雇用形態
          departmentId: body.departmentId ? parseInt(body.departmentId) : null,
          roleId: body.roleId ? parseInt(body.roleId) : null,
          countryId: body.countryId ? parseInt(body.countryId) : null,
        },
      });

      // 財務・給与情報の作成
      if (body.salaryType) {
        await tx.employeeFinancial.create({
          data: {
            employeeId: emp.id,
            salaryType: body.salaryType || 'MONTHLY',
            baseSalary: body.baseSalary ? parseInt(body.baseSalary) : null,
            hourlyRate: body.hourlyRate ? parseInt(body.hourlyRate) : null,
            dailyRate: body.dailyRate ? parseInt(body.dailyRate) : null,
            paymentMethod: body.paymentMethod || 'BANK_TRANSFER',
            paymentCycle: body.paymentCycle || 'MONTHLY',
          }
        });
      }
      return emp;
    });

    return NextResponse.json(newEmployee);
  } catch (error) {
    console.error('Create Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    const deletedEmployee = await prisma.employee.update({
      where: { id },
      data: { isActive: false, resignationDate: new Date() },
    });
    return NextResponse.json({ message: 'Deleted successfully (Logical)' });
  } catch (error: any) {
    console.error('Delete API Error Detail:', error);
    return NextResponse.json({ error: 'Failed to delete', details: error.message }, { status: 500 });
  }
}