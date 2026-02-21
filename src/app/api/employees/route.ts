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
        branch: true, 
        roles: { include: { role: true } },
        country: true,
        financial: true, 
        // ★ 追加: 上司の基本情報を取得
        manager: { select: { id: true, lastNameJa: true, firstNameJa: true } } 
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

    // ★ 社員コードが空欄の場合は自動採番する (EMP + 年月日 + 4桁のランダム数字)
    const generatedCode = `EMP${new Date().toISOString().slice(0,10).replace(/-/g, '')}${Math.floor(1000 + Math.random() * 9000)}`;
    const empCode = body.employeeCode || generatedCode;

    const newEmployee = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          employeeCode: empCode,
          lastNameJa: body.lastNameJa,
          firstNameJa: body.firstNameJa,
          lastNameKana: body.lastNameKana,
          firstNameKana: body.firstNameKana,
          lastNameEn: body.lastNameEn || null,
          firstNameEn: body.firstNameEn || null,
          email: body.email,
          phone: body.phone || null, // 電話番号
          passwordHash: hash,
          hireDate: body.hireDate ? new Date(body.hireDate) : null, 
          birthday: body.birthday ? new Date(body.birthday) : null,
          gender: body.gender || 'unknown',
          isActive: true,
          employmentType: body.employmentType || 'FULL_TIME',
          departmentId: body.departmentId ? parseInt(body.departmentId) : null,
          branchId: body.branchId ? parseInt(body.branchId) : null, 
          countryId: body.countryId ? parseInt(body.countryId) : null,
          managerId: body.managerId ? parseInt(body.managerId) : null, // ★ 追加: 上司IDの保存
          rank: body.rank || 'ASSOCIATE', 
          jobTitle: body.jobTitle || null, 
        },
      });

      // 複数ロールの保存処理
      if (body.roleIds && Array.isArray(body.roleIds)) {
        const roleData = body.roleIds.map((rId: string) => ({
          employeeId: emp.id,
          roleId: parseInt(rId)
        }));
        if (roleData.length > 0) {
          await tx.employeeRole.createMany({ data: roleData });
        }
      }

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