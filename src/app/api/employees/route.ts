import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import { sendEmployeeWelcomeEmail } from '@/lib/mailer';


// 一覧取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    // ?search= が指定された場合はオートコンプリート用に絞り込んで返す
    if (search) {
      const employees = await prisma.employee.findMany({
        where: {
          isActive: true,
          OR: [
            { lastNameJa: { contains: search } },
            { firstNameJa: { contains: search } },
            { lastNameKana: { contains: search } },
            { firstNameKana: { contains: search } },
            { employeeCode: { contains: search } },
          ]
        },
        take: 10,
        orderBy: { lastNameJa: 'asc' },
        select: { id: true, lastNameJa: true, firstNameJa: true, jobTitle: true, department: { select: { name: true } } }
      });
      return NextResponse.json(employees);
    }

    const employees = await prisma.employee.findMany({
      orderBy: { id: 'desc' },
      include: {
        department: true,
        branch: true,
        roles: { include: { role: true } },
        country: true,
        financial: true,
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
    // 初期パスワード = 生年月日 (YYYYMMDD)。未入力の場合は今日の日付をフォールバック
    const birthdayStr = body.birthday
      ? new Date(body.birthday).toISOString().slice(0, 10).replace(/-/g, '')
      : new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const hash = crypto.createHash('sha256').update(birthdayStr).digest('hex');

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
          mustChangePassword: true,
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
            workingWeekdays: body.workingWeekdays || '1,2,3,4,5',
          }
        });
      }
      return emp;
    });

    // ウェルカムメール送信（失敗しても登録自体は成功扱い）
    const siteUrl = process.env.NEXTAUTH_URL || 'https://pms.tiramis.co.jp';
    sendEmployeeWelcomeEmail(
      body.email,
      body.lastNameJa,
      body.firstNameJa,
      newEmployee.employeeCode,
      birthdayStr,
      `${siteUrl}/login`,
    ).catch((err) => console.error('Welcome email failed:', err));

    return NextResponse.json(newEmployee);
  } catch (error) {
    console.error('Create Error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}